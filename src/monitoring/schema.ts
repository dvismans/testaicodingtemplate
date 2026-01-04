/**
 * Monitoring Module - Schemas and Types
 *
 * Defines the state types for the main monitoring loop.
 *
 * @see Rule #4 (Data First)
 */
import type { McbStatus } from "../mcb/index.js";
import type { PhaseData } from "../smart-meter/index.js";

// =============================================================================
// Monitoring State
// =============================================================================

/**
 * Current monitoring state.
 */
export type MonitoringState = Readonly<{
  /** Current MCB status */
  mcbStatus: McbStatus;
  /** Last known phase data from smart meter */
  phaseData: PhaseData | null;
  /** Last MCB auto-shutdown timestamp (for cooldown) */
  lastSwitchOffTime: number;
  /** Whether monitoring loop is running */
  isRunning: boolean;
  /** Timestamp of last poll cycle */
  lastPollTime: number;
}>;

/**
 * Initial monitoring state.
 */
export const INITIAL_MONITORING_STATE: MonitoringState = {
  mcbStatus: "UNKNOWN",
  phaseData: null,
  lastSwitchOffTime: 0,
  isRunning: false,
  lastPollTime: 0,
};

// =============================================================================
// Flic Button Actions
// =============================================================================

/**
 * Flic button action mapping.
 */
export type FlicActionConfig = Readonly<{
  click: "toggle" | "on" | "off" | "none";
  doubleClick: "toggle" | "on" | "off" | "none";
  hold: "toggle" | "on" | "off" | "none";
}>;

/**
 * Default Flic action configuration.
 * - Click: Toggle MCB
 * - Double-click: Force OFF
 * - Hold: Force ON
 */
export const DEFAULT_FLIC_CONFIG: FlicActionConfig = {
  click: "toggle",
  doubleClick: "off",
  hold: "on",
};

