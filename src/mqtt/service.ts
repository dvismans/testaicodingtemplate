/**
 * MQTT Module - Service Layer
 *
 * MQTT client management and message handling.
 * Connects to broker, subscribes to topics, and dispatches parsed messages.
 *
 * @see Rule #87 (Result Type for All Operations That Can Fail)
 */
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";

import { config, mqttTopics } from "../config.js";
import { createLogger } from "../logger.js";
import type {
  FlicButtonEvent,
  MqttPhaseData,
  SaunaDoorStatus,
  SaunaTemperature,
  SensorState,
  VentilatorMqttStatus,
} from "./schema.js";
import { INITIAL_SENSOR_STATE } from "./schema.js";
import {
  accumulatorToPhaseData,
  extractPhaseField,
  getMessageType,
  parseDoorMessage,
  parseFlicMessage,
  parsePhaseValue,
  parseRuuviMessage,
  parseVentilatorMessage,
  updatePhaseAccumulator,
} from "./transform.js";

const log = createLogger("mqtt");

// =============================================================================
// Module State
// =============================================================================

let mqttClient: MqttClient | null = null;
let sensorState: SensorState = INITIAL_SENSOR_STATE;

/**
 * Callback types for MQTT events.
 * Note: MCB status now comes from local tuyapi, not MQTT.
 */
export type MqttEventHandlers = {
  onTemperature?: (data: SaunaTemperature) => void;
  onDoor?: (data: SaunaDoorStatus) => void;
  onVentilator?: (data: VentilatorMqttStatus) => void;
  onPhase?: (data: MqttPhaseData) => void;
  onFlic?: (event: FlicButtonEvent) => void;
  // onMcb removed - MCB status now from local tuyapi
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
};

let eventHandlers: MqttEventHandlers = {};

// =============================================================================
// Sensor State Access
// =============================================================================

/**
 * Get current sensor state (read-only).
 */
export function getSensorState(): SensorState {
  return sensorState;
}

/**
 * Get last known temperature data.
 */
export function getLastTemperature(): SaunaTemperature | null {
  return sensorState.temperature;
}

/**
 * Get last known door status.
 */
export function getLastDoorStatus(): SaunaDoorStatus | null {
  return sensorState.door;
}

/**
 * Get last known ventilator status from MQTT.
 */
export function getLastVentilatorMqttStatus(): VentilatorMqttStatus | null {
  return sensorState.ventilator;
}

/**
 * Get last known phase data from MQTT (smart meter L1/L2/L3 amperage).
 */
export function getLastPhaseData(): MqttPhaseData | null {
  return sensorState.phase;
}

// getLastMcbStatus removed - MCB status now from local tuyapi

// =============================================================================
// MQTT Client Management
// =============================================================================

/**
 * Initialize and connect the MQTT client.
 *
 * @param handlers - Event handlers for sensor updates
 * @returns true if connection initiated successfully
 */
export function initializeMqttClient(
  handlers: MqttEventHandlers = {},
): boolean {
  if (mqttClient) {
    log.warn("MQTT client already initialized");
    return true;
  }

  eventHandlers = handlers;

  log.info({ broker: config.MQTT_BROKER_URL }, "Connecting to MQTT broker...");

  try {
    mqttClient = mqtt.connect(config.MQTT_BROKER_URL, {
      reconnectPeriod: 5000, // Reconnect every 5 seconds
      connectTimeout: 10000, // 10 second connection timeout
    });

    setupClientHandlers(mqttClient);

    return true;
  } catch (error) {
    log.error({ error }, "Failed to initialize MQTT client");
    return false;
  }
}

/**
 * Set up MQTT client event handlers.
 */
function setupClientHandlers(client: MqttClient): void {
  client.on("connect", () => {
    log.info("Connected to MQTT broker");

    // Subscribe to all configured topics
    subscribeToTopics(client);

    eventHandlers.onConnect?.();
  });

  client.on("message", (topic, message) => {
    handleMessage(topic, message);
  });

  client.on("error", (error) => {
    log.error({ error: error.message }, "MQTT client error");
    eventHandlers.onError?.(error);
  });

  client.on("close", () => {
    log.warn("MQTT connection closed");
    eventHandlers.onDisconnect?.();
  });

  client.on("reconnect", () => {
    log.info("Reconnecting to MQTT broker...");
  });

  client.on("offline", () => {
    log.warn("MQTT client offline");
  });
}

/**
 * Subscribe to configured MQTT topics.
 * Note: MCB status now comes from local tuyapi, not MQTT.
 */
function subscribeToTopics(client: MqttClient): void {
  const topics = [
    mqttTopics.door,
    mqttTopics.ruuvi,
    mqttTopics.ventilator,
    mqttTopics.flic,
    mqttTopics.phase,
    // MCB topic removed - status now from local tuyapi
  ];

  for (const topic of topics) {
    client.subscribe(topic, (err) => {
      if (err) {
        log.error(
          { topic, error: err.message },
          "Failed to subscribe to topic",
        );
      } else {
        log.debug({ topic }, "Subscribed to topic");
      }
    });
  }
}

/**
 * Handle incoming MQTT message.
 */
function handleMessage(topic: string, payload: Buffer): void {
  const now = Date.now();
  const messageType = getMessageType(topic);

  switch (messageType) {
    case "ruuvi": {
      const data = parseRuuviMessage(payload, now);
      if (data) {
        sensorState = { ...sensorState, temperature: data };
        log.debug(
          { temperature: data.temperature, humidity: data.humidity },
          "Temperature update received",
        );
        eventHandlers.onTemperature?.(data);
      }
      break;
    }

    case "door": {
      const data = parseDoorMessage(payload, now);
      if (data) {
        sensorState = { ...sensorState, door: data };
        log.debug(
          { isOpen: data.isOpen, battery: data.batteryPercent },
          "Door status update received",
        );
        eventHandlers.onDoor?.(data);
      }
      break;
    }

    case "ventilator": {
      const data = parseVentilatorMessage(payload, now);
      if (data) {
        sensorState = { ...sensorState, ventilator: data };
        log.debug(
          { status: data.status ? "ON" : "OFF" },
          "Ventilator MQTT status received",
        );
        eventHandlers.onVentilator?.(data);
      }
      break;
    }

    case "flic": {
      const event = parseFlicMessage(payload, now);
      if (event) {
        log.info(
          { action: event.action, buttonId: event.buttonId },
          "Flic button event",
        );
        eventHandlers.onFlic?.(event);
      }
      break;
    }

    case "phase": {
      // P1 Monitor publishes individual values to separate topics
      const field = extractPhaseField(topic);
      if (!field) {
        log.debug({ topic }, "Ignoring non-amperage phase topic");
        break;
      }

      const value = parsePhaseValue(payload);
      if (value === null) {
        log.debug(
          { topic, payload: payload.toString() },
          "Failed to parse phase value",
        );
        break;
      }

      // Update accumulator with new value
      const updatedAccumulator = updatePhaseAccumulator(
        sensorState.phaseAccumulator,
        field,
        value,
        now,
      );
      sensorState = { ...sensorState, phaseAccumulator: updatedAccumulator };

      log.debug({ field, value }, "Phase value received");

      // Check if we have all three values - if so, emit complete phase data
      const completeData = accumulatorToPhaseData(updatedAccumulator);
      if (completeData) {
        sensorState = { ...sensorState, phase: completeData };
        log.debug(
          { l1: completeData.l1, l2: completeData.l2, l3: completeData.l3 },
          "Complete phase data available",
        );
        eventHandlers.onPhase?.(completeData);
      }
      break;
    }

    // MCB case removed - status now from local tuyapi

    default:
      log.debug({ topic }, "Unknown message type");
  }
}

// =============================================================================
// Client Control
// =============================================================================

/**
 * Check if MQTT client is connected.
 */
export function isConnected(): boolean {
  return mqttClient?.connected ?? false;
}

/**
 * Disconnect and clean up MQTT client.
 */
export function disconnectMqttClient(): void {
  if (mqttClient) {
    log.info("Disconnecting MQTT client...");
    mqttClient.end(true);
    mqttClient = null;
    sensorState = INITIAL_SENSOR_STATE;
  }
}

/**
 * Update event handlers (useful for adding SSE broadcast handlers later).
 */
export function updateEventHandlers(
  handlers: Partial<MqttEventHandlers>,
): void {
  eventHandlers = { ...eventHandlers, ...handlers };
}
