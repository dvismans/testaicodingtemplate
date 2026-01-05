/**
 * Monitoring Module - Service Layer
 *
 * Main monitoring loop for the sauna control system.
 * Polls MCB status, smart meter, and handles safety shutdown.
 *
 * @see Rule #27 (Module-Scoped Color-Coded Loggers)
 */
import {
  config,
  getFloorHeatingConfig,
  getVentilatorConfig,
} from "../config.js";
import {
  connectFloorHeating,
  disconnectFloorHeating,
  setFloorHeatingOff,
  setFloorHeatingOn,
} from "../floor-heating/index.js";
import {
  createLogger,
  logOperationComplete,
  logOperationFailed,
  logOperationStart,
} from "../logger.js";
import {
  type McbLocalStatus,
  connectMcbLocal,
  disconnectMcbLocal,
  getLastMcbLocalStatus,
  turnMcbOffLocal,
  turnMcbOnLocal,
} from "../mcb-local/index.js";
import type { McbStatus } from "../mcb/index.js";
import {
  type FlicButtonEvent,
  type MqttPhaseData,
  type SaunaDoorStatus,
  type SaunaTemperature,
  disconnectMqttClient,
  getLastDoorStatus,
  getLastPhaseData,
  getLastTemperature,
  initializeMqttClient,
} from "../mqtt/index.js";
import {
  sendSafetyShutdownNotification,
  sendTemperatureNotification,
} from "../notifications/index.js";
import { type PhaseData, checkThresholds } from "../smart-meter/index.js";
import {
  broadcastDoor,
  broadcastMcbStatus,
  broadcastSensorData,
  broadcastTemperature,
  broadcastVentilator,
} from "../sse/index.js";
import { controlShellyRelay, handleMcbOff } from "../ventilator/index.js";
import type { MonitoringState } from "./schema.js";
import { DEFAULT_FLIC_CONFIG, INITIAL_MONITORING_STATE } from "./schema.js";

const log = createLogger("monitoring");

// =============================================================================
// Module State
// =============================================================================

let state: MonitoringState = INITIAL_MONITORING_STATE;
let stopRequested = false;

/**
 * Get current monitoring state.
 */
export function getMonitoringState(): MonitoringState {
  return state;
}

/**
 * Get current MCB status from monitoring state.
 */
export function getCurrentMcbStatus(): McbStatus {
  return state.mcbStatus;
}

// =============================================================================
// Safety Shutdown
// =============================================================================

/**
 * Trigger MCB safety shutdown sequence.
 *
 * @param triggerPhases - Array of phase names that exceeded threshold
 */
async function triggerSafetyShutdown(triggerPhases: string[]): Promise<void> {
  const now = Date.now();
  const timeSinceLastOff = now - state.lastSwitchOffTime;

  log.warn(
    { phases: triggerPhases },
    "HIGH AMPERAGE DETECTED - INITIATING MCB SHUTDOWN",
  );

  // Check cooldown
  if (timeSinceLastOff < config.SWITCH_OFF_COOLDOWN_MS) {
    const remainingCooldown = Math.ceil(
      (config.SWITCH_OFF_COOLDOWN_MS - timeSinceLastOff) / 1000,
    );
    log.warn(
      { remainingSeconds: remainingCooldown },
      "Still in cooldown period, skipping auto-off",
    );
    return;
  }

  logOperationStart(log, "safetyShutdown", { phases: triggerPhases });

  // Update state
  state = { ...state, lastSwitchOffTime: now };

  // Turn off MCB via local tuyapi
  const result = await turnMcbOffLocal();

  if (result.isOk()) {
    state = { ...state, mcbStatus: "OFF" };
    logOperationComplete(log, "safetyShutdown", now);

    // Broadcast to all clients
    broadcastMcbStatus("OFF", "auto_safety");

    // Start ventilator delayed-off if configured
    const ventConfig = getVentilatorConfig();
    if (ventConfig) {
      log.info("Starting delayed ventilator shutdown...");
      await handleMcbOffVentilator();
    }

    // Turn off floor heating
    await handleMcbOffFloorHeating();

    // Send notification (respects cooldown)
    await sendSafetyShutdownNotification(triggerPhases);
  } else {
    logOperationFailed(log, "safetyShutdown", result.error.message);

    // MCB status will be updated via MQTT - no need to poll
  }
}

// =============================================================================
// Ventilator Control
// =============================================================================

/**
 * Handle ventilator control when MCB turns OFF.
 * Keeps ventilator running for delayed shutdown.
 */
async function handleMcbOffVentilator(): Promise<void> {
  const ventConfig = getVentilatorConfig();
  if (!ventConfig) return;

  // Use handleMcbOff which sets up the delayed-off timer
  const result = await handleMcbOff();
  if (result.isOk()) {
    log.info(
      { delayMinutes: ventConfig.delayOffMinutes },
      "Ventilator scheduled for delayed shutdown",
    );
    broadcastVentilator(true, ventConfig.delayOffMinutes * 60 * 1000);
  }
}

/**
 * Handle floor heating when MCB turns ON.
 * Sets floor heating to target temperature.
 */
async function handleMcbOnFloorHeating(): Promise<void> {
  const floorConfig = getFloorHeatingConfig();
  if (!floorConfig) return;

  log.info(
    { targetTemp: floorConfig.targetTempOn },
    "Setting floor heating ON with sauna...",
  );

  const result = await setFloorHeatingOn();
  if (result.isErr()) {
    log.error(
      { error: result.error.message },
      "Failed to set floor heating ON",
    );
  }
}

/**
 * Handle floor heating when MCB turns OFF.
 * Sets floor heating to minimum (standby).
 */
async function handleMcbOffFloorHeating(): Promise<void> {
  const floorConfig = getFloorHeatingConfig();
  if (!floorConfig) return;

  log.info(
    { targetTemp: floorConfig.targetTempOff },
    "Setting floor heating OFF with sauna...",
  );

  const result = await setFloorHeatingOff();
  if (result.isErr()) {
    log.error(
      { error: result.error.message },
      "Failed to set floor heating OFF",
    );
  }
}

// =============================================================================
// Flic Button Handling
// =============================================================================

/**
 * Handle Flic button event.
 */
async function handleFlicEvent(event: FlicButtonEvent): Promise<void> {
  const actionConfig = DEFAULT_FLIC_CONFIG;
  let action: "toggle" | "on" | "off" | "none";

  switch (event.action) {
    case "click":
      action = actionConfig.click;
      break;
    case "double_click":
      action = actionConfig.doubleClick;
      break;
    case "hold":
      action = actionConfig.hold;
      break;
    default:
      action = "none";
  }

  if (action === "none") return;

  log.info(
    { buttonAction: event.action, mcbAction: action },
    "Flic button triggered MCB action",
  );

  // Determine target state
  let targetOn: boolean;
  if (action === "toggle") {
    targetOn = state.mcbStatus !== "ON";
  } else {
    targetOn = action === "on";
  }

  // Call MCB control via local tuyapi
  if (targetOn) {
    const result = await turnMcbOnLocal();
    if (result.isOk()) {
      state = { ...state, mcbStatus: "ON" };
      broadcastMcbStatus("ON", "flic");
      // Turn on floor heating
      handleMcbOnFloorHeating().catch((err) => {
        log.error(
          { error: err },
          "Failed to handle MCB on floor heating (Flic)",
        );
      });
    }
  } else {
    const result = await turnMcbOffLocal();
    if (result.isOk()) {
      state = { ...state, mcbStatus: "OFF" };
      broadcastMcbStatus("OFF", "flic");
      // Start ventilator delayed-off and turn off floor heating
      handleMcbOffVentilator().catch((err) => {
        log.error({ error: err }, "Failed to handle MCB off ventilator (Flic)");
      });
      handleMcbOffFloorHeating().catch((err) => {
        log.error(
          { error: err },
          "Failed to handle MCB off floor heating (Flic)",
        );
      });
    }
  }
}

// =============================================================================
// Main Monitoring Loop
// =============================================================================

/**
 * Handle phase data update from MQTT.
 * Checks for over-amperage and triggers safety shutdown if needed.
 */
async function handlePhaseUpdate(data: MqttPhaseData): Promise<void> {
  // Convert to PhaseData format
  const phaseData: PhaseData = { l1: data.l1, l2: data.l2, l3: data.l3 };
  state = { ...state, phaseData };

  // Broadcast sensor data to all SSE clients
  broadcastSensorData(data.l1, data.l2, data.l3);

  // Only check thresholds when MCB is ON
  if (state.mcbStatus === "ON" && config.ENABLE_SAFETY_SHUTDOWN) {
    const threshold = checkThresholds(phaseData, config.AMPERAGE_THRESHOLD);
    if (threshold.exceeds) {
      // Format phases as strings for the notification
      const formattedPhases = threshold.phases.map(
        (p) => `${p.phase} (${p.amperage}A)`,
      );
      await triggerSafetyShutdown(formattedPhases);
    }
  }
}

/**
 * Handle MCB status update from local tuyapi connection.
 */
function handleMcbLocalUpdate(data: McbLocalStatus): void {
  const newStatus: McbStatus = data.isOn ? "ON" : "OFF";
  const previousStatus = state.mcbStatus;

  if (newStatus !== previousStatus) {
    log.info(
      { oldStatus: previousStatus, newStatus, voltage: data.voltage },
      "MCB status changed via local tuyapi",
    );
    state = { ...state, mcbStatus: newStatus };
    broadcastMcbStatus(newStatus, "mqtt"); // Keep "mqtt" source for compatibility

    // Handle ventilator and floor heating when MCB status changes
    if (newStatus === "OFF" && previousStatus === "ON") {
      handleMcbOffVentilator().catch((err) => {
        log.error({ error: err }, "Failed to handle MCB off ventilator");
      });
      handleMcbOffFloorHeating().catch((err) => {
        log.error({ error: err }, "Failed to handle MCB off floor heating");
      });
    } else if (newStatus === "ON" && previousStatus === "OFF") {
      handleMcbOnFloorHeating().catch((err) => {
        log.error({ error: err }, "Failed to handle MCB on floor heating");
      });
    }
  }
}

/**
 * Single poll cycle.
 * MCB status comes from local tuyapi, phase data from MQTT.
 */
async function pollCycle(): Promise<void> {
  const now = Date.now();

  // MCB status handled by local tuyapi callback - just sync from last known value
  const localMcbStatus = getLastMcbLocalStatus();
  if (localMcbStatus) {
    const newStatus: McbStatus = localMcbStatus.isOn ? "ON" : "OFF";
    if (newStatus !== state.mcbStatus) {
      state = { ...state, mcbStatus: newStatus };
    }
  }

  // Phase data comes from MQTT
  const mqttPhaseData = getLastPhaseData();
  if (mqttPhaseData) {
    state = {
      ...state,
      phaseData: {
        l1: mqttPhaseData.l1,
        l2: mqttPhaseData.l2,
        l3: mqttPhaseData.l3,
      },
    };
  }

  state = { ...state, lastPollTime: now };
}

/**
 * Start the main monitoring loop.
 */
export async function startMonitoringLoop(): Promise<void> {
  if (state.isRunning) {
    log.warn("Monitoring loop already running");
    return;
  }

  log.info("Starting main monitoring loop...");
  state = { ...state, isRunning: true };
  stopRequested = false;

  // Connect to MCB locally via tuyapi (replaces Python Tuya-MCB-API)
  const mcbResult = await connectMcbLocal((status: McbLocalStatus) => {
    handleMcbLocalUpdate(status);
  });

  if (mcbResult.isErr()) {
    log.error(
      { error: mcbResult.error.message },
      "Failed to connect to MCB locally - continuing with MQTT only",
    );
  }

  // Connect to floor heating if configured
  const floorConfig = getFloorHeatingConfig();
  if (floorConfig) {
    const floorResult = await connectFloorHeating();
    if (floorResult.isErr()) {
      log.error(
        { error: floorResult.error.message },
        "Failed to connect to floor heating - continuing without floor heating control",
      );
    } else {
      // Sync floor heating state on startup based on MCB status
      const mcbStatus = getLastMcbLocalStatus();
      if (mcbStatus && !mcbStatus.isOn) {
        log.info("MCB is OFF on startup - setting floor heating to standby");
        handleMcbOffFloorHeating().catch((err) => {
          log.error({ error: err }, "Failed to sync floor heating on startup");
        });
      } else if (mcbStatus?.isOn) {
        log.info("MCB is ON on startup - setting floor heating to target temp");
        handleMcbOnFloorHeating().catch((err) => {
          log.error({ error: err }, "Failed to sync floor heating on startup");
        });
      }
    }
  }

  // Initialize MQTT with event handlers (sensors only, MCB status from local)
  initializeMqttClient({
    onTemperature: (data: SaunaTemperature) => {
      broadcastTemperature(data.temperature, data.humidity);

      // Check for temperature alert threshold (e.g., 85°C)
      if (data.temperature >= 85) {
        sendTemperatureNotification(data.temperature).catch((err) => {
          log.error({ error: err }, "Failed to send temperature notification");
        });
      }
    },
    onDoor: (data: SaunaDoorStatus) => {
      broadcastDoor(data.isOpen);
    },
    onPhase: (data: MqttPhaseData) => {
      handlePhaseUpdate(data).catch((err) => {
        log.error({ error: err }, "Failed to handle phase update");
      });
    },
    onFlic: handleFlicEvent,
    onVentilator: (data) => {
      broadcastVentilator(data.status, null);
    },
  });

  // Main loop
  while (!stopRequested) {
    try {
      await pollCycle();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error({ error: message }, "Error in poll cycle");
    }

    // Wait before next iteration
    await new Promise((resolve) =>
      setTimeout(resolve, config.POLLING_INTERVAL_MS),
    );
  }

  log.info("Monitoring loop stopped");
  state = { ...state, isRunning: false };
}

/**
 * Stop the monitoring loop.
 */
export function stopMonitoringLoop(): void {
  if (!state.isRunning) {
    log.warn("Monitoring loop not running");
    return;
  }

  log.info("Stopping monitoring loop...");
  stopRequested = true;
  disconnectMcbLocal();
  disconnectFloorHeating();
  disconnectMqttClient();
}

/**
 * Get current system state snapshot.
 */
export function getSystemState(): {
  mcbStatus: McbStatus;
  phaseData: PhaseData | null;
  temperature: SaunaTemperature | null;
  doorStatus: SaunaDoorStatus | null;
} {
  return {
    mcbStatus: state.mcbStatus,
    phaseData: state.phaseData,
    temperature: getLastTemperature(),
    doorStatus: getLastDoorStatus(),
  };
}
