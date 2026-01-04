/**
 * Smart Meter Service Integration Tests
 *
 * Tests Smart Meter service with mocked external API.
 *
 * @see TESTING.md - T4 (Mock External Dependencies at Service Boundary)
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock config before importing service
vi.mock("../../config.js", () => ({
  config: {
    SMART_METER_URL: "http://192.168.68.85/api/v1/phase",
    SMART_METER_API_KEY: "test-api-key",
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
  },
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

// Import after mocks
import { pollSmartMeter } from "../service.js";

describe("Smart Meter Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // pollSmartMeter
  // ===========================================================================

  // Helper to create a valid smart meter reading array
  function createReading(
    l1: number,
    l2: number,
    l3: number,
  ): (string | number | null)[] {
    const reading = new Array(14).fill(0);
    reading[11] = l1; // L1
    reading[12] = l2; // L2
    reading[13] = l3; // L3
    return reading;
  }

  describe("pollSmartMeter", () => {
    test("returns phase data when API responds with valid data", async () => {
      // Arrange - API returns array with reading (array of values, indices 11-13 are phases)
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([createReading(15.5, 8.2, 12.0)]),
        }),
      );

      // Act
      const result = await pollSmartMeter();

      // Assert
      expect(result.isOk()).toBe(true);
      const phaseData = result._unsafeUnwrap();
      expect(phaseData.l1).toBe(15.5);
      expect(phaseData.l2).toBe(8.2);
      expect(phaseData.l3).toBe(12.0);
    });

    test("includes correct API key header in request", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([createReading(10, 10, 10)]),
        }),
      );

      // Act
      await pollSmartMeter();

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("http://192.168.68.85/api/v1/phase"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-APIkey": "test-api-key",
          }),
        }),
      );
    });

    test("includes limit and sort query parameters", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([createReading(10, 10, 10)]),
        }),
      );

      // Act
      await pollSmartMeter();

      // Assert
      const calls = vi.mocked(fetch).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const calledUrl = calls[0]?.[0] as string;
      expect(calledUrl).toContain("limit=1");
      expect(calledUrl).toContain("sort=desc");
    });

    test("returns NETWORK_ERROR when API returns non-OK status", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      // Act
      const result = await pollSmartMeter();

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("NETWORK_ERROR");
      expect(result._unsafeUnwrapErr().message).toContain("500");
    });

    test("returns NETWORK_ERROR when fetch throws", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Connection refused")),
      );

      // Act
      const result = await pollSmartMeter();

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("NETWORK_ERROR");
    });

    test("returns NETWORK_ERROR with specific message on timeout", async () => {
      // Arrange
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "TimeoutError";
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));

      // Act
      const result = await pollSmartMeter();

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("NETWORK_ERROR");
      expect(result._unsafeUnwrapErr().message).toContain("timed out");
    });

    test("returns INVALID_RESPONSE when API returns empty array", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        }),
      );

      // Act
      const result = await pollSmartMeter();

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("INVALID_RESPONSE");
    });

    test("returns INVALID_RESPONSE when API returns malformed data", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ not: "an array" }),
        }),
      );

      // Act
      const result = await pollSmartMeter();

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("INVALID_RESPONSE");
    });

    test("handles zero amperage values correctly", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([createReading(0, 0, 0)]),
        }),
      );

      // Act
      const result = await pollSmartMeter();

      // Assert
      expect(result.isOk()).toBe(true);
      const phaseData = result._unsafeUnwrap();
      expect(phaseData.l1).toBe(0);
      expect(phaseData.l2).toBe(0);
      expect(phaseData.l3).toBe(0);
    });

    test("handles high amperage values correctly", async () => {
      // Arrange
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([createReading(32.5, 28.0, 30.2)]),
        }),
      );

      // Act
      const result = await pollSmartMeter();

      // Assert
      expect(result.isOk()).toBe(true);
      const phaseData = result._unsafeUnwrap();
      expect(phaseData.l1).toBe(32.5);
      expect(phaseData.l2).toBe(28.0);
      expect(phaseData.l3).toBe(30.2);
    });
  });
});
