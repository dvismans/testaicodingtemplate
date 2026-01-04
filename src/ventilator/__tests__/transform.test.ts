/**
 * Ventilator Transform Tests
 *
 * Tests for pure transformation functions.
 *
 * @see Rule #15 (Every Transformation Gets a Test)
 */
import { describe, expect, it } from "vitest";

import type { VentilatorConfig, VentilatorState } from "../schema.js";
import {
  calculateDelayEndTime,
  calculateRemainingDelayMs,
  clearDelayedOff,
  formatRemainingTime,
  resetState,
  shouldResetKeepAlive,
  startDelayedOff,
  startKeepAlive,
  stopKeepAlive,
  updateVentilatorStatus,
} from "../transform.js";

describe("Ventilator Transform", () => {
  // ===========================================================================
  // Timer Calculations
  // ===========================================================================

  describe("calculateDelayEndTime", () => {
    it("calculates end time from delay minutes", () => {
      const config: VentilatorConfig = {
        enabled: true,
        ipAddress: "192.168.1.100",
        delayOffMinutes: 60,
        keepAliveMinutes: 25,
        timeoutMs: 5000,
      };
      const now = 1000000;

      const result = calculateDelayEndTime(config, now);

      expect(result).toBe(1000000 + 60 * 60 * 1000); // now + 60 minutes in ms
    });

    it("handles short delay", () => {
      const config: VentilatorConfig = {
        enabled: true,
        ipAddress: "192.168.1.100",
        delayOffMinutes: 5,
        keepAliveMinutes: 25,
        timeoutMs: 5000,
      };
      const now = 0;

      const result = calculateDelayEndTime(config, now);

      expect(result).toBe(5 * 60 * 1000);
    });
  });

  describe("shouldResetKeepAlive", () => {
    it("returns true when interval has passed", () => {
      const lastReset = 0;
      const intervalMinutes = 25;
      const now = 25 * 60 * 1000 + 1; // Just over 25 minutes

      const result = shouldResetKeepAlive(lastReset, intervalMinutes, now);

      expect(result).toBe(true);
    });

    it("returns false when interval has not passed", () => {
      const lastReset = 0;
      const intervalMinutes = 25;
      const now = 24 * 60 * 1000; // 24 minutes

      const result = shouldResetKeepAlive(lastReset, intervalMinutes, now);

      expect(result).toBe(false);
    });

    it("returns true exactly at interval boundary", () => {
      const lastReset = 0;
      const intervalMinutes = 25;
      const now = 25 * 60 * 1000; // Exactly 25 minutes

      const result = shouldResetKeepAlive(lastReset, intervalMinutes, now);

      expect(result).toBe(true);
    });
  });

  describe("calculateRemainingDelayMs", () => {
    it("returns remaining time when timer active", () => {
      const endTime = 2000000;
      const now = 1000000;

      const result = calculateRemainingDelayMs(endTime, now);

      expect(result).toBe(1000000);
    });

    it("returns 0 when timer expired", () => {
      const endTime = 500000;
      const now = 1000000;

      const result = calculateRemainingDelayMs(endTime, now);

      expect(result).toBe(0);
    });

    it("returns 0 when no timer", () => {
      const result = calculateRemainingDelayMs(null, 1000000);

      expect(result).toBe(0);
    });
  });

  describe("formatRemainingTime", () => {
    it("formats minutes and seconds", () => {
      const remaining = 5 * 60 * 1000 + 30 * 1000; // 5:30

      const result = formatRemainingTime(remaining);

      expect(result).toBe("5:30");
    });

    it("pads seconds with leading zero", () => {
      const remaining = 10 * 60 * 1000 + 5 * 1000; // 10:05

      const result = formatRemainingTime(remaining);

      expect(result).toBe("10:05");
    });

    it("returns 0:00 for expired timer", () => {
      const result = formatRemainingTime(0);

      expect(result).toBe("0:00");
    });

    it("returns 0:00 for negative value", () => {
      const result = formatRemainingTime(-1000);

      expect(result).toBe("0:00");
    });

    it("handles hours correctly", () => {
      const remaining = 90 * 60 * 1000; // 90 minutes

      const result = formatRemainingTime(remaining);

      expect(result).toBe("90:00");
    });
  });

  // ===========================================================================
  // State Updates
  // ===========================================================================

  describe("updateVentilatorStatus", () => {
    it("updates status and lastUpdate", () => {
      const state: VentilatorState = {
        status: null,
        delayedOffEndTime: null,
        keepAliveActive: false,
        lastUpdate: null,
      };

      const result = updateVentilatorStatus(state, true, 1000000);

      expect(result.status).toBe(true);
      expect(result.lastUpdate).toBe(1000000);
      expect(result.delayedOffEndTime).toBe(null); // Unchanged
    });

    it("preserves other state properties", () => {
      const state: VentilatorState = {
        status: true,
        delayedOffEndTime: 2000000,
        keepAliveActive: true,
        lastUpdate: 500000,
      };

      const result = updateVentilatorStatus(state, false, 1000000);

      expect(result.status).toBe(false);
      expect(result.lastUpdate).toBe(1000000);
      expect(result.delayedOffEndTime).toBe(2000000); // Preserved
      expect(result.keepAliveActive).toBe(true); // Preserved
    });
  });

  describe("startDelayedOff", () => {
    it("sets delayedOffEndTime", () => {
      const state: VentilatorState = {
        status: true,
        delayedOffEndTime: null,
        keepAliveActive: true,
        lastUpdate: 1000000,
      };

      const result = startDelayedOff(state, 2000000);

      expect(result.delayedOffEndTime).toBe(2000000);
      expect(result.status).toBe(true); // Preserved
    });
  });

  describe("clearDelayedOff", () => {
    it("clears delayedOffEndTime", () => {
      const state: VentilatorState = {
        status: true,
        delayedOffEndTime: 2000000,
        keepAliveActive: true,
        lastUpdate: 1000000,
      };

      const result = clearDelayedOff(state);

      expect(result.delayedOffEndTime).toBe(null);
      expect(result.status).toBe(true); // Preserved
    });
  });

  describe("startKeepAlive", () => {
    it("sets keepAliveActive to true", () => {
      const state: VentilatorState = {
        status: true,
        delayedOffEndTime: null,
        keepAliveActive: false,
        lastUpdate: 1000000,
      };

      const result = startKeepAlive(state);

      expect(result.keepAliveActive).toBe(true);
    });
  });

  describe("stopKeepAlive", () => {
    it("sets keepAliveActive to false", () => {
      const state: VentilatorState = {
        status: true,
        delayedOffEndTime: null,
        keepAliveActive: true,
        lastUpdate: 1000000,
      };

      const result = stopKeepAlive(state);

      expect(result.keepAliveActive).toBe(false);
    });
  });

  describe("resetState", () => {
    it("returns initial state", () => {
      const result = resetState();

      expect(result).toEqual({
        status: null,
        delayedOffEndTime: null,
        keepAliveActive: false,
        lastUpdate: null,
      });
    });
  });
});
