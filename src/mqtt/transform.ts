/**
 * MQTT Module - Pure Transformations
 *
 * Pure functions for parsing MQTT messages.
 * No side effects, no I/O - just data in, data out.
 *
 * @see Rule #5 (Pure Transformations), #8 (Immutability)
 */
import type {
  DoorMessage,
  FlicButtonEvent,
  FlicMessage,
  MqttPhaseData,
  PhaseAccumulator,
  PhaseField,
  RuuviMessage,
  SaunaDoorStatus,
  SaunaTemperature,
  VentilatorMqttMessage,
  VentilatorMqttStatus,
} from "./schema.js";
import {
  DoorMessageSchema,
  FlicMessageSchema,
  RuuviMessageSchema,
  VentilatorMqttMessageSchema,
} from "./schema.js";

// =============================================================================
// Ruuvi Temperature Parsing
// =============================================================================

/**
 * Parse a raw MQTT message as Ruuvi temperature data.
 *
 * @param payload - Raw message payload (Buffer or string)
 * @param now - Current timestamp in ms
 * @returns Parsed temperature or null if invalid
 */
export function parseRuuviMessage(
  payload: unknown,
  now: number,
): SaunaTemperature | null {
  const data = parseJsonPayload(payload);
  if (!data) return null;

  const parsed = RuuviMessageSchema.safeParse(data);
  if (!parsed.success) return null;

  const msg = parsed.data;

  return {
    temperature: msg.temp,
    humidity: msg.humidity ?? null,
    pressure: msg.pressure ?? null,
    batteryVoltageMv: msg.batt ?? null,
    rssi: msg.rssi ?? null,
    lastUpdate: now,
  };
}

// =============================================================================
// Door Sensor Parsing
// =============================================================================

/**
 * Parse a raw MQTT message as door sensor data.
 *
 * @param payload - Raw message payload (Buffer or string)
 * @param now - Current timestamp in ms
 * @returns Parsed door status or null if invalid
 */
export function parseDoorMessage(
  payload: unknown,
  now: number,
): SaunaDoorStatus | null {
  const data = parseJsonPayload(payload);
  if (!data) return null;

  const parsed = DoorMessageSchema.safeParse(data);
  if (!parsed.success) return null;

  const msg = parsed.data;

  return {
    isOpen: msg.Window === 1,
    batteryPercent: msg.Battery ?? null,
    lastUpdate: now,
  };
}

// =============================================================================
// Ventilator MQTT Status Parsing
// =============================================================================

/**
 * Parse a raw MQTT message as ventilator status.
 *
 * Handles multiple Shelly MQTT formats.
 *
 * @param payload - Raw message payload (Buffer or string)
 * @param now - Current timestamp in ms
 * @returns Parsed ventilator status or null if invalid
 */
export function parseVentilatorMessage(
  payload: unknown,
  now: number,
): VentilatorMqttStatus | null {
  const data = parseJsonPayload(payload);
  if (!data) return null;

  const parsed = VentilatorMqttMessageSchema.safeParse(data);
  if (!parsed.success) return null;

  const msg = parsed.data;
  let status: boolean | null = null;

  // Handle different Shelly message formats
  if ("output" in msg) {
    status = msg.output;
  } else if ("switch:0" in msg) {
    status = msg["switch:0"].output;
  } else if ("status" in msg) {
    status = msg.status;
  } else if ("state" in msg) {
    status = msg.state.toLowerCase() === "on";
  }

  if (status === null) return null;

  return {
    status,
    lastUpdate: now,
  };
}

// =============================================================================
// Phase Data Parsing (Smart Meter via MQTT - Individual Topics)
// =============================================================================

/**
 * Extract phase field name from MQTT topic.
 * Topic format: p1monitor/phase/l1_a, p1monitor/phase/l2_a, etc.
 *
 * @param topic - Full MQTT topic
 * @returns Phase field name or null if not a phase amperage topic
 */
export function extractPhaseField(topic: string): PhaseField | null {
  const lowerTopic = topic.toLowerCase();

  if (lowerTopic.endsWith("/l1_a")) return "l1_a";
  if (lowerTopic.endsWith("/l2_a")) return "l2_a";
  if (lowerTopic.endsWith("/l3_a")) return "l3_a";

  return null;
}

/**
 * Parse a raw MQTT payload as a numeric value (amperage).
 * P1 Monitor publishes plain numbers to individual topics.
 *
 * @param payload - Raw message payload (Buffer or string)
 * @returns Parsed number or null if invalid
 */
export function parsePhaseValue(payload: unknown): number | null {
  let str: string;

  if (Buffer.isBuffer(payload)) {
    str = payload.toString().trim();
  } else if (typeof payload === "string") {
    str = payload.trim();
  } else {
    return null;
  }

  const value = Number.parseFloat(str);
  return Number.isNaN(value) ? null : value;
}

/**
 * Update phase accumulator with a new value.
 *
 * @param accumulator - Current accumulator state
 * @param field - Which phase field to update
 * @param value - New value
 * @param now - Current timestamp
 * @returns Updated accumulator
 */
export function updatePhaseAccumulator(
  accumulator: PhaseAccumulator,
  field: PhaseField,
  value: number,
  now: number,
): PhaseAccumulator {
  return {
    ...accumulator,
    [field]: value,
    lastUpdate: now,
  };
}

/**
 * Convert phase accumulator to MqttPhaseData if all values are present.
 *
 * @param accumulator - Current accumulator state
 * @returns Complete phase data or null if any value is missing
 */
export function accumulatorToPhaseData(
  accumulator: PhaseAccumulator,
): MqttPhaseData | null {
  if (
    accumulator.l1_a === null ||
    accumulator.l2_a === null ||
    accumulator.l3_a === null
  ) {
    return null;
  }

  return {
    l1: accumulator.l1_a,
    l2: accumulator.l2_a,
    l3: accumulator.l3_a,
    lastUpdate: accumulator.lastUpdate,
  };
}

/**
 * Legacy function for backward compatibility with tests.
 * Parses a JSON message with all phase fields (not used by P1 Monitor).
 */
export function parsePhaseMessage(
  payload: unknown,
  now: number,
): MqttPhaseData | null {
  const data = parseJsonPayload(payload);
  if (!data) return null;

  // Access via bracket notation to satisfy both TypeScript's noPropertyAccessFromIndexSignature
  // and store in typed variables
  const l1Raw = data["l1_a" as keyof typeof data];
  const l2Raw = data["l2_a" as keyof typeof data];
  const l3Raw = data["l3_a" as keyof typeof data];

  const l1 = typeof l1Raw === "number" ? l1Raw : null;
  const l2 = typeof l2Raw === "number" ? l2Raw : null;
  const l3 = typeof l3Raw === "number" ? l3Raw : null;

  if (l1 === null || l2 === null || l3 === null) return null;

  return { l1, l2, l3, lastUpdate: now };
}

// =============================================================================
// Flic Button Parsing
// =============================================================================

/**
 * Parse a raw MQTT message as Flic button event.
 *
 * @param payload - Raw message payload (Buffer or string)
 * @param now - Current timestamp in ms
 * @returns Parsed button event or null if invalid
 */
export function parseFlicMessage(
  payload: unknown,
  now: number,
): FlicButtonEvent | null {
  const data = parseJsonPayload(payload);
  if (!data) return null;

  const parsed = FlicMessageSchema.safeParse(data);
  if (!parsed.success) return null;

  const msg = parsed.data;

  // Normalize action
  const action = normalizeFlicAction(msg.action);

  return {
    action,
    buttonId: msg.button_id ?? null,
    timestamp: now,
  };
}

/**
 * Normalize Flic action string to typed action.
 */
function normalizeFlicAction(
  action: string,
): "click" | "double_click" | "hold" | "unknown" {
  const normalized = action.toLowerCase().replace(/-/g, "_");

  switch (normalized) {
    case "click":
    case "single_click":
      return "click";
    case "double_click":
    case "doubleclick":
      return "double_click";
    case "hold":
    case "long_press":
      return "hold";
    default:
      return "unknown";
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse JSON from Buffer or string payload.
 *
 * @param payload - Raw payload from MQTT
 * @returns Parsed JSON object or null if invalid
 */
function parseJsonPayload(payload: unknown): Record<string, unknown> | null {
  try {
    let str: string;

    if (Buffer.isBuffer(payload)) {
      str = payload.toString();
    } else if (typeof payload === "string") {
      str = payload;
    } else {
      return null;
    }

    const parsed = JSON.parse(str);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Determine message type from MQTT topic.
 */
export type MqttMessageType =
  | "door"
  | "ruuvi"
  | "ventilator"
  | "flic"
  | "phase"
  | "unknown";

/**
 * Determine the message type from MQTT topic path.
 *
 * @param topic - Full MQTT topic
 * @returns Message type
 */
export function getMessageType(topic: string): MqttMessageType {
  const lowerTopic = topic.toLowerCase();

  if (lowerTopic.includes("/door")) {
    return "door";
  }
  if (lowerTopic.includes("/ruuvi")) {
    return "ruuvi";
  }
  if (lowerTopic.includes("/ventilator")) {
    return "ventilator";
  }
  if (lowerTopic.includes("/flic")) {
    return "flic";
  }
  if (lowerTopic.includes("p1monitor/phase") || lowerTopic.includes("/phase")) {
    return "phase";
  }

  return "unknown";
}
