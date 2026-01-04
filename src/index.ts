/**
 * Sauna Control System - Application Entry Point
 *
 * Sets up Hono server with:
 * - Health check endpoints
 * - MCB control routes
 * - SSE for real-time updates
 * - Request ID tracing
 * - Global error handling
 * - Main monitoring loop
 *
 * @see Rule #90 (Minimum Viable Structure)
 */
import { Hono } from "hono";
import { errorHandler } from "./api/errorHandler.js";
import { requestIdMiddleware } from "./api/middleware/requestId.js";
import { routes } from "./api/routes.jsx";
import {
  config,
  getNotificationConfig,
  getVentilatorConfig,
} from "./config.js";
import { createLogger } from "./logger.js";
import { startMonitoringLoop, stopMonitoringLoop } from "./monitoring/index.js";
import { disconnectMqttClient } from "./mqtt/index.js";
import { disconnectAllClients } from "./sse/index.js";
import { clearAllTimers } from "./ventilator/index.js";

const log = createLogger("api");

// =============================================================================
// APPLICATION STARTUP BANNER
// =============================================================================

console.log("");
console.log("========================================");
console.log("  SAUNA MCB CONTROL SYSTEM");
console.log("========================================");
console.log("");

// Log configuration summary (non-sensitive values only)
log.info(
  {
    port: config.PORT,
    env: config.NODE_ENV,
    mcbDeviceId: config.MCB_DEVICE_ID,
    mcbLocalApi: config.MCB_LOCAL_API_URL,
    tuyaBaseUrl: config.TUYA_BASE_URL,
    amperageThreshold: config.AMPERAGE_THRESHOLD,
    pollingIntervalMs: config.POLLING_INTERVAL_MS,
    mqttBroker: config.MQTT_BROKER_URL,
  },
  "Configuration loaded",
);

// Log ventilator config
const ventilatorConfig = getVentilatorConfig();
if (ventilatorConfig) {
  log.info(
    {
      ip: ventilatorConfig.ipAddress,
      delayOffMinutes: ventilatorConfig.delayOffMinutes,
      keepAliveMinutes: ventilatorConfig.keepAliveMinutes,
    },
    "Ventilator control: ENABLED",
  );
} else {
  log.info("Ventilator control: DISABLED");
}

// Log notification config
const notificationConfig = getNotificationConfig();
if (notificationConfig) {
  log.info(
    {
      server: notificationConfig.serverUrl,
      phone: notificationConfig.phoneNumber,
    },
    "WhatsApp notifications: ENABLED",
  );
} else {
  log.info("WhatsApp notifications: DISABLED");
}

console.log("");

// =============================================================================
// HONO SERVER SETUP
// =============================================================================

const app = new Hono();

// Global middleware
app.use("*", requestIdMiddleware);

// Error handler
app.onError(errorHandler);

// Static files (public directory)
app.get("/public/*", async (c) => {
  const path = c.req.path.replace("/public/", "");
  const file = Bun.file(`./public/${path}`);
  if (await file.exists()) {
    const contentType = path.endsWith(".js")
      ? "application/javascript"
      : path.endsWith(".css")
        ? "text/css"
        : "text/plain";
    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  }
  return c.notFound();
});

// Mount routes
app.route("/", routes);

// =============================================================================
// START MONITORING LOOP
// =============================================================================

// Start the main monitoring loop (runs in background)
startMonitoringLoop().catch((error) => {
  log.error({ error }, "Monitoring loop crashed");
});

// =============================================================================
// START SERVER
// =============================================================================

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

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

const shutdown = (signal: string) => {
  log.info({ signal }, `${signal} received. Shutting down gracefully...`);

  // Stop monitoring loop
  stopMonitoringLoop();

  // Close MQTT client
  disconnectMqttClient();

  // Clear ventilator timers
  clearAllTimers();

  // Close SSE connections
  disconnectAllClients();

  log.info("Shutdown complete");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// --- Example usage (run with: bun src/index.ts) ---
// Server starts automatically with Bun's default export pattern.
// Visit: http://localhost:8083
// Health: http://localhost:8083/api/health
