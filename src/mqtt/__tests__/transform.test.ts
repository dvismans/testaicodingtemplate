/**
 * MQTT Module - Transform Tests
 *
 * Unit tests for pure MQTT message parsing functions.
 *
 * @see Rule #15 (Every Transformation Gets a Test)
 */
import { describe, expect, it } from "vitest";

import {
  getMessageType,
  parseDoorMessage,
  parseFlicMessage,
  parseRuuviMessage,
  parseVentilatorMessage,
} from "../transform.js";

// =============================================================================
// parseRuuviMessage Tests
// =============================================================================

describe("parseRuuviMessage", () => {
  const now = 1704067200000;

  it("parses valid Ruuvi message with all fields", () => {
    const payload = JSON.stringify({
      temp: 75.5,
      humidity: 15,
      pressure: 1013.25,
      batt: 2950,
      rssi: -65,
    });

    const result = parseRuuviMessage(payload, now);

    expect(result).toEqual({
      temperature: 75.5,
      humidity: 15,
      pressure: 1013.25,
      batteryVoltageMv: 2950,
      rssi: -65,
      lastUpdate: now,
    });
  });

  it("parses minimal Ruuvi message with only temp", () => {
    const payload = JSON.stringify({ temp: 85.2 });

    const result = parseRuuviMessage(payload, now);

    expect(result).toEqual({
      temperature: 85.2,
      humidity: null,
      pressure: null,
      batteryVoltageMv: null,
      rssi: null,
      lastUpdate: now,
    });
  });

  it("handles Buffer payload", () => {
    const payload = Buffer.from(JSON.stringify({ temp: 60.0 }));

    const result = parseRuuviMessage(payload, now);

    expect(result?.temperature).toBe(60.0);
  });

  it("returns null for invalid JSON", () => {
    const result = parseRuuviMessage("not json", now);
    expect(result).toBeNull();
  });

  it("returns null for missing temp field", () => {
    const payload = JSON.stringify({ humidity: 50 });

    const result = parseRuuviMessage(payload, now);
    expect(result).toBeNull();
  });

  it("returns null for non-object payload", () => {
    const result = parseRuuviMessage(JSON.stringify([1, 2, 3]), now);
    expect(result).toBeNull();
  });
});

// =============================================================================
// parseDoorMessage Tests
// =============================================================================

describe("parseDoorMessage", () => {
  const now = 1704067200000;

  it("parses door open message", () => {
    const payload = JSON.stringify({
      Window: 1,
      Battery: 95,
    });

    const result = parseDoorMessage(payload, now);

    expect(result).toEqual({
      isOpen: true,
      batteryPercent: 95,
      lastUpdate: now,
    });
  });

  it("parses door closed message", () => {
    const payload = JSON.stringify({
      Window: 0,
    });

    const result = parseDoorMessage(payload, now);

    expect(result).toEqual({
      isOpen: false,
      batteryPercent: null,
      lastUpdate: now,
    });
  });

  it("handles Buffer payload", () => {
    const payload = Buffer.from(JSON.stringify({ Window: 1 }));

    const result = parseDoorMessage(payload, now);

    expect(result?.isOpen).toBe(true);
  });

  it("returns null for missing Window field", () => {
    const payload = JSON.stringify({ Battery: 80 });

    const result = parseDoorMessage(payload, now);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const result = parseDoorMessage("invalid", now);
    expect(result).toBeNull();
  });
});

// =============================================================================
// parseVentilatorMessage Tests
// =============================================================================

describe("parseVentilatorMessage", () => {
  const now = 1704067200000;

  it("parses Gen2 output format - ON", () => {
    const payload = JSON.stringify({ output: true });

    const result = parseVentilatorMessage(payload, now);

    expect(result).toEqual({
      status: true,
      lastUpdate: now,
    });
  });

  it("parses Gen2 output format - OFF", () => {
    const payload = JSON.stringify({ output: false });

    const result = parseVentilatorMessage(payload, now);

    expect(result).toEqual({
      status: false,
      lastUpdate: now,
    });
  });

  it("parses Gen2 switch:0 format", () => {
    const payload = JSON.stringify({
      "switch:0": { output: true },
    });

    const result = parseVentilatorMessage(payload, now);

    expect(result?.status).toBe(true);
  });

  it("parses simple status format", () => {
    const payload = JSON.stringify({ status: true });

    const result = parseVentilatorMessage(payload, now);

    expect(result?.status).toBe(true);
  });

  it("parses string state format - on", () => {
    const payload = JSON.stringify({ state: "on" });

    const result = parseVentilatorMessage(payload, now);

    expect(result?.status).toBe(true);
  });

  it("parses string state format - OFF (case insensitive)", () => {
    const payload = JSON.stringify({ state: "OFF" });

    const result = parseVentilatorMessage(payload, now);

    expect(result?.status).toBe(false);
  });

  it("returns null for unknown format", () => {
    const payload = JSON.stringify({ unknown: "value" });

    const result = parseVentilatorMessage(payload, now);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const result = parseVentilatorMessage("not json", now);
    expect(result).toBeNull();
  });
});

// =============================================================================
// parseFlicMessage Tests
// =============================================================================

describe("parseFlicMessage", () => {
  const now = 1704067200000;

  it("parses click action", () => {
    const payload = JSON.stringify({
      action: "click",
      button_id: "flic-01",
    });

    const result = parseFlicMessage(payload, now);

    expect(result).toEqual({
      action: "click",
      buttonId: "flic-01",
      timestamp: now,
    });
  });

  it("parses double_click action", () => {
    const payload = JSON.stringify({ action: "double_click" });

    const result = parseFlicMessage(payload, now);

    expect(result?.action).toBe("double_click");
    expect(result?.buttonId).toBeNull();
  });

  it("parses hold action", () => {
    const payload = JSON.stringify({ action: "hold" });

    const result = parseFlicMessage(payload, now);

    expect(result?.action).toBe("hold");
  });

  it("normalizes single_click to click", () => {
    const payload = JSON.stringify({ action: "single_click" });

    const result = parseFlicMessage(payload, now);

    expect(result?.action).toBe("click");
  });

  it("normalizes long_press to hold", () => {
    const payload = JSON.stringify({ action: "long_press" });

    const result = parseFlicMessage(payload, now);

    expect(result?.action).toBe("hold");
  });

  it("normalizes doubleclick to double_click", () => {
    const payload = JSON.stringify({ action: "doubleclick" });

    const result = parseFlicMessage(payload, now);

    expect(result?.action).toBe("double_click");
  });

  it("returns unknown for unrecognized action", () => {
    const payload = JSON.stringify({ action: "triple_tap" });

    const result = parseFlicMessage(payload, now);

    expect(result?.action).toBe("unknown");
  });

  it("returns null for missing action field", () => {
    const payload = JSON.stringify({ button_id: "btn1" });

    const result = parseFlicMessage(payload, now);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const result = parseFlicMessage("invalid", now);
    expect(result).toBeNull();
  });
});

// =============================================================================
// getMessageType Tests
// =============================================================================

describe("getMessageType", () => {
  it("identifies door topic", () => {
    expect(getMessageType("homelab/sensors/sauna/door/status")).toBe("door");
  });

  it("identifies ruuvi topic", () => {
    expect(getMessageType("homelab/sensors/sauna/ruuvi/bedroom")).toBe("ruuvi");
  });

  it("identifies ventilator topic", () => {
    expect(getMessageType("homelab/sensors/sauna/ventilator/state")).toBe(
      "ventilator",
    );
  });

  it("identifies flic topic", () => {
    expect(getMessageType("homelab/controls/sauna/flic/button1")).toBe("flic");
  });

  it("returns unknown for unrecognized topic", () => {
    expect(getMessageType("some/other/topic")).toBe("unknown");
  });

  it("is case insensitive", () => {
    expect(getMessageType("homelab/sensors/sauna/DOOR/status")).toBe("door");
    expect(getMessageType("homelab/sensors/sauna/Ruuvi/temp")).toBe("ruuvi");
  });
});
