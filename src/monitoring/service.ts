/**
 * Monitoring Module - Service Layer
 *
 * Main monitoring loop for the sauna control system.
 * Polls MCB status, smart meter, and handles safety shutdown.
 *
 * @see Rule #27 (Module-Scoped Color-Coded Loggers)
 */
import { config, getVentilatorConfig } from "../config.js";
import { createLogger, logOperationComplete, logOperationFailed, logOperationStart } from "../logger.js";
import { getMcbStatus, turnMcbOff, type McbStatus } from "../mcb/index.js";
import {
  getLastDoorStatus,
  getLastTemperature,
  initializeMqttClient,
  disconnectMqttClient,
  type FlicButtonEvent,
  type SaunaDoorStatus,
  type SaunaTemperature,
} from "../mqtt/index.js";
import { sendSafetyShutdownNotification, sendTemperatureNotification } from "../notifications/index.js";
import { checkThresholds, pollSmartMeter, type PhaseData } from "../smart-meter/index.js";
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

  log.warn({ phases: triggerPhases }, "HIGH AMPERAGE DETECTED - INITIATING MCB SHUTDOWN");

  // Check cooldown
  if (timeSinceLastOff < config.SWITCH_OFF_COOLDOWN_MS) {
    const remainingCooldown = Math.ceil((config.SWITCH_OFF_COOLDOWN_MS - timeSinceLastOff) / 1000);
    log.warn({ remainingSeconds: remainingCooldown }, "Still in cooldown period, skipping auto-off");
    return;
  }

  logOperationStart(log, "safetyShutdown", { phases: triggerPhases });

  // Update state
  state = { ...state, lastSwitchOffTime: now };

  // Turn off MCB via Tuya Cloud
  const result = await turnMcbOff();

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

    // Send notification (respects cooldown)
    await sendSafetyShutdownNotification(triggerPhases);
  } else {
    logOperationFailed(log, "safetyShutdown", result.error.message);

    // Verify actual MCB status
    const statusResult = await getMcbStatus();
    if (statusResult.isOk()) {
      state = { ...state, mcbStatus: statusResult.value };
      broadcastMcbStatus(statusResult.value, "polling");
    }
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
    log.info({ delayMinutes: ventConfig.delayOffMinutes }, "Ventilator scheduled for delayed shutdown");
    broadcastVentilator(true, ventConfig.delayOffMinutes * 60 * 1000);
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

  log.info({ buttonAction: event.action, mcbAction: action }, "Flic button triggered MCB action");

  // Determine target state
  let targetOn: boolean;
  if (action === "toggle") {
    targetOn = state.mcbStatus !== "ON";
  } else {
    targetOn = action === "on";
  }

  // Import and call MCB control
  if (targetOn) {
    const { turnMcbOn } = await import("../mcb/index.js");
    const result = await turnMcbOn();
    if (result.isOk()) {
      state = { ...state, mcbStatus: "ON" };
      broadcastMcbStatus("ON", "flic");
    }
  } else {
    const result = await turnMcbOff();
    if (result.isOk()) {
      state = { ...state, mcbStatus: "OFF" };
      broadcastMcbStatus("OFF", "flic");
    }
  }
}

// =============================================================================
// Main Monitoring Loop
// =============================================================================

/**
 * Single poll cycle.
 */
async function pollCycle(): Promise<void> {
  const now = Date.now();

  // 1. Poll MCB Status
  const mcbResult = await getMcbStatus();
  if (mcbResult.isOk()) {
    const newStatus = mcbResult.value;
    if (newStatus !== state.mcbStatus) {
      log.info({ oldStatus: state.mcbStatus, newStatus }, "MCB status changed");
      state = { ...state, mcbStatus: newStatus };
      broadcastMcbStatus(newStatus, "polling");
    }
  }

  // 2. Poll Smart Meter ONLY when MCB is ON
  if (state.mcbStatus === "ON") {
    const meterResult = await pollSmartMeter();

    if (meterResult.isOk()) {
      const phaseData = meterResult.value;
      state = { ...state, phaseData };

      // Broadcast sensor data
      broadcastSensorData(phaseData.l1, phaseData.l2, phaseData.l3);

      // Check for over-amperage
      if (config.ENABLE_SAFETY_SHUTDOWN) {
        const threshold = checkThresholds(phaseData, config.AMPERAGE_THRESHOLD);
        if (threshold.exceeds) {
          // Format phases as strings for the notification
          const formattedPhases = threshold.phases.map(
            (p) => `${p.phase} (${p.amperage}A)`,
          );
          await triggerSafetyShutdown(formattedPhases);
        }
      }
    } else {
      // Broadcast null sensor data on error
      broadcastSensorData(null, null, null);
    }
  } else {
    // MCB is OFF - broadcast null sensor data
    state = { ...state, phaseData: null };
    broadcastSensorData(null, null, null);
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

  // Initialize MQTT with event handlers
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
    await new Promise((resolve) => setTimeout(resolve, config.POLLING_INTERVAL_MS));
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

