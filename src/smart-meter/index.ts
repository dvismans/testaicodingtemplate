/**
 * Smart Meter Module - Public API
 *
 * Phase data is now received via MQTT (p1monitor/phase/#).
 * This module contains types and pure transformation functions
 * for threshold checking and amperage calculations.
 *
 * @see Rule #2 (Module Boundaries are Contracts)
 */

// Types
export type {
  ExceededPhase,
  PhaseData,
  PhaseId,
  ThresholdResult,
} from "./schema.js";
export type { SmartMeterError } from "./errors.js";

// Error utilities
export { formatSmartMeterError } from "./errors.js";

// Pure transformations
export {
  checkThresholds,
  formatThresholdResult,
  getMaxAmperage,
  getPhaseAmperage,
  getTotalAmperage,
  PHASE_IDS,
  parseSmartMeterResponse,
} from "./transform.js";
