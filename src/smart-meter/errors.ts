/**
 * Smart Meter Module - Error Types
 *
 * Typed error unions for smart meter operations.
 * Errors are values, not exceptions.
 *
 * @see Rule #16 (Type Safety), #31 (Errors Carry Context)
 */

/**
 * Errors that can occur during smart meter operations.
 */
export type SmartMeterError =
  | {
      readonly type: "POLL_FAILED";
      readonly message: string;
      readonly cause?: Error;
    }
  | {
      readonly type: "INVALID_RESPONSE";
      readonly message: string;
      readonly responseData?: unknown;
    }
  | {
      readonly type: "NETWORK_ERROR";
      readonly message: string;
      readonly cause?: Error;
    };

/**
 * Create a POLL_FAILED error.
 */
export function pollFailed(message: string, cause?: Error): SmartMeterError {
  if (cause) {
    return { type: "POLL_FAILED", message, cause };
  }
  return { type: "POLL_FAILED", message };
}

/**
 * Create an INVALID_RESPONSE error.
 */
export function invalidResponse(
  message: string,
  responseData?: unknown,
): SmartMeterError {
  return { type: "INVALID_RESPONSE", message, responseData };
}

/**
 * Create a NETWORK_ERROR.
 */
export function networkError(message: string, cause?: Error): SmartMeterError {
  if (cause) {
    return { type: "NETWORK_ERROR", message, cause };
  }
  return { type: "NETWORK_ERROR", message };
}

/**
 * Format a SmartMeterError for logging.
 */
export function formatSmartMeterError(error: SmartMeterError): string {
  switch (error.type) {
    case "POLL_FAILED":
      return `Poll failed: ${error.message}`;
    case "INVALID_RESPONSE":
      return `Invalid response: ${error.message}`;
    case "NETWORK_ERROR":
      return `Network error: ${error.message}`;
  }
}
