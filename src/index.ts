/**
 * Application entry point.
 * Sets up Hono server with middleware and routes.
 *
 * @see Rule #90 (Minimum Viable Structure)
 */
import { Hono } from "hono";
import { errorHandler } from "./api/errorHandler.js";
import { requestIdMiddleware } from "./api/middleware/requestId.js";
import { routes } from "./api/routes.jsx";
import { config } from "./config.js";
import { createLogger } from "./logger.js";

const log = createLogger("api");

// Create app
const app = new Hono();

// Global middleware
app.use("*", requestIdMiddleware);

// Error handler
app.onError(errorHandler);

// Mount routes
app.route("/", routes);

// Start server
log.info(
  {
    port: config.PORT,
    env: config.NODE_ENV,
    appName: config.APP_NAME,
  },
  `🚀 ${config.APP_NAME} starting on port ${config.PORT}`,
);

export default {
  port: config.PORT,
  hostname: "0.0.0.0", // Bind to all interfaces for remote access
  fetch: app.fetch,
};

// --- Example usage (run with: bun src/index.ts) ---
// Server starts automatically with Bun's default export pattern.
// Visit: http://localhost:3000
// Health: http://localhost:3000/api/health
// API: curl -X POST http://localhost:3000/api/greet/json -H "Content-Type: application/json" -d '{"name":"World"}'
