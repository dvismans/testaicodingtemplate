/**
 * MQTT Module - Schemas and Types
 *
 * Defines the data shapes for MQTT sensor messages.
 * Schemas are the source of truth - types derived with z.infer<>.
 *
 * @see Rule #4 (Data First)
 */
import { z } from "zod";

// =============================================================================
// Ruuvi Temperature Sensor
// =============================================================================

/**
 * Raw Ruuvi sensor MQTT message.
 * Topic: homelab/sensors/sauna/ruuvi/#
 */
export const RuuviMessageSchema = z.object({
  temp: z.number().describe("Temperature in Celsius"),
  humidity: z.number().optional().describe("Relative humidity %"),
  pressure: z.number().optional().describe("Pressure in hPa"),
  batt: z.number().optional().describe("Battery voltage in mV"),
  rssi: z.number().optional().describe("Signal strength"),
});

export type RuuviMessage = z.infer<typeof RuuviMessageSchema>;

/**
 * Parsed sauna temperature data.
 */
export type SaunaTemperature = Readonly<{
  temperature: number;
  humidity: number | null;
  pressure: number | null;
  batteryVoltageMv: number | null;
  rssi: number | null;
  lastUpdate: number;
}>;

// =============================================================================
// Door Sensor
// =============================================================================

/**
 * Raw door sensor MQTT message.
 * Topic: homelab/sensors/sauna/door/#
 */
export const DoorMessageSchema = z.object({
  Window: z.number().describe("Door state: 0 = closed, 1 = open"),
  Battery: z.number().optional().describe("Battery percentage"),
});

export type DoorMessage = z.infer<typeof DoorMessageSchema>;

/**
 * Parsed sauna door status.
 */
export type SaunaDoorStatus = Readonly<{
  isOpen: boolean;
  batteryPercent: number | null;
  lastUpdate: number;
}>;

// =============================================================================
// Ventilator Status via MQTT
// =============================================================================

/**
 * Shelly ventilator MQTT status message.
 * Topic: homelab/sensors/sauna/ventilator/#
 *
 * Supports multiple Shelly MQTT formats.
 */
export const VentilatorMqttMessageSchema = z.union([
  // Gen2 format
  z.object({
    output: z.boolean(),
  }),
  // Gen2 switch:0 format
  z.object({
    "switch:0": z.object({
      output: z.boolean(),
    }),
  }),
  // Simple status format
  z.object({
    status: z.boolean(),
  }),
  // String state format
  z.object({
    state: z.string(),
  }),
]);

export type VentilatorMqttMessage = z.infer<typeof VentilatorMqttMessageSchema>;

/**
 * Parsed ventilator MQTT status.
 */
export type VentilatorMqttStatus = Readonly<{
  status: boolean;
  lastUpdate: number;
}>;

// =============================================================================
// Flic Button Events
// =============================================================================

/**
 * Flic button MQTT message.
 * Topic: homelab/controls/sauna/flic/#
 */
export const FlicMessageSchema = z.object({
  action: z
    .enum(["click", "double_click", "hold"])
    .or(z.string())
    .describe("Button action type"),
  button_id: z.string().optional().describe("Button identifier"),
});

export type FlicMessage = z.infer<typeof FlicMessageSchema>;

/**
 * Parsed Flic button event.
 */
export type FlicButtonEvent = Readonly<{
  action: "click" | "double_click" | "hold" | "unknown";
  buttonId: string | null;
  timestamp: number;
}>;

// =============================================================================
// MQTT Client State
// =============================================================================

/**
 * Current sensor state (last known values).
 */
export type SensorState = Readonly<{
  temperature: SaunaTemperature | null;
  door: SaunaDoorStatus | null;
  ventilator: VentilatorMqttStatus | null;
}>;

/**
 * Initial sensor state.
 */
export const INITIAL_SENSOR_STATE: SensorState = {
  temperature: null,
  door: null,
  ventilator: null,
};
