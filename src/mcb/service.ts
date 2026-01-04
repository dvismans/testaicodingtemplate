/**
 * MCB Module - Service Layer
 *
 * Side effects happen here: HTTP calls to Tuya Cloud and Local API.
 * Uses Result types for explicit error handling.
 *
 * @see Rule #87 (Result Type for All Operations That Can Fail)
 */
import { type Result, err, ok } from "neverthrow";
import { config } from "../config.js";
import { createLogger } from "../logger.js";
import type { McbError } from "./errors.js";
import {
  authFailed,
  commandFailed,
  invalidResponse,
  networkError,
  statusUnavailable,
} from "./errors.js";
import type {
  LocalMcbStatusResponse,
  McbCommand,
  McbStatus,
  TuyaCommandResponse,
  TuyaTokenCache,
  TuyaTokenResponse,
} from "./schema.js";
import {
  LocalMcbStatusResponseSchema,
  TuyaCommandResponseSchema,
  TuyaTokenResponseSchema,
} from "./schema.js";
import {
  TOKEN_PATH,
  buildCommandPath,
  buildCommandPayload,
  calculateTokenExpiry,
  generateAuthenticatedSign,
  generateTokenRequestSign,
  isTokenValid,
  parseLocalMcbStatus,
} from "./transform.js";

const log = createLogger("mcb");

// =============================================================================
// Token Cache (Module-level state)
// =============================================================================

let tokenCache: TuyaTokenCache | null = null;

/**
 * Clear the token cache (useful for testing or forced refresh).
 */
export function clearTokenCache(): void {
  tokenCache = null;
  log.debug("Token cache cleared");
}

// =============================================================================
// Tuya Cloud API - Token Management
// =============================================================================

/**
 * Fetch a new access token from Tuya Cloud API.
 *
 * @returns Result with token or error
 */
async function fetchAccessToken(): Promise<Result<TuyaTokenCache, McbError>> {
  const timestamp = Date.now();
  const url = config.TUYA_BASE_URL + TOKEN_PATH;

  log.info("Fetching Tuya access token...");

  const headers = generateTokenRequestSign(
    config.TUYA_ACCESS_ID,
    config.TUYA_ACCESS_KEY,
    "GET",
    TOKEN_PATH,
    timestamp,
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: headers as Record<string, string>,
    });

    if (!response.ok) {
      return err(authFailed(`HTTP ${response.status}: ${response.statusText}`));
    }

    const data = await response.json();
    const parsed = TuyaTokenResponseSchema.safeParse(data);

    if (!parsed.success) {
      return err(invalidResponse("Invalid token response format", data));
    }

    const tokenResponse = parsed.data;

    if (!tokenResponse.success || !tokenResponse.result?.access_token) {
      return err(authFailed(tokenResponse.msg ?? "Token request failed"));
    }

    const expiresIn = tokenResponse.result.expire_time ?? 7200;
    const cache: TuyaTokenCache = {
      accessToken: tokenResponse.result.access_token,
      expiresAt: calculateTokenExpiry(expiresIn, timestamp),
    };

    log.info("Access token obtained successfully");
    return ok(cache);
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    return err(networkError("Failed to fetch access token", cause));
  }
}

/**
 * Get a valid access token, fetching a new one if needed.
 *
 * @returns Result with access token string or error
 */
async function ensureValidToken(): Promise<Result<string, McbError>> {
  const now = Date.now();

  if (tokenCache && isTokenValid(tokenCache.expiresAt, now)) {
    log.debug("Using cached access token");
    return ok(tokenCache.accessToken);
  }

  log.debug("Token expired or missing, fetching new token");
  const result = await fetchAccessToken();

  if (result.isErr()) {
    return err(result.error);
  }

  tokenCache = result.value;
  return ok(tokenCache.accessToken);
}

// =============================================================================
// Tuya Cloud API - Device Commands
// =============================================================================

/**
 * Send a command to the MCB via Tuya Cloud API.
 *
 * @param command - The command to execute (TURN_ON or TURN_OFF)
 * @returns Result with success boolean or error
 */
export async function sendMcbCommand(
  command: McbCommand,
): Promise<Result<boolean, McbError>> {
  const action = command.type === "TURN_ON" ? "ON" : "OFF";
  log.info(
    { command: command.type },
    `Sending MCB ${action} command via Cloud API...`,
  );

  // Get valid token
  const tokenResult = await ensureValidToken();
  if (tokenResult.isErr()) {
    return err(tokenResult.error);
  }

  const accessToken = tokenResult.value;
  const timestamp = Date.now();
  const path = buildCommandPath(config.MCB_DEVICE_ID);
  const payload = buildCommandPayload(command);
  const body = JSON.stringify(payload);
  const url = config.TUYA_BASE_URL + path;

  const headers = generateAuthenticatedSign(
    config.TUYA_ACCESS_ID,
    config.TUYA_ACCESS_KEY,
    accessToken,
    "POST",
    path,
    body,
    timestamp,
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers as Record<string, string>,
      body,
    });

    if (!response.ok) {
      return err(
        commandFailed(
          command.type,
          `HTTP ${response.status}: ${response.statusText}`,
        ),
      );
    }

    const data = await response.json();
    const parsed = TuyaCommandResponseSchema.safeParse(data);

    if (!parsed.success) {
      return err(invalidResponse("Invalid command response format", data));
    }

    const cmdResponse = parsed.data;

    if (!cmdResponse.success) {
      return err(
        commandFailed(command.type, cmdResponse.msg ?? "Command failed"),
      );
    }

    log.info(
      { command: command.type },
      `MCB ${action} command sent successfully`,
    );
    return ok(true);
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    return err(
      commandFailed(command.type, "Network error sending command", cause),
    );
  }
}

/**
 * Turn MCB ON via Tuya Cloud API.
 */
export async function turnMcbOn(): Promise<Result<boolean, McbError>> {
  return sendMcbCommand({ type: "TURN_ON" });
}

/**
 * Turn MCB OFF via Tuya Cloud API.
 */
export async function turnMcbOff(): Promise<Result<boolean, McbError>> {
  return sendMcbCommand({ type: "TURN_OFF" });
}

// =============================================================================
// Local MCB API - Status Polling
// =============================================================================

/**
 * Get MCB status from the local Python API.
 *
 * The local API uses TinyTuya for fast local network polling.
 *
 * @returns Result with MCB status or error
 */
export async function getMcbStatus(): Promise<Result<McbStatus, McbError>> {
  const url = `${config.MCB_LOCAL_API_URL}/mcb/status`;

  log.debug("Polling MCB status from local API...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No body needed - Python API reads config from env vars
    });

    if (!response.ok) {
      if (response.status === 503) {
        // Service unavailable - MCB device unreachable
        return err(statusUnavailable("local", "MCB device unreachable"));
      }
      return err(
        statusUnavailable(
          "local",
          `HTTP ${response.status}: ${response.statusText}`,
        ),
      );
    }

    const data = await response.json();
    const parsed = LocalMcbStatusResponseSchema.safeParse(data);

    if (!parsed.success) {
      return err(invalidResponse("Invalid status response format", data));
    }

    const status = parseLocalMcbStatus(parsed.data);
    log.debug({ status }, "MCB status retrieved");
    return ok(status);
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    return err(statusUnavailable("local", "Failed to reach local API", cause));
  }
}
