/**
 * MCB Module - Pure Transformations
 *
 * Pure functions for MCB data transformations.
 * No side effects, no I/O - just data in, data out.
 *
 * @see Rule #5 (Pure Transformations), #8 (Immutability)
 */
import { createHash, createHmac } from "node:crypto";
import type {
  LocalMcbStatusResponse,
  McbCommand,
  McbStatus,
  TuyaCommandPayload,
  TuyaSignHeaders,
} from "./schema.js";

// =============================================================================
// Tuya API Signature Generation
// =============================================================================

/**
 * Generate SHA256 hash of content.
 * Uses Node's crypto module (compatible with Bun and Node.js).
 */
export function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Generate HMAC-SHA256 signature.
 * Uses Node's crypto module (compatible with Bun and Node.js).
 */
export function hmacSha256Hex(key: string, message: string): string {
  return createHmac("sha256", key).update(message).digest("hex").toUpperCase();
}

/**
 * Build the string to sign for Tuya API authentication.
 *
 * Format:
 * ```
 * HTTPMethod\n
 * Content-SHA256\n
 * \n
 * URL
 * ```
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - URL path (e.g., /v1.0/token)
 * @param body - Request body or null for GET requests
 * @returns String to be signed
 */
export function buildStringToSign(
  method: string,
  path: string,
  body: string | null,
): string {
  const bodyToHash = body ?? "";
  const contentSha256 = sha256Hex(bodyToHash);
  return `${method}\n${contentSha256}\n\n${path}`;
}

/**
 * Generate Tuya API signature for token request (no access token).
 *
 * Message format: client_id + timestamp + stringToSign
 *
 * @param accessId - Tuya Access ID
 * @param accessKey - Tuya Access Key (secret)
 * @param method - HTTP method
 * @param path - URL path
 * @param timestamp - Current timestamp in milliseconds
 * @returns Signed headers for the request
 */
export function generateTokenRequestSign(
  accessId: string,
  accessKey: string,
  method: string,
  path: string,
  timestamp: number,
): TuyaSignHeaders {
  const timestampStr = timestamp.toString();
  const stringToSign = buildStringToSign(method, path, null);
  const message = accessId + timestampStr + stringToSign;
  const sign = hmacSha256Hex(accessKey, message);

  return {
    client_id: accessId,
    sign_method: "HMAC-SHA256",
    t: timestampStr,
    sign,
  };
}

/**
 * Generate Tuya API signature for authenticated requests.
 *
 * Message format: client_id + access_token + timestamp + stringToSign
 *
 * @param accessId - Tuya Access ID
 * @param accessKey - Tuya Access Key (secret)
 * @param accessToken - Current access token
 * @param method - HTTP method
 * @param path - URL path
 * @param body - Request body or null
 * @param timestamp - Current timestamp in milliseconds
 * @returns Signed headers for the request
 */
export function generateAuthenticatedSign(
  accessId: string,
  accessKey: string,
  accessToken: string,
  method: string,
  path: string,
  body: string | null,
  timestamp: number,
): TuyaSignHeaders {
  const timestampStr = timestamp.toString();
  const stringToSign = buildStringToSign(method, path, body);
  const message = accessId + accessToken + timestampStr + stringToSign;
  const sign = hmacSha256Hex(accessKey, message);

  const headers: TuyaSignHeaders = {
    client_id: accessId,
    sign_method: "HMAC-SHA256",
    t: timestampStr,
    sign,
    access_token: accessToken,
  };

  if (body) {
    return { ...headers, "Content-Type": "application/json" };
  }

  return headers;
}

// =============================================================================
// Command Payload Building
// =============================================================================

/**
 * Build Tuya command payload for MCB control.
 *
 * The MCB uses DPS code "switch_1" for the main switch.
 *
 * @param command - The command to execute
 * @returns Tuya command payload
 */
export function buildCommandPayload(command: McbCommand): TuyaCommandPayload {
  const value = command.type === "TURN_ON";

  return {
    commands: [{ code: "switch_1", value }],
  };
}

/**
 * Build the API endpoint path for device commands.
 *
 * @param deviceId - Tuya device ID
 * @returns API endpoint path
 */
export function buildCommandPath(deviceId: string): string {
  return `/v1.0/iot-03/devices/${deviceId}/commands`;
}

/**
 * Token request path.
 */
export const TOKEN_PATH = "/v1.0/token?grant_type=1";

// =============================================================================
// Response Parsing
// =============================================================================

/**
 * Parse local MCB status response into McbStatus.
 *
 * The local API returns DPS data where key "1" is the switch state.
 *
 * @param response - Response from local MCB API
 * @returns Parsed MCB status
 */
export function parseLocalMcbStatus(
  response: LocalMcbStatusResponse,
): McbStatus {
  if (response.status !== "success" || !response.dps_data) {
    return "UNKNOWN";
  }

  const switchState = response.dps_data["1"];

  if (switchState === true) {
    return "ON";
  }

  if (switchState === false) {
    return "OFF";
  }

  return "UNKNOWN";
}

/**
 * Check if a cached token is still valid.
 *
 * Adds a 60-second buffer before actual expiry.
 *
 * @param expiresAt - Token expiry timestamp in ms
 * @param now - Current timestamp in ms
 * @returns True if token is still valid
 */
export function isTokenValid(expiresAt: number, now: number): boolean {
  const bufferMs = 60000; // 1 minute buffer
  return now < expiresAt - bufferMs;
}

/**
 * Calculate token expiry timestamp.
 *
 * @param expiresInSeconds - Token lifetime in seconds from API
 * @param now - Current timestamp in ms
 * @returns Expiry timestamp in ms
 */
export function calculateTokenExpiry(
  expiresInSeconds: number,
  now: number,
): number {
  return now + expiresInSeconds * 1000;
}
