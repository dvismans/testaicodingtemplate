/**
 * Floor Heating Module - Schemas and Types
 *
 * Type definitions for floor heating thermostat via tuyapi.
 * Device: Magnum thermostat controlled via Tuya protocol.
 *
 * @see Rule #4 (Data First)
 */

/**
 * Floor heating device configuration.
 */
export type FloorHeatingConfig = Readonly<{
  deviceId: string;
  localKey: string;
  protocolVersion: string;
  /** Target temperature when sauna is ON (°C) */
  targetTempOn: number;
  /** Target temperature when sauna is OFF (°C) - effectively standby */
  targetTempOff: number;
}>;

/**
 * Raw DPS (Data Points) from Tuya floor heating thermostat.
 * Based on Magnum thermostat configuration.
 *
 * DPS mapping:
 * - 2: Mode (AUTO/MANUAL)
 * - 3: Current action (heating/warming/idle)
 * - 16: Target temperature (in 0.1°C units, e.g., 210 = 21.0°C)
 * - 23: Temperature unit (c/f)
 * - 24: Current temperature (in 0.1°C units)
 */
export type FloorHeatingDps = Readonly<{
  /** Mode: AUTO or MANUAL */
  "2"?: string;
  /** Current action: heating, warming, idle */
  "3"?: string;
  /** Target temperature in 0.1°C units */
  "16"?: number;
  /** Temperature unit: c or f */
  "23"?: string;
  /** Current temperature in 0.1°C units */
  "24"?: number;
}>;

/**
 * Floor heating mode.
 */
export type FloorHeatingMode = "AUTO" | "MANUAL";

/**
 * Floor heating action (current state).
 */
export type FloorHeatingAction = "heating" | "warming" | "idle" | "unknown";

/**
 * Parsed floor heating status.
 */
export type FloorHeatingStatus = Readonly<{
  /** Current mode */
  mode: FloorHeatingMode | "unknown";
  /** Current action */
  action: FloorHeatingAction;
  /** Target temperature in °C */
  targetTemp: number;
  /** Current temperature in °C */
  currentTemp: number;
  /** Temperature unit */
  unit: "c" | "f";
  /** Raw DPS values */
  rawDps: FloorHeatingDps;
  /** Timestamp of last update */
  timestamp: number;
}>;

/**
 * Connection state.
 */
export type FloorHeatingConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * Floor heating service state.
 */
export type FloorHeatingState = Readonly<{
  connectionState: FloorHeatingConnectionState;
  lastStatus: FloorHeatingStatus | null;
  lastError: string | null;
}>;

/**
 * Initial state for floor heating service.
 */
export const INITIAL_FLOOR_HEATING_STATE: FloorHeatingState = {
  connectionState: "disconnected",
  lastStatus: null,
  lastError: null,
};
