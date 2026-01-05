/**
 * MCB Local Module - Error Types
 *
 * Typed error union for local MCB operations.
 *
 * @see Rule #31 (Errors Carry Context)
 */

/**
 * All possible errors from the MCB local module.
 */
export type McbLocalError =
  | { type: "CONNECTION_FAILED"; message: string; cause?: Error }
  | { type: "COMMAND_FAILED"; message: string; command: "on" | "off" }
  | { type: "STATUS_UNAVAILABLE"; message: string }
  | { type: "DEVICE_ERROR"; message: string; deviceError: string }
  | { type: "TIMEOUT"; message: string; timeoutMs: number };

// =============================================================================
// Error Factory Functions
// =============================================================================

export function connectionFailed(
  message: string,
  cause?: Error,
): McbLocalError {
  return cause !== undefined
    ? { type: "CONNECTION_FAILED", message, cause }
    : { type: "CONNECTION_FAILED", message };
}

export function commandFailed(
  message: string,
  command: "on" | "off",
): McbLocalError {
  return { type: "COMMAND_FAILED", message, command };
}

export function statusUnavailable(message: string): McbLocalError {
  return { type: "STATUS_UNAVAILABLE", message };
}

export function deviceError(
  message: string,
  deviceError: string,
): McbLocalError {
  return { type: "DEVICE_ERROR", message, deviceError };
}

export function timeout(message: string, timeoutMs: number): McbLocalError {
  return { type: "TIMEOUT", message, timeoutMs };
}

/**
 * Format error for logging/display.
 */
export function formatMcbLocalError(error: McbLocalError): string {
  switch (error.type) {
    case "CONNECTION_FAILED":
      return `Connection failed: ${error.message}`;
    case "COMMAND_FAILED":
      return `Command '${error.command}' failed: ${error.message}`;
    case "STATUS_UNAVAILABLE":
      return `Status unavailable: ${error.message}`;
    case "DEVICE_ERROR":
      return `Device error: ${error.message} (${error.deviceError})`;
    case "TIMEOUT":
      return `Timeout after ${error.timeoutMs}ms: ${error.message}`;
  }
}
