/**
 * Smart Meter Module - Service Layer
 *
 * Side effects happen here: HTTP calls to the smart meter API.
 * Uses Result types for explicit error handling.
 *
 * @see Rule #87 (Result Type for All Operations That Can Fail)
 */
import { type Result, err, ok } from "neverthrow";

import { config } from "../config.js";
import { createLogger } from "../logger.js";
import type { SmartMeterError } from "./errors.js";
import { invalidResponse, networkError } from "./errors.js";
import type { PhaseData } from "./schema.js";
import { SmartMeterRawResponseSchema } from "./schema.js";
import { parseSmartMeterResponse } from "./transform.js";

const log = createLogger("meter");

// =============================================================================
// Smart Meter API - Polling
// =============================================================================

/**
 * Poll the smart meter API for current phase amperage.
 *
 * @returns Result with PhaseData or error
 */
export async function pollSmartMeter(): Promise<
  Result<PhaseData, SmartMeterError>
> {
  const url = new URL(config.SMART_METER_URL);
  url.searchParams.set("limit", "1");
  url.searchParams.set("sort", "desc");

  log.debug({ url: url.toString() }, "Polling smart meter...");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-APIkey": config.SMART_METER_API_KEY,
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return err(
        networkError(`HTTP ${response.status}: ${response.statusText}`),
      );
    }

    const data = await response.json();

    // Validate response schema
    const parsed = SmartMeterRawResponseSchema.safeParse(data);
    if (!parsed.success) {
      return err(
        invalidResponse("Invalid response format from smart meter", data),
      );
    }

    // Parse the response into PhaseData
    const phaseData = parseSmartMeterResponse(parsed.data);
    if (!phaseData) {
      return err(
        invalidResponse("Could not parse phase data from response", data),
      );
    }

    log.debug(
      { l1: phaseData.l1, l2: phaseData.l2, l3: phaseData.l3 },
      "Smart meter polled successfully",
    );

    return ok(phaseData);
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));

    // Handle timeout specifically
    if (cause.name === "TimeoutError" || cause.name === "AbortError") {
      return err(networkError("Request timed out", cause));
    }

    return err(networkError("Failed to poll smart meter", cause));
  }
}
