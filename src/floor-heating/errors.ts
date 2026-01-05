/**
 * Floor Heating Module - Error Types
 *
 * Typed error union for floor heating operations.
 *
 * @see Rule #31 (Errors Carry Context)
 */

/**
 * All possible errors from the floor heating module.
 */
export type FloorHeatingError =
  | { type: "CONNECTION_FAILED"; message: string; cause?: Error }
  | { type: "SET_TEMP_FAILED"; message: string; targetTemp: number }
  | { type: "SET_MODE_FAILED"; message: string; mode: string }
  | { type: "STATUS_UNAVAILABLE"; message: string }
  | { type: "DEVICE_ERROR"; message: string; deviceError: string }
  | { type: "TIMEOUT"; message: string; timeoutMs: number };

// =============================================================================
// Error Factory Functions
// =============================================================================

export function connectionFailed(
  message: string,
  cause?: Error,
): FloorHeatingError {
  return cause !== undefined
    ? { type: "CONNECTION_FAILED", message, cause }
    : { type: "CONNECTION_FAILED", message };
}

export function setTempFailed(
  message: string,
  targetTemp: number,
): FloorHeatingError {
  return { type: "SET_TEMP_FAILED", message, targetTemp };
}

export function setModeFailed(
  message: string,
  mode: string,
): FloorHeatingError {
  return { type: "SET_MODE_FAILED", message, mode };
}

export function statusUnavailable(message: string): FloorHeatingError {
  return { type: "STATUS_UNAVAILABLE", message };
}

export function deviceError(
  message: string,
  deviceError: string,
): FloorHeatingError {
  return { type: "DEVICE_ERROR", message, deviceError };
}

export function timeout(message: string, timeoutMs: number): FloorHeatingError {
  return { type: "TIMEOUT", message, timeoutMs };
}

/**
 * Format error for logging/display.
 */
export function formatFloorHeatingError(error: FloorHeatingError): string {
  switch (error.type) {
    case "CONNECTION_FAILED":
      return `Floor heating connection failed: ${error.message}`;
    case "SET_TEMP_FAILED":
      return `Failed to set temperature to ${error.targetTemp}°C: ${error.message}`;
    case "SET_MODE_FAILED":
      return `Failed to set mode to ${error.mode}: ${error.message}`;
    case "STATUS_UNAVAILABLE":
      return `Floor heating status unavailable: ${error.message}`;
    case "DEVICE_ERROR":
      return `Floor heating device error: ${error.message} (${error.deviceError})`;
    case "TIMEOUT":
      return `Floor heating timeout after ${error.timeoutMs}ms: ${error.message}`;
  }
}
