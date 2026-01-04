/**
 * Ventilator Module - Public API
 *
 * Exports only what's needed by other modules.
 * Internal implementation details stay hidden.
 *
 * @see Rule #2 (Module Boundaries are Contracts)
 */

// Types
export type { VentilatorConfig, VentilatorState } from "./schema.js";
export type { VentilatorError } from "./errors.js";

// Error utilities
export { formatVentilatorError } from "./errors.js";

// Service functions (side effects)
export {
  clearAllTimers,
  controlShellyRelay,
  getShellyStatus,
  getVentilatorState,
  getVentilatorStatusSummary,
  handleMcbOff,
  handleMcbOn,
  stopDelayedOffTimer,
} from "./service.js";

// Pure transformations
export {
  calculateDelayEndTime,
  calculateRemainingDelayMs,
  formatRemainingTime,
  shouldResetKeepAlive,
} from "./transform.js";
