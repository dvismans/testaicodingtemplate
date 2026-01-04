/**
 * Ventilator Module - Service Layer
 *
 * Side effects happen here: HTTP calls to Shelly relay, timer management.
 * Uses Result types for explicit error handling.
 *
 * @see Rule #87 (Result Type for All Operations That Can Fail)
 */
import { type Result, err, ok } from "neverthrow";

import { getVentilatorConfig } from "../config.js";
import { createLogger } from "../logger.js";
import type { VentilatorError } from "./errors.js";
import {
  controlFailed,
  disabled,
  networkError,
  statusUnavailable,
} from "./errors.js";
import type { VentilatorConfig, VentilatorState } from "./schema.js";
import {
  INITIAL_VENTILATOR_STATE,
  ShellyStatusResponseSchema,
} from "./schema.js";
import {
  calculateDelayEndTime,
  clearDelayedOff,
  formatRemainingTime,
  startDelayedOff,
  startKeepAlive,
  stopKeepAlive,
  updateVentilatorStatus,
} from "./transform.js";

const log = createLogger("ventilator");

// =============================================================================
// Module State
// =============================================================================

let ventilatorState: VentilatorState = INITIAL_VENTILATOR_STATE;
let delayedOffTimer: ReturnType<typeof setTimeout> | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Get current ventilator state (read-only).
 */
export function getVentilatorState(): VentilatorState {
  return ventilatorState;
}

// =============================================================================
// Shelly Relay Control
// =============================================================================

/**
 * Control the Shelly relay (turn ON or OFF).
 *
 * @param turnOn - true to turn ON, false to turn OFF
 * @param config - Ventilator configuration
 * @returns Result with success boolean or error
 */
export async function controlShellyRelay(
  turnOn: boolean,
  config: VentilatorConfig,
): Promise<Result<boolean, VentilatorError>> {
  const action = turnOn ? "on" : "off";
  const url = `http://${config.ipAddress}/relay/0?turn=${action}`;

  log.info(
    { action: action.toUpperCase(), ip: config.ipAddress },
    "Controlling Shelly relay...",
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      return err(
        controlFailed(
          turnOn ? "ON" : "OFF",
          `HTTP ${response.status}: ${response.statusText}`,
        ),
      );
    }

    log.info(
      { action: action.toUpperCase() },
      "Shelly relay controlled successfully",
    );

    // Update state
    const now = Date.now();
    ventilatorState = updateVentilatorStatus(ventilatorState, turnOn, now);

    return ok(true);
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));

    if (cause.name === "TimeoutError" || cause.name === "AbortError") {
      return err(
        controlFailed(turnOn ? "ON" : "OFF", "Request timed out", cause),
      );
    }

    return err(networkError("Failed to reach Shelly device", cause));
  }
}

/**
 * Get Shelly relay status.
 *
 * @param config - Ventilator configuration
 * @returns Result with relay status (true = ON) or error
 */
export async function getShellyStatus(
  config: VentilatorConfig,
): Promise<Result<boolean, VentilatorError>> {
  const url = `http://${config.ipAddress}/rpc/Shelly.GetStatus`;

  log.debug({ ip: config.ipAddress }, "Getting Shelly status...");

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      return err(
        statusUnavailable(`HTTP ${response.status}: ${response.statusText}`),
      );
    }

    const data = await response.json();
    const parsed = ShellyStatusResponseSchema.safeParse(data);

    if (!parsed.success || parsed.data["switch:0"] === undefined) {
      return err(statusUnavailable("Invalid response format from Shelly"));
    }

    const status = parsed.data["switch:0"].output;
    log.debug({ status: status ? "ON" : "OFF" }, "Shelly status retrieved");

    // Update state
    const now = Date.now();
    ventilatorState = updateVentilatorStatus(ventilatorState, status, now);

    return ok(status);
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));

    if (cause.name === "TimeoutError" || cause.name === "AbortError") {
      return err(statusUnavailable("Request timed out", cause));
    }

    return err(networkError("Failed to reach Shelly device", cause));
  }
}

// =============================================================================
// High-Level Ventilator Control (MCB Integration)
// =============================================================================

/**
 * Handle ventilator control when MCB turns ON.
 *
 * - Clears any pending delayed OFF timer
 * - Turns ventilator ON immediately
 * - Starts keep-alive cycling
 *
 * @returns Result with success or error
 */
export async function handleMcbOn(): Promise<Result<boolean, VentilatorError>> {
  const config = getVentilatorConfig();
  if (!config) {
    return err(disabled("Ventilator control is not configured"));
  }

  log.info("MCB turned ON - activating ventilator");

  // Clear any pending delayed OFF
  if (delayedOffTimer) {
    log.info("Clearing pending delayed OFF timer");
    clearTimeout(delayedOffTimer);
    delayedOffTimer = null;
    ventilatorState = clearDelayedOff(ventilatorState);
  }

  // Turn ventilator ON
  const result = await controlShellyRelay(true, config);
  if (result.isErr()) {
    return result;
  }

  // Start keep-alive if not already running
  if (!keepAliveTimer) {
    const intervalMs = config.keepAliveMinutes * 60 * 1000;
    log.info(
      { intervalMinutes: config.keepAliveMinutes },
      "Starting keep-alive timer",
    );

    keepAliveTimer = setInterval(async () => {
      await resetKeepAlive(config);
    }, intervalMs);

    ventilatorState = startKeepAlive(ventilatorState);
  }

  return ok(true);
}

/**
 * Handle ventilator control when MCB turns OFF.
 *
 * - Checks if ventilator is currently ON
 * - Schedules delayed OFF if running
 * - Keeps keep-alive active during cooldown period
 *
 * @returns Result with success or error
 */
export async function handleMcbOff(): Promise<
  Result<boolean, VentilatorError>
> {
  const config = getVentilatorConfig();
  if (!config) {
    return err(disabled("Ventilator control is not configured"));
  }

  log.info("MCB turned OFF - scheduling ventilator cooldown");

  // Clear any existing delayed OFF timer
  if (delayedOffTimer) {
    clearTimeout(delayedOffTimer);
    delayedOffTimer = null;
  }

  // Check current ventilator status
  const statusResult = await getShellyStatus(config);
  if (statusResult.isErr()) {
    log.warn("Could not get ventilator status, assuming it's ON");
  } else if (!statusResult.value) {
    log.info("Ventilator already OFF - no delayed timer needed");
    stopKeepAliveTimer();
    return ok(true);
  }

  // Schedule delayed OFF
  const now = Date.now();
  const endTime = calculateDelayEndTime(config, now);
  ventilatorState = startDelayedOff(ventilatorState, endTime);

  log.info(
    { delayMinutes: config.delayOffMinutes },
    `Scheduling ventilator OFF in ${config.delayOffMinutes} minutes`,
  );

  delayedOffTimer = setTimeout(
    async () => {
      log.info("Delayed OFF timer expired - turning ventilator OFF");
      await controlShellyRelay(false, config);

      delayedOffTimer = null;
      ventilatorState = clearDelayedOff(ventilatorState);

      // Now stop keep-alive
      stopKeepAliveTimer();
    },
    config.delayOffMinutes * 60 * 1000,
  );

  return ok(true);
}

/**
 * Reset keep-alive by cycling the relay OFF/ON.
 *
 * This prevents the Shelly's auto-off timer from triggering.
 *
 * @param config - Ventilator configuration
 */
async function resetKeepAlive(config: VentilatorConfig): Promise<void> {
  log.debug("Keep-alive cycle: turning OFF...");
  await controlShellyRelay(false, config);

  // Brief pause
  await new Promise((resolve) => setTimeout(resolve, 1000));

  log.debug("Keep-alive cycle: turning ON...");
  await controlShellyRelay(true, config);

  log.info("Keep-alive cycle complete");
}

/**
 * Stop the keep-alive timer.
 */
function stopKeepAliveTimer(): void {
  if (keepAliveTimer) {
    log.info("Stopping keep-alive timer");
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    ventilatorState = stopKeepAlive(ventilatorState);
  }
}

/**
 * Stop the delayed OFF timer.
 */
export function stopDelayedOffTimer(): void {
  if (delayedOffTimer) {
    log.info("Stopping delayed OFF timer");
    clearTimeout(delayedOffTimer);
    delayedOffTimer = null;
    ventilatorState = clearDelayedOff(ventilatorState);
  }
}

/**
 * Clear all ventilator timers (for shutdown).
 */
export function clearAllTimers(): void {
  log.info("Clearing all ventilator timers");

  if (delayedOffTimer) {
    clearTimeout(delayedOffTimer);
    delayedOffTimer = null;
  }

  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  ventilatorState = INITIAL_VENTILATOR_STATE;
}

/**
 * Get ventilator status summary for API responses.
 */
export function getVentilatorStatusSummary(): {
  enabled: boolean;
  status: boolean | null;
  hasDelayedOffTimer: boolean;
  delayedOffRemainingMs: number;
  keepAliveActive: boolean;
} {
  const config = getVentilatorConfig();
  const now = Date.now();

  if (!config) {
    return {
      enabled: false,
      status: null,
      hasDelayedOffTimer: false,
      delayedOffRemainingMs: 0,
      keepAliveActive: false,
    };
  }

  const remainingMs =
    ventilatorState.delayedOffEndTime !== null
      ? Math.max(0, ventilatorState.delayedOffEndTime - now)
      : 0;

  return {
    enabled: true,
    status: ventilatorState.status,
    hasDelayedOffTimer: ventilatorState.delayedOffEndTime !== null,
    delayedOffRemainingMs: remainingMs,
    keepAliveActive: ventilatorState.keepAliveActive,
  };
}
