/**
 * MCB Local Module - Public API
 *
 * Direct local communication with MCB device using tuyapi.
 * Replaces Python Tuya-MCB-API middleware.
 *
 * @see Rule #2 (Module Boundaries are Contracts)
 */

// Types
export type {
  McbConnectionState,
  McbDps,
  McbLocalConfig,
  McbLocalState,
  McbLocalStatus,
} from "./schema.js";

export { INITIAL_MCB_LOCAL_STATE } from "./schema.js";

// Errors
export type { McbLocalError } from "./errors.js";
export {
  commandFailed,
  connectionFailed,
  deviceError,
  formatMcbLocalError,
  statusUnavailable,
  timeout,
} from "./errors.js";

// Service functions
export {
  connectMcbLocal,
  disconnectMcbLocal,
  getLastMcbLocalStatus,
  getMcbLocalState,
  getMcbStatusLocal,
  isMcbConnected,
  turnMcbOffLocal,
  turnMcbOnLocal,
} from "./service.js";

