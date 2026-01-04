/**
 * Notifications Service Integration Tests
 *
 * Tests Notification service with mocked WAHA API.
 *
 * @see TESTING.md - T4 (Mock External Dependencies at Service Boundary)
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock config before importing service
vi.mock("../../config.js", () => ({
  config: {
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
  },
  getNotificationConfig: vi.fn(() => ({
    serverUrl: "http://waha.test",
    apiKey: "test-api-key",
    phoneNumber: "31612345678",
  })),
}));

// Mock logger to reduce noise in tests
vi.mock("../../logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  }),
}));

import { getNotificationConfig } from "../../config.js";
// Import after mocks
import {
  getCooldownState,
  resetCooldownState,
  sendCustomNotification,
  sendSafetyShutdownNotification,
  sendTemperatureNotification,
  sendWhatsAppMessage,
} from "../service.js";

describe("Notifications Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    resetCooldownState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // sendWhatsAppMessage
  // ===========================================================================

  describe("sendWhatsAppMessage", () => {
    test("sends message to WAHA API with correct format", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }),
      );

      // Act
      const result = await sendWhatsAppMessage("Test message");

      // Assert
      expect(result.isOk()).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "http://waha.test/api/sendText",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-API-Key": "test-api-key",
          }),
        }),
      );

      // Verify request body
      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs?.[1]?.body as string);
      expect(body.chatId).toBe("31612345678@c.us");
      expect(body.text).toBe("Test message");
    });

    test("returns error when notifications are not configured", async () => {
      // Arrange
      vi.mocked(getNotificationConfig).mockReturnValue(null);

      // Act
      const result = await sendWhatsAppMessage("Test message");

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("NOT_CONFIGURED");
    });

    test("returns SEND_FAILED when WAHA API returns error", async () => {
      // Arrange
      vi.mocked(getNotificationConfig).mockReturnValue({
        serverUrl: "http://waha.test",
        apiKey: "test-api-key",
        phoneNumber: "31612345678",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 422,
          text: () => Promise.resolve("Session is STOPPED"),
        }),
      );

      // Act
      const result = await sendWhatsAppMessage("Test message");

      // Assert
      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.type).toBe("SEND_FAILED");
      if (error.type === "SEND_FAILED") {
        expect(error.statusCode).toBe(422);
      }
    });

    test("returns NETWORK_ERROR when fetch throws", async () => {
      // Arrange
      vi.mocked(getNotificationConfig).mockReturnValue({
        serverUrl: "http://waha.test",
        apiKey: "test-api-key",
        phoneNumber: "31612345678",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Connection refused")),
      );

      // Act
      const result = await sendWhatsAppMessage("Test message");

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("NETWORK_ERROR");
    });
  });

  // ===========================================================================
  // sendTemperatureNotification
  // ===========================================================================

  describe("sendTemperatureNotification", () => {
    beforeEach(() => {
      vi.mocked(getNotificationConfig).mockReturnValue({
        serverUrl: "http://waha.test",
        apiKey: "test-api-key",
        phoneNumber: "31612345678",
      });
    });

    test("sends temperature notification with formatted message", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }),
      );

      // Act
      const result = await sendTemperatureNotification(85);

      // Assert
      expect(result.isOk()).toBe(true);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs?.[1]?.body as string);
      expect(body.text).toContain("85");
      expect(body.text).toContain("°C");
    });

    test("respects cooldown period", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }),
      );

      // Act - send first notification
      const result1 = await sendTemperatureNotification(85);

      // Act - send second notification immediately (should be rate limited)
      const result2 = await sendTemperatureNotification(86);

      // Assert
      expect(result1.isOk()).toBe(true);
      expect(result2.isErr()).toBe(true);
      expect(result2._unsafeUnwrapErr().type).toBe("RATE_LIMITED");

      // Only one API call should have been made
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test("updates cooldown state after successful send", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }),
      );

      // Initial state should have no cooldown
      const beforeState = getCooldownState();
      expect(beforeState.temperature).toBe(0);

      // Act
      await sendTemperatureNotification(85);

      // Assert - cooldown state should be updated
      const afterState = getCooldownState();
      expect(afterState.temperature).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // sendSafetyShutdownNotification
  // ===========================================================================

  describe("sendSafetyShutdownNotification", () => {
    beforeEach(() => {
      vi.mocked(getNotificationConfig).mockReturnValue({
        serverUrl: "http://waha.test",
        apiKey: "test-api-key",
        phoneNumber: "31612345678",
      });
    });

    test("sends safety shutdown notification with phase info", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }),
      );

      // Act
      const result = await sendSafetyShutdownNotification([
        "L1 (26A)",
        "L3 (28A)",
      ]);

      // Assert
      expect(result.isOk()).toBe(true);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs?.[1]?.body as string);
      expect(body.text).toContain("L1");
      expect(body.text).toContain("L3");
    });

    test("respects cooldown period", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }),
      );

      // Act
      const result1 = await sendSafetyShutdownNotification(["L1"]);
      const result2 = await sendSafetyShutdownNotification(["L2"]);

      // Assert
      expect(result1.isOk()).toBe(true);
      expect(result2.isErr()).toBe(true);
      expect(result2._unsafeUnwrapErr().type).toBe("RATE_LIMITED");
    });
  });

  // ===========================================================================
  // sendCustomNotification
  // ===========================================================================

  describe("sendCustomNotification", () => {
    beforeEach(() => {
      vi.mocked(getNotificationConfig).mockReturnValue({
        serverUrl: "http://waha.test",
        apiKey: "test-api-key",
        phoneNumber: "31612345678",
      });
    });

    test("sends custom message without cooldown", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }),
      );

      // Act - send multiple custom notifications
      const result1 = await sendCustomNotification("Message 1");
      const result2 = await sendCustomNotification("Message 2");
      const result3 = await sendCustomNotification("Message 3");

      // Assert - all should succeed (no rate limiting)
      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      expect(result3.isOk()).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    test("sends exact message text provided", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }),
      );
      const customMessage = "Test notification from Sauna Control System";

      // Act
      await sendCustomNotification(customMessage);

      // Assert
      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs?.[1]?.body as string);
      expect(body.text).toBe(customMessage);
    });
  });
});
