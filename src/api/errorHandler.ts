/**
 * Global error boundary - catches all unhandled errors.
 * Never let errors bubble up without logging and a clean response.
 *
 * @see Rule #85
 */
import type { ErrorHandler } from "hono";
import { createLogger } from "../logger.js";

const log = createLogger("api");

/**
 * Global error handler for Hono.
 * Logs errors with context and returns clean JSON response.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get("requestId") ?? "unknown";

  log.error(
    {
      operation: "unhandledError",
      requestId,
      error: err.message,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
    },
    "❌ Unhandled error",
  );

  // Don't expose internal errors in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  return c.json(
    {
      error: message,
      requestId,
    },
    500,
  );
};
