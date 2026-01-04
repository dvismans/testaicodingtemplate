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

  return "unknown";
}
