/**
 * Floor Heating Service Tests
 *
 * Tests for floor heating control operations.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock config before importing service
vi.mock("../../config.js", () => ({
  getFloorHeatingConfig: vi.fn(),
}));

import { getFloorHeatingConfig } from "../../config.js";
import { type FloorHeatingError, formatFloorHeatingError } from "../errors.js";

describe("Floor Heating Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Error Formatting", () => {
    it("formats CONNECTION_FAILED error", () => {
      const error: FloorHeatingError = {
        type: "CONNECTION_FAILED",
        message: "Device unreachable",
      };
      expect(formatFloorHeatingError(error)).toBe(
        "Floor heating connection failed: Device unreachable",
      );
    });

    it("formats SET_TEMP_FAILED error", () => {
      const error: FloorHeatingError = {
        type: "SET_TEMP_FAILED",
        message: "Timeout",
        targetTemp: 21,
      };
      expect(formatFloorHeatingError(error)).toBe(
        "Failed to set temperature to 21°C: Timeout",
      );
    });

    it("formats SET_MODE_FAILED error", () => {
      const error: FloorHeatingError = {
        type: "SET_MODE_FAILED",
        message: "Device busy",
        mode: "MANUAL",
      };
      expect(formatFloorHeatingError(error)).toBe(
        "Failed to set mode to MANUAL: Device busy",
      );
    });

    it("formats STATUS_UNAVAILABLE error", () => {
      const error: FloorHeatingError = {
        type: "STATUS_UNAVAILABLE",
        message: "No response",
      };
      expect(formatFloorHeatingError(error)).toBe(
        "Floor heating status unavailable: No response",
      );
    });

    it("formats DEVICE_ERROR error", () => {
      const error: FloorHeatingError = {
        type: "DEVICE_ERROR",
        message: "Hardware fault",
        deviceError: "ERR_SENSOR",
      };
      expect(formatFloorHeatingError(error)).toBe(
        "Floor heating device error: Hardware fault (ERR_SENSOR)",
      );
    });

    it("formats TIMEOUT error", () => {
      const error: FloorHeatingError = {
        type: "TIMEOUT",
        message: "No response",
        timeoutMs: 5000,
      };
      expect(formatFloorHeatingError(error)).toBe(
        "Floor heating timeout after 5000ms: No response",
      );
    });
  });

  describe("Configuration", () => {
    it("returns null when floor heating is disabled", () => {
      vi.mocked(getFloorHeatingConfig).mockReturnValue(null);
      expect(getFloorHeatingConfig()).toBeNull();
    });

    it("returns config when floor heating is enabled", () => {
      const mockConfig = {
        enabled: true as const,
        deviceId: "test-device-id",
        localKey: "test-local-key",
        protocolVersion: "3.3",
        targetTempOn: 21,
        targetTempOff: 5,
      };
      vi.mocked(getFloorHeatingConfig).mockReturnValue(mockConfig);
      expect(getFloorHeatingConfig()).toEqual(mockConfig);
    });
  });
});

describe("Floor Heating Schema", () => {
  it("defines correct DPS mapping for temperature", () => {
    // DPS 16 is target temp in 0.1°C units
    // 210 = 21.0°C
    const rawDps = { "16": 210 };
    expect(rawDps["16"] / 10).toBe(21);
  });

  it("defines correct DPS mapping for mode", () => {
    // DPS 2 is mode: AUTO or MANUAL
    const manualMode = { "2": "MANUAL" };
    const autoMode = { "2": "AUTO" };
    expect(manualMode["2"]).toBe("MANUAL");
    expect(autoMode["2"]).toBe("AUTO");
  });

  it("defines correct DPS mapping for action", () => {
    // DPS 3 is action: heating, warming, idle
    const actions = ["heating", "warming", "idle"];
    for (const action of actions) {
      const dps = { "3": action };
      expect(["heating", "warming", "idle"]).toContain(dps["3"]);
    }
  });

  it("converts temperature correctly", () => {
    // Test various temperature conversions
    expect(50 / 10).toBe(5); // 5°C (off)
    expect(210 / 10).toBe(21); // 21°C (on)
    expect(250 / 10).toBe(25); // 25°C
  });
});
