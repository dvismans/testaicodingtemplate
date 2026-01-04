/**
 * Smart Meter Transform Tests
 *
 * Tests for pure transformation functions.
 *
 * @see Rule #15 (Every Transformation Gets a Test)
 */
import { describe, expect, it } from "vitest";

import type { PhaseData, SmartMeterRawResponse } from "../schema.js";
import {
  checkThresholds,
  formatThresholdResult,
  getMaxAmperage,
  getPhaseAmperage,
  getTotalAmperage,
  parseSmartMeterResponse,
} from "../transform.js";

describe("Smart Meter Transform", () => {
  // ===========================================================================
  // Threshold Checking
  // ===========================================================================

  describe("checkThresholds", () => {
    it("returns exceeds: false when all phases are below threshold", () => {
      const data: PhaseData = { l1: 10, l2: 15, l3: 20 };
      const result = checkThresholds(data, 25);

      expect(result).toEqual({ exceeds: false });
    });

    it("returns exceeds: true with L1 when L1 exceeds threshold", () => {
      const data: PhaseData = { l1: 30, l2: 15, l3: 20 };
      const result = checkThresholds(data, 25);

      expect(result).toEqual({
        exceeds: true,
        phases: [{ phase: "L1", amperage: 30 }],
      });
    });

    it("returns exceeds: true with multiple phases when multiple exceed", () => {
      const data: PhaseData = { l1: 30, l2: 28, l3: 20 };
      const result = checkThresholds(data, 25);

      expect(result).toEqual({
        exceeds: true,
        phases: [
          { phase: "L1", amperage: 30 },
          { phase: "L2", amperage: 28 },
        ],
      });
    });

    it("returns exceeds: true with all phases when all exceed", () => {
      const data: PhaseData = { l1: 30, l2: 28, l3: 26 };
      const result = checkThresholds(data, 25);

      expect(result).toEqual({
        exceeds: true,
        phases: [
          { phase: "L1", amperage: 30 },
          { phase: "L2", amperage: 28 },
          { phase: "L3", amperage: 26 },
        ],
      });
    });

    it("does not include phases exactly at threshold", () => {
      const data: PhaseData = { l1: 25, l2: 25, l3: 25 };
      const result = checkThresholds(data, 25);

      expect(result).toEqual({ exceeds: false });
    });
  });

  describe("formatThresholdResult", () => {
    it("formats non-exceeding result", () => {
      const result = formatThresholdResult({ exceeds: false });

      expect(result).toBe("No phases exceeded threshold");
    });

    it("formats single phase exceeded", () => {
      const result = formatThresholdResult({
        exceeds: true,
        phases: [{ phase: "L2", amperage: 30 }],
      });

      expect(result).toBe("L2 (30A)");
    });

    it("formats multiple phases exceeded", () => {
      const result = formatThresholdResult({
        exceeds: true,
        phases: [
          { phase: "L1", amperage: 30 },
          { phase: "L3", amperage: 27 },
        ],
      });

      expect(result).toBe("L1 (30A), L3 (27A)");
    });
  });

  // ===========================================================================
  // Response Parsing
  // ===========================================================================

  describe("parseSmartMeterResponse", () => {
    it("parses valid response with numeric values", () => {
      // Create a mock response with 14 elements (indices 0-13)
      const reading = new Array(14).fill(0);
      reading[11] = 15; // L1
      reading[12] = 20; // L2
      reading[13] = 18; // L3
      const response: SmartMeterRawResponse = [reading];

      const result = parseSmartMeterResponse(response);

      expect(result).toEqual({ l1: 15, l2: 20, l3: 18 });
    });

    it("parses valid response with string values", () => {
      const reading = new Array(14).fill("0");
      reading[11] = "15";
      reading[12] = "20";
      reading[13] = "18";
      const response: SmartMeterRawResponse = [reading];

      const result = parseSmartMeterResponse(response);

      expect(result).toEqual({ l1: 15, l2: 20, l3: 18 });
    });

    it("returns null for empty array", () => {
      const result = parseSmartMeterResponse([]);

      expect(result).toBeNull();
    });

    it("returns null for array with too few elements", () => {
      const response: SmartMeterRawResponse = [[1, 2, 3]]; // Only 3 elements

      const result = parseSmartMeterResponse(response);

      expect(result).toBeNull();
    });

    it("handles null values as 0", () => {
      const reading = new Array(14).fill(0);
      reading[11] = null;
      reading[12] = 20;
      reading[13] = null;
      const response: SmartMeterRawResponse = [reading];

      const result = parseSmartMeterResponse(response);

      expect(result).toEqual({ l1: 0, l2: 20, l3: 0 });
    });

    it("uses first reading when multiple are present", () => {
      const reading1 = new Array(14).fill(0);
      reading1[11] = 15;
      reading1[12] = 20;
      reading1[13] = 18;

      const reading2 = new Array(14).fill(0);
      reading2[11] = 1;
      reading2[12] = 2;
      reading2[13] = 3;

      const response: SmartMeterRawResponse = [reading1, reading2];

      const result = parseSmartMeterResponse(response);

      expect(result).toEqual({ l1: 15, l2: 20, l3: 18 });
    });
  });

  // ===========================================================================
  // Phase Utilities
  // ===========================================================================

  describe("getPhaseAmperage", () => {
    const data: PhaseData = { l1: 10, l2: 20, l3: 30 };

    it("returns L1 amperage", () => {
      expect(getPhaseAmperage(data, "L1")).toBe(10);
    });

    it("returns L2 amperage", () => {
      expect(getPhaseAmperage(data, "L2")).toBe(20);
    });

    it("returns L3 amperage", () => {
      expect(getPhaseAmperage(data, "L3")).toBe(30);
    });
  });

  describe("getTotalAmperage", () => {
    it("calculates sum of all phases", () => {
      const data: PhaseData = { l1: 10, l2: 20, l3: 30 };

      expect(getTotalAmperage(data)).toBe(60);
    });

    it("handles zero values", () => {
      const data: PhaseData = { l1: 0, l2: 0, l3: 0 };

      expect(getTotalAmperage(data)).toBe(0);
    });
  });

  describe("getMaxAmperage", () => {
    it("returns phase with highest amperage", () => {
      const data: PhaseData = { l1: 10, l2: 30, l3: 20 };

      const result = getMaxAmperage(data);

      expect(result).toEqual({ phase: "L2", amperage: 30 });
    });

    it("returns first phase when all equal", () => {
      const data: PhaseData = { l1: 20, l2: 20, l3: 20 };

      const result = getMaxAmperage(data);

      expect(result).toEqual({ phase: "L1", amperage: 20 });
    });

    it("handles L3 being highest", () => {
      const data: PhaseData = { l1: 10, l2: 20, l3: 50 };

      const result = getMaxAmperage(data);

      expect(result).toEqual({ phase: "L3", amperage: 50 });
    });
  });
});
