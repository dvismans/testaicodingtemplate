/**
 * Monitoring Module - Public API
 *
 * Exports types and service functions for the main monitoring loop.
 *
 * @see Rule #2 (Module Boundaries are Contracts)
 */

// Types
export type { FlicActionConfig, MonitoringState } from "./schema.js";

export { DEFAULT_FLIC_CONFIG, INITIAL_MONITORING_STATE } from "./schema.js";

// Service functions
export {
  getCurrentMcbStatus,
  getMonitoringState,
  getSystemState,
  startMonitoringLoop,
  stopMonitoringLoop,
} from "./service.js";
