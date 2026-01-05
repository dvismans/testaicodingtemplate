/**
 * Floor Heating Module - Public API
 *
 * Provides functions for controlling floor heating thermostat via tuyapi.
 * Integrated with sauna MCB to warm floor during sessions.
 */

// Types and Schemas
export type {
  FloorHeatingConfig,
  FloorHeatingDps,
  FloorHeatingMode,
  FloorHeatingAction,
  FloorHeatingStatus,
  FloorHeatingConnectionState,
  FloorHeatingState,
} from "./schema.js";

export { INITIAL_FLOOR_HEATING_STATE } from "./schema.js";

// Errors
export {
  connectionFailed,
  setTempFailed,
  setModeFailed,
  statusUnavailable,
  deviceError,
  timeout,
  formatFloorHeatingError,
} from "./errors.js";
export type { FloorHeatingError } from "./errors.js";

// Service functions
export {
  getFloorHeatingState,
  getLastFloorHeatingStatus,
  isFloorHeatingConnected,
  connectFloorHeating,
  disconnectFloorHeating,
  setFloorHeatingTemp,
  setFloorHeatingMode,
  setFloorHeatingOn,
  setFloorHeatingOff,
  getFloorHeatingStatus,
  startFloorHeatingPolling,
  stopPolling as stopFloorHeatingPolling,
} from "./service.js";
