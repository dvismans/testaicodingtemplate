/**
 * MQTT Module - Transform Tests
 *
 * Unit tests for pure MQTT message parsing functions.
 *
 * @see Rule #15 (Every Transformation Gets a Test)
 */
import { describe, expect, it } from "vitest";

import { INITIAL_PHASE_ACCUMULATOR } from "../schema.js";
import {
  accumulatorToPhaseData,
  extractPhaseField,
  getMessageType,
  parseDoorMessage,
  parseFlicMessage,
  parseMcbMessage,
  parsePhaseMessage,
  parsePhaseValue,
  parseRuuviMessage,
  parseVentilatorMessage,
  updatePhaseAccumulator,
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
// extractPhaseField Tests
// =============================================================================

describe("extractPhaseField", () => {
  it("extracts l1_a from topic", () => {
    expect(extractPhaseField("p1monitor/phase/l1_a")).toBe("l1_a");
  });

  it("extracts l2_a from topic", () => {
    expect(extractPhaseField("p1monitor/phase/l2_a")).toBe("l2_a");
  });

  it("extracts l3_a from topic", () => {
    expect(extractPhaseField("p1monitor/phase/l3_a")).toBe("l3_a");
  });

  it("is case insensitive", () => {
    expect(extractPhaseField("P1MONITOR/PHASE/L1_A")).toBe("l1_a");
  });

  it("returns null for voltage topics", () => {
    expect(extractPhaseField("p1monitor/phase/l1_v")).toBeNull();
  });

  it("returns null for consumption topics", () => {
    expect(extractPhaseField("p1monitor/phase/consumption_l1_w")).toBeNull();
  });

  it("returns null for timestamp topics", () => {
    expect(extractPhaseField("p1monitor/phase/timestamp_local")).toBeNull();
  });
});

// =============================================================================
// parsePhaseValue Tests
// =============================================================================

describe("parsePhaseValue", () => {
  it("parses string number", () => {
    expect(parsePhaseValue("12.0")).toBe(12.0);
  });

  it("parses integer string", () => {
    expect(parsePhaseValue("15")).toBe(15);
  });

  it("parses Buffer payload", () => {
    expect(parsePhaseValue(Buffer.from("7.5"))).toBe(7.5);
  });

  it("handles whitespace", () => {
    expect(parsePhaseValue("  3.2  ")).toBe(3.2);
  });

  it("parses zero", () => {
    expect(parsePhaseValue("0")).toBe(0);
  });

  it("parses negative values", () => {
    expect(parsePhaseValue("-1.5")).toBe(-1.5);
  });

  it("returns null for non-numeric string", () => {
    expect(parsePhaseValue("not a number")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parsePhaseValue("")).toBeNull();
  });

  it("returns null for non-string/buffer input", () => {
    expect(parsePhaseValue({ value: 12 })).toBeNull();
  });
});

// =============================================================================
// updatePhaseAccumulator Tests
// =============================================================================

describe("updatePhaseAccumulator", () => {
  const now = 1704067200000;

  it("updates l1_a value", () => {
    const result = updatePhaseAccumulator(
      INITIAL_PHASE_ACCUMULATOR,
      "l1_a",
      12.0,
      now,
    );

    expect(result.l1_a).toBe(12.0);
    expect(result.l2_a).toBeNull();
    expect(result.l3_a).toBeNull();
    expect(result.lastUpdate).toBe(now);
  });

  it("updates l2_a value", () => {
    const result = updatePhaseAccumulator(
      INITIAL_PHASE_ACCUMULATOR,
      "l2_a",
      7.0,
      now,
    );

    expect(result.l1_a).toBeNull();
    expect(result.l2_a).toBe(7.0);
    expect(result.l3_a).toBeNull();
  });

  it("preserves existing values when updating", () => {
    const withL1 = updatePhaseAccumulator(
      INITIAL_PHASE_ACCUMULATOR,
      "l1_a",
      12.0,
      now,
    );
    const withL1L2 = updatePhaseAccumulator(withL1, "l2_a", 7.0, now + 1);

    expect(withL1L2.l1_a).toBe(12.0);
    expect(withL1L2.l2_a).toBe(7.0);
    expect(withL1L2.l3_a).toBeNull();
  });

  it("updates lastUpdate timestamp", () => {
    const result = updatePhaseAccumulator(
      INITIAL_PHASE_ACCUMULATOR,
      "l3_a",
      3.0,
      now + 100,
    );

    expect(result.lastUpdate).toBe(now + 100);
  });
});

// =============================================================================
// accumulatorToPhaseData Tests
// =============================================================================

describe("accumulatorToPhaseData", () => {
  const now = 1704067200000;

  it("returns null when all values are missing", () => {
    expect(accumulatorToPhaseData(INITIAL_PHASE_ACCUMULATOR)).toBeNull();
  });

  it("returns null when l1_a is missing", () => {
    const acc = {
      ...INITIAL_PHASE_ACCUMULATOR,
      l2_a: 7.0,
      l3_a: 3.0,
      lastUpdate: now,
    };
    expect(accumulatorToPhaseData(acc)).toBeNull();
  });

  it("returns null when l2_a is missing", () => {
    const acc = {
      ...INITIAL_PHASE_ACCUMULATOR,
      l1_a: 12.0,
      l3_a: 3.0,
      lastUpdate: now,
    };
    expect(accumulatorToPhaseData(acc)).toBeNull();
  });

  it("returns null when l3_a is missing", () => {
    const acc = {
      ...INITIAL_PHASE_ACCUMULATOR,
      l1_a: 12.0,
      l2_a: 7.0,
      lastUpdate: now,
    };
    expect(accumulatorToPhaseData(acc)).toBeNull();
  });

  it("returns complete phase data when all values present", () => {
    const acc = { l1_a: 12.0, l2_a: 7.0, l3_a: 3.0, lastUpdate: now };

    const result = accumulatorToPhaseData(acc);

    expect(result).toEqual({
      l1: 12.0,
      l2: 7.0,
      l3: 3.0,
      lastUpdate: now,
    });
  });

  it("handles zero values", () => {
    const acc = { l1_a: 0, l2_a: 0, l3_a: 0, lastUpdate: now };

    const result = accumulatorToPhaseData(acc);

    expect(result).toEqual({
      l1: 0,
      l2: 0,
      l3: 0,
      lastUpdate: now,
    });
  });
});

// =============================================================================
// parsePhaseMessage Tests (Legacy JSON format)
// =============================================================================

describe("parsePhaseMessage", () => {
  const now = 1704067200000;

  it("parses valid phase message with amperage data", () => {
    const payload = JSON.stringify({
      l1_a: 12.0,
      l2_a: 7.0,
      l3_a: 3.0,
    });

    const result = parsePhaseMessage(payload, now);

    expect(result).toEqual({
      l1: 12.0,
      l2: 7.0,
      l3: 3.0,
      lastUpdate: now,
    });
  });

  it("returns null for missing l1_a field", () => {
    const payload = JSON.stringify({ l2_a: 5, l3_a: 2 });
    expect(parsePhaseMessage(payload, now)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parsePhaseMessage("not json", now)).toBeNull();
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

  it("identifies p1monitor phase topic", () => {
    expect(getMessageType("p1monitor/phase")).toBe("phase");
  });

  it("identifies p1monitor phase subtopic", () => {
    expect(getMessageType("p1monitor/phase/l1_a")).toBe("phase");
    expect(getMessageType("p1monitor/phase/l2_a")).toBe("phase");
    expect(getMessageType("p1monitor/phase/l3_a")).toBe("phase");
  });

  it("returns unknown for unrecognized topic", () => {
    expect(getMessageType("some/other/topic")).toBe("unknown");
  });

  it("is case insensitive", () => {
    expect(getMessageType("homelab/sensors/sauna/DOOR/status")).toBe("door");
    expect(getMessageType("homelab/sensors/sauna/Ruuvi/temp")).toBe("ruuvi");
    expect(getMessageType("P1MONITOR/PHASE/L1_A")).toBe("phase");
  });

  it("identifies mcb topic", () => {
    expect(getMessageType("homelab/sensors/sauna/mcb/dps/1")).toBe("mcb");
    expect(getMessageType("homelab/sensors/sauna/mcb/status")).toBe("mcb");
  });
});

// =============================================================================
// parseMcbMessage Tests
// =============================================================================

describe("parseMcbMessage", () => {
  const now = 1704067200000;

  describe("parsing switch state from dps/1 topic", () => {
    it("parses 'true' as ON", () => {
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/dps/1",
        Buffer.from("true"),
        null,
        now,
      );
      expect(result).toEqual({
        isOn: true,
        voltage: null,
        lastUpdate: now,
      });
    });

    it("parses 'false' as OFF", () => {
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/dps/1",
        Buffer.from("false"),
        null,
        now,
      );
      expect(result).toEqual({
        isOn: false,
        voltage: null,
        lastUpdate: now,
      });
    });

    it("is case insensitive", () => {
      const resultTrue = parseMcbMessage(
        "homelab/sensors/sauna/mcb/dps/1",
        Buffer.from("TRUE"),
        null,
        now,
      );
      expect(resultTrue?.isOn).toBe(true);

      const resultFalse = parseMcbMessage(
        "homelab/sensors/sauna/mcb/dps/1",
        Buffer.from("FALSE"),
        null,
        now,
      );
      expect(resultFalse?.isOn).toBe(false);
    });

    it("preserves voltage from previous state", () => {
      const current = { isOn: false, voltage: 230.5, lastUpdate: 0 };
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/dps/1",
        Buffer.from("true"),
        current,
        now,
      );
      expect(result).toEqual({
        isOn: true,
        voltage: 230.5,
        lastUpdate: now,
      });
    });
  });

  describe("parsing voltage from dps/22 topic", () => {
    it("parses voltage in decivolts", () => {
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/dps/22",
        Buffer.from("2306"),
        null,
        now,
      );
      expect(result).toEqual({
        isOn: false,
        voltage: 230.6,
        lastUpdate: now,
      });
    });

    it("preserves switch state from previous state", () => {
      const current = { isOn: true, voltage: null, lastUpdate: 0 };
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/dps/22",
        Buffer.from("2285"),
        current,
        now,
      );
      expect(result).toEqual({
        isOn: true,
        voltage: 228.5,
        lastUpdate: now,
      });
    });

    it("returns null for invalid voltage", () => {
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/dps/22",
        Buffer.from("invalid"),
        null,
        now,
      );
      expect(result).toBeNull();
    });
  });

  describe("parsing full status JSON", () => {
    it("parses JSON status with switch on", () => {
      const payload = JSON.stringify({
        "1": true,
        "22": 2310,
        "25": 230,
      });
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/status",
        Buffer.from(payload),
        null,
        now,
      );
      expect(result).toEqual({
        isOn: true,
        voltage: 231.0,
        lastUpdate: now,
      });
    });

    it("parses JSON status with switch off", () => {
      const payload = JSON.stringify({
        "1": false,
        "22": 2306,
      });
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/status",
        Buffer.from(payload),
        null,
        now,
      );
      expect(result).toEqual({
        isOn: false,
        voltage: 230.6,
        lastUpdate: now,
      });
    });

    it("handles missing voltage in JSON", () => {
      const payload = JSON.stringify({ "1": true });
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/status",
        Buffer.from(payload),
        null,
        now,
      );
      expect(result).toEqual({
        isOn: true,
        voltage: null,
        lastUpdate: now,
      });
    });

    it("returns null for invalid JSON", () => {
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/status",
        Buffer.from("not-json"),
        null,
        now,
      );
      expect(result).toBeNull();
    });
  });

  describe("unrecognized topics", () => {
    it("returns null for other dps topics", () => {
      const result = parseMcbMessage(
        "homelab/sensors/sauna/mcb/dps/25",
        Buffer.from("230"),
        null,
        now,
      );
      expect(result).toBeNull();
    });

    it("returns null for unrelated topics", () => {
      const result = parseMcbMessage(
        "homelab/sensors/other/topic",
        Buffer.from("data"),
        null,
        now,
      );
      expect(result).toBeNull();
    });
  });
});
