import { Hono } from "hono";
/**
 * API Routes Integration Tests
 *
 * Tests API endpoints with mocked service layer.
 * Uses Hono's app.request() for realistic HTTP testing.
 *
 * @see TESTING.md - T3 (Test API Endpoints with Real Routing)
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock the service layer modules BEFORE importing routes
vi.mock("../../mcb/index.js", () => ({
  getMcbStatus: vi.fn(),
  formatMcbError: vi.fn((err) => err.message || "Unknown error"),
}));

vi.mock("../../mcb-local/index.js", () => ({
  turnMcbOnLocal: vi.fn(),
  turnMcbOffLocal: vi.fn(),
  formatMcbLocalError: vi.fn((err) => err.message || "Unknown error"),
}));

vi.mock("../../notifications/index.js", () => ({
  sendCustomNotification: vi.fn(),
}));

vi.mock("../../monitoring/index.js", () => ({
  getSystemState: vi.fn(() => ({
    mcb: {
      mcbStatus: "OFF",
      phaseData: null,
      isMonitoring: false,
      lastStatusCheck: null,
      lastMeterPoll: null,
    },
    sensors: {
      temperature: null,
      humidity: null,
      doorOpen: null,
      lastTemperatureUpdate: null,
      lastDoorUpdate: null,
    },
    ventilator: {
      isOn: false,
      delayEndTime: null,
      keepAliveEndTime: null,
    },
    notifications: {
      safetyShutdown: 0,
      temperature: 0,
    },
    flic: {
      lastPress: null,
      lastPressTime: null,
    },
  })),
  getCurrentMcbStatus: vi.fn(() => "OFF"),
}));

vi.mock("../../mqtt/index.js", () => ({
  getLastTemperature: vi.fn(() => null),
  getLastDoorStatus: vi.fn(() => null),
}));

vi.mock("../../sse/index.js", () => ({
  getClientCount: vi.fn(() => 0),
  createSseStream: vi.fn(() => ({
    stream: new ReadableStream(),
    clientId: 1,
  })),
  removeClient: vi.fn(),
  broadcastMcbStatus: vi.fn(),
}));

vi.mock("../../ventilator/index.js", () => ({
  getVentilatorState: vi.fn(() => ({ isOn: false, delayEndTime: null })),
  getVentilatorStatusSummary: vi.fn(() => "OFF"),
  controlShellyRelay: vi.fn(),
}));

vi.mock("../../config.js", () => ({
  config: {
    MCB_DEVICE_ID: "test-device-id",
    AMPERAGE_THRESHOLD: 25,
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
  },
  getVentilatorConfig: vi.fn(() => ({
    enabled: true,
    ipAddress: "192.168.1.100",
    delayOffMinutes: 60,
    keepAliveMinutes: 25,
    timeoutMs: 5000,
  })),
  getNotificationConfig: vi.fn(() => ({
    serverUrl: "http://waha.test",
    phoneNumber: "1234567890",
  })),
}));

// Mock logger to prevent pino initialization issues
vi.mock("../../logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  }),
  logOperationStart: vi.fn(),
  logOperationComplete: vi.fn(),
  logOperationFailed: vi.fn(),
}));

// Now import the modules (after mocks are set up)
import { err, ok } from "neverthrow";
import { getNotificationConfig, getVentilatorConfig } from "../../config.js";
import { turnMcbOffLocal, turnMcbOnLocal } from "../../mcb-local/index.js";
import { getMcbStatus } from "../../mcb/index.js";
import { getCurrentMcbStatus, getSystemState } from "../../monitoring/index.js";
import { getLastDoorStatus, getLastTemperature } from "../../mqtt/index.js";
import { sendCustomNotification } from "../../notifications/index.js";
import { getClientCount } from "../../sse/index.js";
import {
  controlShellyRelay,
  getVentilatorStatusSummary,
} from "../../ventilator/index.js";
import { routes } from "../routes.js";

// Create a test app with the routes
function createTestApp() {
  const app = new Hono();

  // Add minimal middleware for requestId
  app.use("*", async (c, next) => {
    c.set("requestId", "test-request-id");
    await next();
  });

  app.route("/", routes);
  return app;
}

describe("API Routes", () => {
  let app: Hono;

  beforeEach(() => {
    // Reset all mocks to their initial state
    vi.clearAllMocks();

    // Reset mock return values to defaults (matching actual type signatures)
    vi.mocked(getVentilatorConfig).mockReturnValue({
      enabled: true,
      ipAddress: "192.168.1.100",
      delayOffMinutes: 60,
      keepAliveMinutes: 25,
      timeoutMs: 5000,
    });
    vi.mocked(getNotificationConfig).mockReturnValue({
      serverUrl: "http://waha.test",
      apiKey: "test-api-key",
      phoneNumber: "1234567890",
    });
    vi.mocked(getSystemState).mockReturnValue({
      mcbStatus: "OFF",
      phaseData: null,
      temperature: null,
      doorStatus: null,
    });
    vi.mocked(getVentilatorStatusSummary).mockReturnValue({
      enabled: true,
      status: false,
      hasDelayedOffTimer: false,
      delayedOffRemainingMs: 0,
      keepAliveActive: false,
    });
    vi.mocked(getCurrentMcbStatus).mockReturnValue("OFF");
    vi.mocked(getClientCount).mockReturnValue(0);

    // Create fresh app instance
    app = createTestApp();
  });

  // ===========================================================================
  // Health Check
  // ===========================================================================

  describe("GET /api/health", () => {
    test("returns 200 with system status", async () => {
      // Arrange
      vi.mocked(getClientCount).mockReturnValue(5);

      // Act
      const res = await app.request("/api/health");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.version).toBe("1.0.0");
      expect(body.config).toMatchObject({
        mcbDeviceId: "test-device-id",
        amperageThreshold: 25,
        ventilatorEnabled: true,
        notificationsEnabled: true,
      });
      expect(body.sseClients).toBe(5);
      expect(body.requestId).toBe("test-request-id");
    });
  });

  describe("GET /api/version", () => {
    test("returns version string", async () => {
      // Act
      const res = await app.request("/api/version");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body).toEqual({ version: "1.0.0" });
    });
  });

  // ===========================================================================
  // MCB Status
  // ===========================================================================

  describe("GET /api/mcb/status", () => {
    test("returns ON status when MCB is on", async () => {
      // Arrange
      vi.mocked(getMcbStatus).mockResolvedValue(ok("ON"));

      // Act
      const res = await app.request("/api/mcb/status");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.status).toBe("ON");
      expect(body.source).toBe("local_api");
    });

    test("returns OFF status when MCB is off", async () => {
      // Arrange
      vi.mocked(getMcbStatus).mockResolvedValue(ok("OFF"));

      // Act
      const res = await app.request("/api/mcb/status");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.status).toBe("OFF");
    });

    test("returns error status when local API is unavailable", async () => {
      // Arrange
      vi.mocked(getMcbStatus).mockResolvedValue(
        err({
          type: "STATUS_UNAVAILABLE",
          message: "Connection refused",
          source: "local",
        }),
      );

      // Act
      const res = await app.request("/api/mcb/status");
      const body = await res.json();

      // Assert - API returns 503 for service unavailable
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(body.status).toBe("UNKNOWN");
    });
  });

  // ===========================================================================
  // MCB Control - Turn ON
  // ===========================================================================

  describe("POST /api/mcb/on", () => {
    test("returns success when MCB turns on successfully", async () => {
      // Arrange
      vi.mocked(turnMcbOnLocal).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/mcb/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe("ON");
      expect(turnMcbOnLocal).toHaveBeenCalledTimes(1);
    });

    test("returns error status when command fails", async () => {
      // Arrange
      vi.mocked(turnMcbOnLocal).mockResolvedValue(
        err({
          type: "COMMAND_FAILED",
          message: "Device timeout",
          command: "on",
        }),
      );

      // Act
      const res = await app.request("/api/mcb/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(body.success).toBe(false);
    });

    test("returns error status when connection fails", async () => {
      // Arrange
      vi.mocked(turnMcbOnLocal).mockResolvedValue(
        err({ type: "CONNECTION_FAILED", message: "MCB not reachable" }),
      );

      // Act
      const res = await app.request("/api/mcb/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(body.success).toBe(false);
    });
  });

  // ===========================================================================
  // MCB Control - Turn OFF
  // ===========================================================================

  describe("POST /api/mcb/off", () => {
    test("returns success when MCB turns off successfully", async () => {
      // Arrange
      vi.mocked(turnMcbOffLocal).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/mcb/off", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe("OFF");
      expect(turnMcbOffLocal).toHaveBeenCalledTimes(1);
    });

    test("returns error status when command fails", async () => {
      // Arrange
      vi.mocked(turnMcbOffLocal).mockResolvedValue(
        err({ type: "CONNECTION_FAILED", message: "Connection timeout" }),
      );

      // Act
      const res = await app.request("/api/mcb/off", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(body.success).toBe(false);
    });
  });

  // ===========================================================================
  // Ventilator Status
  // ===========================================================================

  describe("GET /api/ventilator/status", () => {
    test("returns ventilator state when enabled", async () => {
      // Arrange
      vi.mocked(getVentilatorStatusSummary).mockReturnValue({
        enabled: true,
        status: true,
        hasDelayedOffTimer: true,
        delayedOffRemainingMs: 3600000,
        keepAliveActive: false,
      });

      // Act
      const res = await app.request("/api/ventilator/status");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.enabled).toBe(true);
      expect(body.status).toBe(true);
      expect(body.requestId).toBe("test-request-id");
    });

    test("returns disabled message when ventilator not configured", async () => {
      // Arrange
      vi.mocked(getVentilatorConfig).mockReturnValue(null);

      // Act
      const res = await app.request("/api/ventilator/status");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.enabled).toBe(false);
      expect(body.message).toBe("Ventilator control is disabled");
    });
  });

  // ===========================================================================
  // Ventilator Control - Turn ON
  // ===========================================================================

  describe("POST /api/ventilator/on", () => {
    test("returns success when ventilator turns on", async () => {
      // Arrange
      vi.mocked(controlShellyRelay).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/ventilator/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(controlShellyRelay).toHaveBeenCalledWith(true, expect.any(Object));
    });

    test("returns error when ventilator not configured", async () => {
      // Arrange
      vi.mocked(getVentilatorConfig).mockReturnValue(null);

      // Act
      const res = await app.request("/api/ventilator/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Ventilator not configured");
    });

    test("returns error when Shelly relay fails", async () => {
      // Arrange
      vi.mocked(controlShellyRelay).mockResolvedValue(
        err({ type: "NETWORK_ERROR", message: "Connection timeout" }),
      );

      // Act
      const res = await app.request("/api/ventilator/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    });
  });

  // ===========================================================================
  // Ventilator Control - Turn OFF
  // ===========================================================================

  describe("POST /api/ventilator/off", () => {
    test("returns success when ventilator turns off", async () => {
      // Arrange
      vi.mocked(controlShellyRelay).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/ventilator/off", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(controlShellyRelay).toHaveBeenCalledWith(
        false,
        expect.any(Object),
      );
    });

    test("returns error when ventilator not configured", async () => {
      // Arrange
      vi.mocked(getVentilatorConfig).mockReturnValue(null);

      // Act
      const res = await app.request("/api/ventilator/off", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  // ===========================================================================
  // Sensor Data - Temperature
  // ===========================================================================

  describe("GET /api/sauna-temp", () => {
    test("returns temperature data when available", async () => {
      // Arrange
      vi.mocked(getLastTemperature).mockReturnValue({
        temperature: 85.5,
        humidity: 12,
        pressure: null,
        batteryVoltageMv: null,
        rssi: null,
        lastUpdate: 1704326400000,
      });

      // Act
      const res = await app.request("/api/sauna-temp");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.temperature).toBe(85.5);
      expect(body.humidity).toBe(12);
      expect(body.lastUpdate).toBe(1704326400000);
    });

    test("returns null values when no temperature data", async () => {
      // Arrange
      vi.mocked(getLastTemperature).mockReturnValue(null);

      // Act
      const res = await app.request("/api/sauna-temp");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.temperature).toBeNull();
      expect(body.humidity).toBeNull();
      expect(body.lastUpdate).toBeNull();
    });
  });

  // ===========================================================================
  // Sensor Data - Door Status
  // ===========================================================================

  describe("GET /api/door-status", () => {
    test("returns door status when available", async () => {
      // Arrange
      vi.mocked(getLastDoorStatus).mockReturnValue({
        isOpen: false,
        batteryPercent: 87,
        lastUpdate: 1704326400000,
      });

      // Act
      const res = await app.request("/api/door-status");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.isOpen).toBe(false);
      expect(body.batteryPercent).toBe(87);
      expect(body.lastUpdate).toBe(1704326400000);
    });

    test("returns null values when no door data", async () => {
      // Arrange
      vi.mocked(getLastDoorStatus).mockReturnValue(null);

      // Act
      const res = await app.request("/api/door-status");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.isOpen).toBeNull();
      expect(body.lastUpdate).toBeNull();
    });
  });

  // ===========================================================================
  // System State
  // ===========================================================================

  describe("GET /api/state", () => {
    test("returns full system state", async () => {
      // Arrange - using default mock from beforeEach

      // Act
      const res = await app.request("/api/state");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.requestId).toBe("test-request-id");
      expect(body.mcbStatus).toBe("OFF");
      expect(body.phaseData).toBeNull();
      expect(body.temperature).toBeNull();
      expect(body.doorStatus).toBeNull();
    });
  });

  // ===========================================================================
  // Flic Button - Toggle
  // ===========================================================================

  describe("POST /api/flic/toggle", () => {
    test("turns MCB ON when currently OFF", async () => {
      // Arrange
      vi.mocked(getCurrentMcbStatus).mockReturnValue("OFF");
      vi.mocked(turnMcbOnLocal).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/flic/toggle", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe("ON");
      expect(turnMcbOnLocal).toHaveBeenCalledTimes(1);
      expect(turnMcbOffLocal).not.toHaveBeenCalled();
    });

    test("turns MCB OFF when currently ON", async () => {
      // Arrange
      vi.mocked(getCurrentMcbStatus).mockReturnValue("ON");
      vi.mocked(turnMcbOffLocal).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/flic/toggle", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe("OFF");
      expect(turnMcbOffLocal).toHaveBeenCalledTimes(1);
      expect(turnMcbOnLocal).not.toHaveBeenCalled();
    });

    test("returns error when toggle fails", async () => {
      // Arrange
      vi.mocked(getCurrentMcbStatus).mockReturnValue("OFF");
      vi.mocked(turnMcbOnLocal).mockResolvedValue(
        err({ type: "CONNECTION_FAILED", message: "Connection failed" }),
      );

      // Act
      const res = await app.request("/api/flic/toggle", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    });
  });

  // ===========================================================================
  // Flic Button - Force ON
  // ===========================================================================

  describe("POST /api/flic/on", () => {
    test("forces MCB ON", async () => {
      // Arrange
      vi.mocked(turnMcbOnLocal).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/flic/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe("ON");
    });

    test("returns error when force ON fails", async () => {
      // Arrange
      vi.mocked(turnMcbOnLocal).mockResolvedValue(
        err({ type: "CONNECTION_FAILED", message: "Device unreachable" }),
      );

      // Act
      const res = await app.request("/api/flic/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    });
  });

  // ===========================================================================
  // Flic Button - Force OFF
  // ===========================================================================

  describe("POST /api/flic/off", () => {
    test("forces MCB OFF", async () => {
      // Arrange
      vi.mocked(turnMcbOffLocal).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/flic/off", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe("OFF");
    });

    test("returns error when force OFF fails", async () => {
      // Arrange
      vi.mocked(turnMcbOffLocal).mockResolvedValue(
        err({
          type: "COMMAND_FAILED",
          command: "off",
          message: "Device offline",
        }),
      );

      // Act
      const res = await app.request("/api/flic/off", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    });
  });

  // ===========================================================================
  // Notifications - Test WAHA
  // ===========================================================================

  describe("POST /api/test-waha", () => {
    test("sends test notification successfully", async () => {
      // Arrange
      vi.mocked(sendCustomNotification).mockResolvedValue(ok(undefined));

      // Act
      const res = await app.request("/api/test-waha", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe("Test notification sent");
      expect(sendCustomNotification).toHaveBeenCalledWith(
        "Test notification from Sauna Control System",
      );
    });

    test("returns error when notifications not configured", async () => {
      // Arrange
      vi.mocked(getNotificationConfig).mockReturnValue(null);

      // Act
      const res = await app.request("/api/test-waha", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Notifications are not configured");
    });

    test("returns error when notification send fails", async () => {
      // Arrange
      vi.mocked(sendCustomNotification).mockResolvedValue(
        err({ type: "SEND_FAILED", message: "WAHA server unreachable" }),
      );

      // Act
      const res = await app.request("/api/test-waha", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe("WAHA server unreachable");
    });
  });

  // ===========================================================================
  // SSE Events Endpoint
  // ===========================================================================

  // NOTE: SSE endpoint tests require complex streaming setup.
  // The SSE service is tested separately in sse/__tests__/service.test.ts

  // ===========================================================================
  // Dashboard
  // ===========================================================================

  // NOTE: Dashboard test requires full JSX rendering setup with all dependencies.
  // The dashboard component and its rendering are tested via manual browser testing.
});
