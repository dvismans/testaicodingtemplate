/**
 * MCB Module - Error Types
 *
 * Typed error unions for MCB operations.
 * Errors are values, not exceptions.
 *
 * @see Rule #16 (Type Safety), #31 (Errors Carry Context)
 */

/**
 * Errors that can occur during MCB operations.
 */
export type McbError =
  | {
      readonly type: "AUTH_FAILED";
      readonly message: string;
      readonly cause?: Error;
    }
  | {
      readonly type: "TOKEN_EXPIRED";
      readonly message: string;
    }
  | {
      readonly type: "COMMAND_FAILED";
      readonly command: "TURN_ON" | "TURN_OFF";
      readonly message: string;
      readonly cause?: Error;
    }
  | {
      readonly type: "STATUS_UNAVAILABLE";
      readonly source: "cloud" | "local";
      readonly message: string;
      readonly cause?: Error;
    }
  | {
      readonly type: "NETWORK_ERROR";
      readonly message: string;
      readonly cause?: Error;
    }
  | {
      readonly type: "INVALID_RESPONSE";
      readonly message: string;
      readonly responseData?: unknown;
    };

/**
 * Create an AUTH_FAILED error.
 */
export function authFailed(message: string, cause?: Error): McbError {
  if (cause) {
    return { type: "AUTH_FAILED", message, cause };
  }
  return { type: "AUTH_FAILED", message };
}

/**
 * Create a TOKEN_EXPIRED error.
 */
export function tokenExpired(message: string): McbError {
  return { type: "TOKEN_EXPIRED", message };
}

/**
 * Create a COMMAND_FAILED error.
 */
export function commandFailed(
  command: "TURN_ON" | "TURN_OFF",
  message: string,
  cause?: Error,
): McbError {
  if (cause) {
    return { type: "COMMAND_FAILED", command, message, cause };
  }
  return { type: "COMMAND_FAILED", command, message };
}

/**
 * Create a STATUS_UNAVAILABLE error.
 */
export function statusUnavailable(
  source: "cloud" | "local",
  message: string,
  cause?: Error,
): McbError {
  if (cause) {
    return { type: "STATUS_UNAVAILABLE", source, message, cause };
  }
  return { type: "STATUS_UNAVAILABLE", source, message };
}

/**
 * Create a NETWORK_ERROR.
 */
export function networkError(message: string, cause?: Error): McbError {
  if (cause) {
    return { type: "NETWORK_ERROR", message, cause };
  }
  return { type: "NETWORK_ERROR", message };
}

/**
 * Create an INVALID_RESPONSE error.
 */
export function invalidResponse(
  message: string,
  responseData?: unknown,
): McbError {
  return { type: "INVALID_RESPONSE", message, responseData };
}

/**
 * Format an McbError for logging.
 */
export function formatMcbError(error: McbError): string {
  switch (error.type) {
    case "AUTH_FAILED":
      return `Auth failed: ${error.message}`;
    case "TOKEN_EXPIRED":
      return `Token expired: ${error.message}`;
    case "COMMAND_FAILED":
      return `Command ${error.command} failed: ${error.message}`;
    case "STATUS_UNAVAILABLE":
      return `Status unavailable (${error.source}): ${error.message}`;
    case "NETWORK_ERROR":
      return `Network error: ${error.message}`;
    case "INVALID_RESPONSE":
      return `Invalid response: ${error.message}`;
  }
}
