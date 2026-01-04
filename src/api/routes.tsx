/**
 * API routes for Sauna Control System.
 *
 * Routes are organized by domain:
 * - /api/health - Health check
 * - /api/mcb/* - MCB control (ON/OFF, status)
 * - /api/ventilator/* - Ventilator control
 * - /api/sensors/* - Sensor data endpoints
 * - /api/events - SSE stream for real-time updates
 * - / - Dashboard UI
 *
 * @see Rule #33 (Server Returns HTML, Not JSON)
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  config,
  getNotificationConfig,
  getVentilatorConfig,
} from "../config.js";
import { createLogger } from "../logger.js";
import {
  formatMcbError,
  getMcbStatus,
  turnMcbOff,
  turnMcbOn,
} from "../mcb/index.js";
import { getCurrentMcbStatus, getSystemState } from "../monitoring/index.js";
import { getLastDoorStatus, getLastTemperature } from "../mqtt/index.js";
import { sendCustomNotification } from "../notifications/index.js";
import {
  broadcastMcbStatus,
  createSseStream,
  getClientCount,
  removeClient,
} from "../sse/index.js";
import { BaseLayout } from "../ui/layouts/Base.jsx";
import { Dashboard } from "../ui/pages/Dashboard.jsx";
import {
  controlShellyRelay,
  getVentilatorState,
  getVentilatorStatusSummary,
} from "../ventilator/index.js";

const log = createLogger("api");

export const routes = new Hono();

// =============================================================================
// Health Check
// =============================================================================

/**
 * Health endpoint - returns system status.
 * Used by container orchestration and monitoring.
 */
routes.get("/api/health", (c) => {
  const requestId = c.get("requestId");
  log.debug({ requestId }, "Health check");

  const ventilatorConfig = getVentilatorConfig();
  const notificationConfig = getNotificationConfig();

  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    requestId,
    version: "1.0.0",
    config: {
      mcbDeviceId: config.MCB_DEVICE_ID,
      amperageThreshold: config.AMPERAGE_THRESHOLD,
      ventilatorEnabled: ventilatorConfig !== null,
      notificationsEnabled: notificationConfig !== null,
    },
    sseClients: getClientCount(),
  });
});

/**
 * Version endpoint - returns app version.
 */
routes.get("/api/version", (c) => {
  return c.json({ version: "1.0.0" });
});

// =============================================================================
// MCB Control Routes
// =============================================================================

/**
 * Get current MCB status.
 */
routes.get("/api/mcb/status", async (c) => {
  const requestId = c.get("requestId");
  log.info({ requestId }, "GET /api/mcb/status");

  const result = await getMcbStatus();

  if (result.isErr()) {
    log.error(
      { requestId, error: formatMcbError(result.error) },
      "Failed to get MCB status",
    );
    return c.json(
      {
        status: "UNKNOWN",
        error: formatMcbError(result.error),
        requestId,
      },
      503,
    );
  }

  return c.json({
    status: result.value,
    source: "local_api",
    requestId,
  });
});

/**
 * Turn MCB ON via Tuya Cloud API.
 */
routes.post("/api/mcb/on", async (c) => {
  const requestId = c.get("requestId");
  log.info({ requestId }, "POST /api/mcb/on");

  const result = await turnMcbOn();

  if (result.isErr()) {
    log.error(
      { requestId, error: formatMcbError(result.error) },
      "Failed to turn MCB ON",
    );
    return c.json(
      {
        success: false,
        message: formatMcbError(result.error),
        requestId,
      },
      500,
    );
  }

  log.info({ requestId }, "MCB turned ON successfully");

  // Broadcast to all SSE clients
  broadcastMcbStatus("ON", "command");

  return c.json({
    success: true,
    message: "MCB turned ON",
    status: "ON",
    requestId,
  });
});

/**
 * Turn MCB OFF via Tuya Cloud API.
 */
routes.post("/api/mcb/off", async (c) => {
  const requestId = c.get("requestId");
  log.info({ requestId }, "POST /api/mcb/off");

  const result = await turnMcbOff();

  if (result.isErr()) {
    log.error(
      { requestId, error: formatMcbError(result.error) },
      "Failed to turn MCB OFF",
    );
    return c.json(
      {
        success: false,
        message: formatMcbError(result.error),
        requestId,
      },
      500,
    );
  }

  log.info({ requestId }, "MCB turned OFF successfully");

  // Broadcast to all SSE clients
  broadcastMcbStatus("OFF", "command");

  return c.json({
    success: true,
    message: "MCB turned OFF",
    status: "OFF",
    requestId,
  });
});

// =============================================================================
// Ventilator Control Routes
// =============================================================================

/**
 * Get ventilator status.
 */
routes.get("/api/ventilator/status", async (c) => {
  const requestId = c.get("requestId");
  const ventilatorConfig = getVentilatorConfig();

  if (!ventilatorConfig) {
    return c.json({
      enabled: false,
      message: "Ventilator control is disabled",
      requestId,
    });
  }

  const summary = getVentilatorStatusSummary();
  return c.json({
    ...summary,
    enabled: true,
    requestId,
  });
});

/**
 * Turn ventilator ON.
 */
routes.post("/api/ventilator/on", async (c) => {
  const requestId = c.get("requestId");
  const ventilatorConfig = getVentilatorConfig();

  if (!ventilatorConfig) {
    return c.json({ success: false, error: "Ventilator not configured" }, 400);
  }

  const result = await controlShellyRelay(true, ventilatorConfig);
  if (result.isErr()) {
    return c.json({ success: false, error: result.error.message }, 500);
  }

  return c.json({ success: true, status: true, requestId });
});

/**
 * Turn ventilator OFF.
 */
routes.post("/api/ventilator/off", async (c) => {
  const requestId = c.get("requestId");
  const ventilatorConfig = getVentilatorConfig();

  if (!ventilatorConfig) {
    return c.json({ success: false, error: "Ventilator not configured" }, 400);
  }

  const result = await controlShellyRelay(false, ventilatorConfig);
  if (result.isErr()) {
    return c.json({ success: false, error: result.error.message }, 500);
  }

  return c.json({ success: true, status: false, requestId });
});

// =============================================================================
// Sensor Data Routes
// =============================================================================

/**
 * Get sauna temperature from Ruuvi sensor.
 */
routes.get("/api/sauna-temp", async (c) => {
  const requestId = c.get("requestId");
  const temp = getLastTemperature();

  if (!temp) {
    return c.json({
      temperature: null,
      humidity: null,
      lastUpdate: null,
      requestId,
    });
  }

  return c.json({
    temperature: temp.temperature,
    humidity: temp.humidity,
    lastUpdate: temp.lastUpdate,
    requestId,
  });
});

/**
 * Get door status.
 */
routes.get("/api/door-status", async (c) => {
  const requestId = c.get("requestId");
  const door = getLastDoorStatus();

  if (!door) {
    return c.json({
      isOpen: null,
      lastUpdate: null,
      requestId,
    });
  }

  return c.json({
    isOpen: door.isOpen,
    batteryPercent: door.batteryPercent,
    lastUpdate: door.lastUpdate,
    requestId,
  });
});

/**
 * Get full system state snapshot.
 */
routes.get("/api/state", async (c) => {
  const requestId = c.get("requestId");
  const state = getSystemState();

  return c.json({
    ...state,
    requestId,
  });
});

// =============================================================================
// Server-Sent Events Stream
// =============================================================================

/**
 * SSE endpoint for real-time updates.
 * Clients connect here to receive live MCB status, sensor data, etc.
 */
routes.get("/api/events", async (c) => {
  const requestId = c.get("requestId");
  log.info({ requestId }, "SSE client connecting");

  const { stream, clientId } = createSseStream();

  log.info({ requestId, clientId }, "SSE client connected");

  // Set SSE headers
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  // Send initial system state after a short delay
  setTimeout(() => {
    const state = getSystemState();
    // Initial state is sent through the main SSE broadcast system
  }, 100);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// =============================================================================
// Flic Button Endpoints
// =============================================================================

/**
 * Flic button toggle - single click.
 */
routes.post("/api/flic/toggle", async (c) => {
  const requestId = c.get("requestId");
  log.info({ requestId }, "Flic toggle triggered");

  const currentStatus = getCurrentMcbStatus();
  const targetOn = currentStatus !== "ON";

  const result = targetOn ? await turnMcbOn() : await turnMcbOff();

  if (result.isErr()) {
    return c.json({ success: false, error: formatMcbError(result.error) }, 500);
  }

  broadcastMcbStatus(targetOn ? "ON" : "OFF", "flic");
  return c.json({
    success: true,
    status: targetOn ? "ON" : "OFF",
    requestId,
  });
});

/**
 * Flic button force ON - double click.
 */
routes.post("/api/flic/on", async (c) => {
  const requestId = c.get("requestId");
  log.info({ requestId }, "Flic force ON triggered");

  const result = await turnMcbOn();

  if (result.isErr()) {
    return c.json({ success: false, error: formatMcbError(result.error) }, 500);
  }

  broadcastMcbStatus("ON", "flic");
  return c.json({ success: true, status: "ON", requestId });
});

/**
 * Flic button force OFF - hold.
 */
routes.post("/api/flic/off", async (c) => {
  const requestId = c.get("requestId");
  log.info({ requestId }, "Flic force OFF triggered");

  const result = await turnMcbOff();

  if (result.isErr()) {
    return c.json({ success: false, error: formatMcbError(result.error) }, 500);
  }

  broadcastMcbStatus("OFF", "flic");
  return c.json({ success: true, status: "OFF", requestId });
});

// =============================================================================
// Notification Test
// =============================================================================

/**
 * Test WhatsApp notification.
 */
routes.post("/api/test-waha", async (c) => {
  const requestId = c.get("requestId");
  const notificationConfig = getNotificationConfig();

  if (!notificationConfig) {
    return c.json(
      {
        success: false,
        error: "Notifications are not configured",
        requestId,
      },
      400,
    );
  }

  const result = await sendCustomNotification(
    "Test notification from Sauna Control System",
  );

  if (result.isErr()) {
    return c.json(
      {
        success: false,
        error: result.error.message,
        requestId,
      },
      500,
    );
  }

  return c.json({
    success: true,
    message: "Test notification sent",
    requestId,
  });
});

// =============================================================================
// Dashboard UI
// =============================================================================

/**
 * Main dashboard page - server-rendered HTML.
 */
routes.get("/", (c) => {
  const systemState = getSystemState();
  const ventilatorState = getVentilatorState();

  return c.html(
    <Dashboard
      mcbStatus={systemState.mcbStatus}
      temperature={systemState.temperature?.temperature ?? null}
      humidity={systemState.temperature?.humidity ?? null}
      doorOpen={systemState.doorStatus?.isOpen ?? null}
      phaseData={systemState.phaseData}
      ventilatorOn={ventilatorState.status ?? false}
    />,
  );
});
