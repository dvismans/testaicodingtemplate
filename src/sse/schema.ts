import type { SaunaDoorStatus, SaunaTemperature } from "../mqtt/index.js";
/**
 * SSE Module - Schemas and Types
 *
 * Defines the event types for Server-Sent Events.
 *
 * @see Rule #4 (Data First)
 */
import type { PhaseData } from "../smart-meter/index.js";

// =============================================================================
// SSE Event Types
// =============================================================================

/**
 * MCB status event.
 */
export type McbStatusEvent = Readonly<{
  type: "mcb_status";
  status: "ON" | "OFF" | "UNKNOWN";
  source: "polling" | "command" | "auto_safety" | "flic" | "mqtt";
}>;

/**
 * Sensor data event (smart meter amperage).
 */
export type SensorDataEvent = Readonly<{
  type: "sensor_data";
  l1: number | null;
  l2: number | null;
  l3: number | null;
}>;

/**
 * Temperature event (Ruuvi sensor).
 */
export type TemperatureEvent = Readonly<{
  type: "temperature";
  temperature: number;
  humidity: number | null;
}>;

/**
 * Door status event.
 */
export type DoorEvent = Readonly<{
  type: "door";
  isOpen: boolean;
}>;

/**
 * Ventilator status event.
 */
export type VentilatorEvent = Readonly<{
  type: "ventilator";
  status: boolean;
  delayedOffRemaining: number | null;
}>;

/**
 * Connection status event.
 */
export type ConnectionEvent = Readonly<{
  type: "connection";
  connected: boolean;
}>;

/**
 * System state snapshot (initial state on connect).
 */
export type SystemStateEvent = Readonly<{
  type: "system_state";
  mcbStatus: "ON" | "OFF" | "UNKNOWN";
  phaseData: PhaseData | null;
  temperature: SaunaTemperature | null;
  doorStatus: SaunaDoorStatus | null;
  ventilatorOn: boolean;
}>;

/**
 * Union of all SSE event types.
 */
export type SseEvent =
  | McbStatusEvent
  | SensorDataEvent
  | TemperatureEvent
  | DoorEvent
  | VentilatorEvent
  | ConnectionEvent
  | SystemStateEvent;
