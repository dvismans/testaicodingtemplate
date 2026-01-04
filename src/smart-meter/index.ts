/**
 * Smart Meter Module - Public API
 *
 * Exports only what's needed by other modules.
 * Internal implementation details stay hidden.
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

// Service functions (side effects)
export { pollSmartMeter } from "./service.js";

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
