/**
 * SSE Module - Public API
 *
 * Exports types and service functions for Server-Sent Events.
 *
 * @see Rule #2 (Module Boundaries are Contracts)
 */

// Types
export type {
  ConnectionEvent,
  DoorEvent,
  McbStatusEvent,
  SensorDataEvent,
  SseEvent,
  SystemStateEvent,
  TemperatureEvent,
  VentilatorEvent,
} from "./schema.js";

// Service functions
export {
  broadcast,
  broadcastDoor,
  broadcastMcbStatus,
  broadcastSensorData,
  broadcastTemperature,
  broadcastVentilator,
  createSseStream,
  disconnectAllClients,
  getClientCount,
  removeClient,
  sendToClient,
} from "./service.js";

