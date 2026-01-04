/**
 * Ventilator Module - Error Types
 *
 * Typed error unions for ventilator operations.
 * Errors are values, not exceptions.
 *
 * @see Rule #16 (Type Safety), #31 (Errors Carry Context)
 */

/**
 * Errors that can occur during ventilator operations.
 */
export type VentilatorError =
  | {
      readonly type: "CONTROL_FAILED";
      readonly action: "ON" | "OFF";
      readonly message: string;
      readonly cause?: Error;
    }
  | {
      readonly type: "STATUS_UNAVAILABLE";
      readonly message: string;
      readonly cause?: Error;
    }
  | {
      readonly type: "NETWORK_ERROR";
      readonly message: string;
      readonly cause?: Error;
    }
  | {
      readonly type: "DISABLED";
      readonly message: string;
    };

/**
 * Create a CONTROL_FAILED error.
 */
export function controlFailed(
  action: "ON" | "OFF",
  message: string,
  cause?: Error,
): VentilatorError {
  if (cause) {
    return { type: "CONTROL_FAILED", action, message, cause };
  }
  return { type: "CONTROL_FAILED", action, message };
}

/**
 * Create a STATUS_UNAVAILABLE error.
 */
export function statusUnavailable(
  message: string,
  cause?: Error,
): VentilatorError {
  if (cause) {
    return { type: "STATUS_UNAVAILABLE", message, cause };
  }
  return { type: "STATUS_UNAVAILABLE", message };
}

/**
 * Create a NETWORK_ERROR.
 */
export function networkError(message: string, cause?: Error): VentilatorError {
  if (cause) {
    return { type: "NETWORK_ERROR", message, cause };
  }
  return { type: "NETWORK_ERROR", message };
}

/**
 * Create a DISABLED error.
 */
export function disabled(message: string): VentilatorError {
  return { type: "DISABLED", message };
}

/**
 * Format a VentilatorError for logging.
 */
export function formatVentilatorError(error: VentilatorError): string {
  switch (error.type) {
    case "CONTROL_FAILED":
      return `Control ${error.action} failed: ${error.message}`;
    case "STATUS_UNAVAILABLE":
      return `Status unavailable: ${error.message}`;
    case "NETWORK_ERROR":
      return `Network error: ${error.message}`;
    case "DISABLED":
      return `Ventilator disabled: ${error.message}`;
  }
}
