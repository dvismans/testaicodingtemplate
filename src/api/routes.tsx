/**
 * API routes - all routes defined here.
 * JSON endpoints for API consumers, HTML for UI.
 *
 * @see Rule #33
 */
import { Hono } from "hono";
import { processGreeting } from "../greeting/index.js";
import { createLogger } from "../logger.js";
import {
  GreetingErrorDisplay,
  GreetingSuccess,
} from "../ui/components/GreetingResult.js";
import { HomePage } from "../ui/pages/Home.js";

const log = createLogger("api");

export const routes = new Hono();

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health endpoint - always returns OK.
 * Used by container orchestration and monitoring.
 */
routes.get("/api/health", (c) => {
  const requestId = c.get("requestId");
  log.debug({ requestId }, "Health check");

  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    requestId,
  });
});

// ============================================================================
// Greeting API (JSON)
// ============================================================================

/**
 * JSON greeting endpoint - for API consumers.
 */
routes.post("/api/greet/json", async (c) => {
  const requestId = c.get("requestId");
  const body = await c.req.json();

  const result = processGreeting(body, requestId);

  if (result.isErr()) {
    const status = result.error.type === "VALIDATION_FAILED" ? 400 : 422;
    return c.json({ error: result.error, requestId }, status);
  }

  return c.json(result.value);
});

// ============================================================================
// Greeting API (HTML for HTMX)
// ============================================================================

/**
 * HTML greeting endpoint - returns fragments for HTMX.
 * Server returns HTML, not JSON.
 *
 * @see Rule #33
 */
routes.post("/api/greet", async (c) => {
  const requestId = c.get("requestId");
  const formData = await c.req.parseBody();

  const result = processGreeting(formData, requestId);

  if (result.isErr()) {
    c.status(422);
    return c.html(
      <GreetingErrorDisplay error={result.error} requestId={requestId} />,
    );
  }

  return c.html(<GreetingSuccess response={result.value} />);
});

// ============================================================================
// Pages (HTML)
// ============================================================================

/**
 * Home page - full page load.
 */
routes.get("/", (c) => {
  return c.html(<HomePage />);
});
