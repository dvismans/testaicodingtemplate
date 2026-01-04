/**
 * API Routes Integration Tests
 *
 * Tests API endpoints with mocked service layer.
 * Uses Hono's app.request() for realistic HTTP testing.
 *
 * @see TESTING.md - T3 (Test API Endpoints with Real Routing)
 */
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// Mock the service layer modules BEFORE importing routes
vi.mock("../../mcb/index.js", () => ({
  getMcbStatus: vi.fn(),
  turnMcbOn: vi.fn(),
  turnMcbOff: vi.fn(),
  formatMcbError: vi.fn((err) => err.message || "Unknown error"),
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
import { ok, err } from "neverthrow";
import { routes } from "../routes.js";
import { getMcbStatus, turnMcbOn, turnMcbOff } from "../../mcb/index.js";
import { sendCustomNotification } from "../../notifications/index.js";
import { getClientCount } from "../../sse/index.js";

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
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
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
        err({ type: "STATUS_UNAVAILABLE", message: "Connection refused", source: "local" })
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
      vi.mocked(turnMcbOn).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/mcb/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe("ON");
      expect(turnMcbOn).toHaveBeenCalledTimes(1);
    });

    test("returns error status when Tuya Cloud API fails", async () => {
      // Arrange
      vi.mocked(turnMcbOn).mockResolvedValue(
        err({ type: "COMMAND_FAILED", message: "Tuya API timeout", command: "TURN_ON" })
      );

      // Act
      const res = await app.request("/api/mcb/on", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(body.success).toBe(false);
    });

    test("returns error status when authentication fails", async () => {
      // Arrange
      vi.mocked(turnMcbOn).mockResolvedValue(
        err({ type: "AUTH_FAILED", message: "Invalid access token" })
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
      vi.mocked(turnMcbOff).mockResolvedValue(ok(true));

      // Act
      const res = await app.request("/api/mcb/off", { method: "POST" });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe("OFF");
      expect(turnMcbOff).toHaveBeenCalledTimes(1);
    });

    test("returns error status when command fails", async () => {
      // Arrange
      vi.mocked(turnMcbOff).mockResolvedValue(
        err({ type: "NETWORK_ERROR", message: "Connection timeout" })
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
  // Notifications
  // ===========================================================================

  // NOTE: Notification endpoint tests require complex mock setup.
  // The notification service is tested separately in notifications/__tests__/service.test.ts

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

