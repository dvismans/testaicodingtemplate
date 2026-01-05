/**
 * MCB Local Module - Schemas and Types
 *
 * Type definitions for local MCB communication via tuyapi.
 *
 * @see Rule #4 (Data First)
 */

/**
 * MCB device configuration for tuyapi connection.
 */
export type McbLocalConfig = Readonly<{
  deviceId: string;
  deviceIp: string;
  localKey: string;
  protocolVersion: string;
  pollIntervalMs: number;
}>;

/**
 * Raw DPS (Data Points) from Tuya device.
 * Based on observed MCB data structure.
 */
export type McbDps = Readonly<{
  /** Switch state: true = ON, false = OFF */
  "1": boolean;
  /** Voltage in decivolts (e.g., 2283 = 228.3V) */
  "22": number;
  /** Unknown - possibly rated voltage */
  "25": number;
  /** Trip reason text */
  "101": string;
  /** Over-current threshold (A) */
  "102": number;
  /** Leakage current threshold (mA) */
  "103": number;
  /** Over-voltage threshold (V) */
  "104": number;
  /** Trip action */
  "105": string;
  /** Unknown setting */
  "106": string;
  /** Unknown value */
  "107": number;
  /** Unknown value */
  "108": number;
  /** Unknown boolean */
  "109": boolean;
}>;

/**
 * Parsed MCB status from local device.
 */
export type McbLocalStatus = Readonly<{
  isOn: boolean;
  voltage: number;
  rawDps: McbDps;
  timestamp: number;
}>;

/**
 * MCB connection state.
 */
export type McbConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * MCB local service state.
 */
export type McbLocalState = Readonly<{
  connectionState: McbConnectionState;
  lastStatus: McbLocalStatus | null;
  lastError: string | null;
}>;

/**
 * Initial state for MCB local service.
 */
export const INITIAL_MCB_LOCAL_STATE: McbLocalState = {
  connectionState: "disconnected",
  lastStatus: null,
  lastError: null,
};
