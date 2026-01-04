/**
 * Request ID middleware - generates or propagates request ID for tracing.
 * Every request gets a unique ID that flows through all log calls.
 *
 * @see Rule #86
 */
import type { MiddlewareHandler } from "hono";
import { createLogger } from "../../logger.js";

const log = createLogger("middleware");

/**
 * Generates a UUID v4 for request tracing.
 * Using crypto.randomUUID() which is available in Bun.
 */
const generateRequestId = (): string => crypto.randomUUID();

/**
 * Request ID middleware - attaches unique ID to each request.
 * Propagates existing x-request-id header if present.
 */
export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const existingId = c.req.header("x-request-id");
  const requestId = existingId ?? generateRequestId();

  // Store in context for downstream use
  c.set("requestId", requestId);

  // Add to response headers
  c.header("x-request-id", requestId);

  log.debug({ requestId, path: c.req.path }, "→ Request started");

  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  log.debug(
    { requestId, path: c.req.path, status: c.res.status, durationMs: duration },
    "✓ Request completed",
  );
};

// Type augmentation for Hono context
declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}
