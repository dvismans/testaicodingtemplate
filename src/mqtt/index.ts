/**
 * MQTT Module - Public API
 *
 * Exports types, service functions, and transformations for the MQTT module.
 *
 * @see Rule #2 (Module Boundaries are Contracts)
 */

// Types
export type {
  DoorMessage,
  FlicButtonEvent,
  FlicMessage,
  McbMqttStatus,
  MqttPhaseData,
  PhaseAccumulator,
  PhaseField,
  RuuviMessage,
  SaunaDoorStatus,
  SaunaTemperature,
  SensorState,
  VentilatorMqttMessage,
  VentilatorMqttStatus,
} from "./schema.js";

export { INITIAL_PHASE_ACCUMULATOR, INITIAL_SENSOR_STATE } from "./schema.js";

// Service functions
export {
  disconnectMqttClient,
  getLastDoorStatus,
  getLastMcbStatus,
  getLastPhaseData,
  getLastTemperature,
  getLastVentilatorMqttStatus,
  getSensorState,
  initializeMqttClient,
  isConnected,
  updateEventHandlers,
} from "./service.js";

export type { MqttEventHandlers } from "./service.js";

// Pure transformations (for testing)
export type { MqttMessageType } from "./transform.js";

export {
  accumulatorToPhaseData,
  extractPhaseField,
  getMessageType,
  parseDoorMessage,
  parseFlicMessage,
  parseMcbMessage,
  parsePhaseMessage,
  parsePhaseValue,
  parseRuuviMessage,
  parseVentilatorMessage,
  updatePhaseAccumulator,
} from "./transform.js";
