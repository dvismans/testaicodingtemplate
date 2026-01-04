/**
 * Notifications Module - Error Types
 *
 * Typed error union for all notification failures.
 * Errors are values, not exceptions.
 *
 * @see Rule #16 (Type Safety is Non-Negotiable), #31 (Errors Carry Context)
 */

/**
 * Union type of all possible notification errors.
 */
export type NotificationError =
  | { type: "SEND_FAILED"; message: string; statusCode?: number }
  | { type: "NETWORK_ERROR"; message: string; cause?: Error }
  | { type: "NOT_CONFIGURED"; message: string }
  | { type: "RATE_LIMITED"; message: string; remainingMs: number };

// =============================================================================
// Error Factory Functions
// =============================================================================

/**
 * Create a SEND_FAILED error.
 */
export function sendFailed(
  message: string,
  statusCode?: number,
): NotificationError {
  return statusCode !== undefined
    ? { type: "SEND_FAILED", message, statusCode }
    : { type: "SEND_FAILED", message };
}

/**
 * Create a NETWORK_ERROR error.
 */
export function networkError(
  message: string,
  cause?: Error,
): NotificationError {
  return cause !== undefined
    ? { type: "NETWORK_ERROR", message, cause }
    : { type: "NETWORK_ERROR", message };
}

/**
 * Create a NOT_CONFIGURED error.
 */
export function notConfigured(message: string): NotificationError {
  return { type: "NOT_CONFIGURED", message };
}

/**
 * Create a RATE_LIMITED error.
 */
export function rateLimited(
  message: string,
  remainingMs: number,
): NotificationError {
  return { type: "RATE_LIMITED", message, remainingMs };
}
