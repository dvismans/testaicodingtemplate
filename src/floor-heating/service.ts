/**
 * Floor Heating Module - Service Layer
 *
 * Direct local communication with floor heating thermostat using tuyapi.
 * Controls temperature based on sauna MCB state.
 *
 * @see Rule #5 (Pure Transformations at edges)
 */
import { type Result, err, ok } from "neverthrow";
import TuyAPI from "tuyapi";

import { getFloorHeatingConfig } from "../config.js";
import { createLogger } from "../logger.js";
import { broadcastFloorHeating } from "../sse/index.js";
import {
  type FloorHeatingError,
  connectionFailed,
  deviceError,
  setTempFailed,
  statusUnavailable,
  timeout,
} from "./errors.js";
import {
  type FloorHeatingAction,
  type FloorHeatingDps,
  type FloorHeatingMode,
  type FloorHeatingState,
  type FloorHeatingStatus,
  INITIAL_FLOOR_HEATING_STATE,
} from "./schema.js";

const log = createLogger("heating");

// =============================================================================
// Module State
// =============================================================================

let state: FloorHeatingState = INITIAL_FLOOR_HEATING_STATE;
let device: InstanceType<typeof TuyAPI> | null = null;
let pollInterval: Timer | null = null;
const POLL_INTERVAL_MS = 30000; // Poll every 30 seconds

// =============================================================================
// State Accessors
// =============================================================================

/**
 * Get current floor heating state.
 */
export function getFloorHeatingState(): FloorHeatingState {
  return state;
}

/**
 * Get last known floor heating status.
 */
export function getLastFloorHeatingStatus(): FloorHeatingStatus | null {
  return state.lastStatus;
}

/**
 * Check if floor heating device is connected.
 */
export function isFloorHeatingConnected(): boolean {
  return state.connectionState === "connected";
}

// =============================================================================
// Device Connection
// =============================================================================

/**
 * Connect to floor heating device.
 * Unlike MCB, we don't poll continuously - just connect on demand.
 */
export async function connectFloorHeating(): Promise<
  Result<true, FloorHeatingError>
> {
  return ensureConnected();
}

async function ensureConnected(): Promise<Result<true, FloorHeatingError>> {
  if (device && state.connectionState === "connected") {
    return ok(true);
  }

  const config = getFloorHeatingConfig();
  if (!config) {
    return err(statusUnavailable("Floor heating not configured"));
  }

  log.info(
    { deviceId: config.deviceId, ip: config.ip },
    "Connecting to floor heating...",
  );
  state = { ...state, connectionState: "connecting", lastError: null };

  try {
    // If IP is provided, use it directly (skip UDP discovery)
    const deviceConfig: {
      id: string;
      key: string;
      version: string;
      issueGetOnConnect: boolean;
      ip?: string;
    } = {
      id: config.deviceId,
      key: config.localKey,
      version: config.protocolVersion,
      issueGetOnConnect: true,
    };

    if (config.ip) {
      deviceConfig.ip = config.ip;
    }

    device = new TuyAPI(deviceConfig);

    setupDeviceHandlers(device);

    // Find device on network (uses IP if provided, otherwise UDP discovery)
    await device.find({ timeout: 10 });

    // Connect
    await device.connect();

    // Wait for connection confirmation
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 10000);

      const checkConnected = setInterval(() => {
        if (state.connectionState === "connected") {
          clearTimeout(timeoutId);
          clearInterval(checkConnected);
          resolve();
        }
      }, 100);
    });

    log.info("Floor heating connected");
    return ok(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state = { ...state, connectionState: "error", lastError: message };
    log.error({ error: message }, "Failed to connect to floor heating");
    return err(
      connectionFailed(message, error instanceof Error ? error : undefined),
    );
  }
}

/**
 * Disconnect from floor heating device.
 */
export function disconnectFloorHeating(): void {
  stopPolling();

  if (device) {
    try {
      device.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    device = null;
  }

  state = INITIAL_FLOOR_HEATING_STATE;
  log.info("Floor heating disconnected");
}

/**
 * Start periodic status polling.
 * Reconnects and fetches status every 30 seconds.
 */
export function startFloorHeatingPolling(): void {
  if (pollInterval) {
    return; // Already polling
  }

  log.info("Starting floor heating status polling");

  // Initial poll
  pollFloorHeatingStatus();

  // Set up periodic polling
  pollInterval = setInterval(() => {
    pollFloorHeatingStatus();
  }, POLL_INTERVAL_MS);
}

/**
 * Stop periodic status polling.
 */
export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    log.info("Stopped floor heating status polling");
  }
}

/**
 * Poll floor heating status once.
 * Connects if needed, fetches status, broadcasts to SSE.
 */
async function pollFloorHeatingStatus(): Promise<void> {
  const config = getFloorHeatingConfig();
  if (!config) {
    return;
  }

  try {
    const result = await getFloorHeatingStatus();
    if (result.isErr()) {
      log.debug({ error: result.error.message }, "Floor heating poll failed");
    }
    // Success case: status is already broadcast via handleStatusUpdate
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.debug({ error: message }, "Floor heating poll error");
  }
}

// =============================================================================
// Device Event Handlers
// =============================================================================

function setupDeviceHandlers(dev: InstanceType<typeof TuyAPI>): void {
  dev.on("connected", () => {
    log.info("Floor heating: connected event");
    state = { ...state, connectionState: "connected", lastError: null };
  });

  dev.on("disconnected", () => {
    log.warn("Floor heating: disconnected event");
    state = { ...state, connectionState: "disconnected" };
  });

  dev.on("error", (error: Error) => {
    log.error({ error: error.message }, "Floor heating: error event");
    state = { ...state, lastError: error.message };
  });

  dev.on("data", (data: unknown) => {
    const dps = extractDps(data);
    if (dps) {
      handleStatusUpdate(dps);
    }
  });

  dev.on("dp-refresh", (data: unknown) => {
    const dps = extractDps(data);
    if (dps && state.lastStatus) {
      const mergedDps = { ...state.lastStatus.rawDps, ...dps };
      handleStatusUpdate(mergedDps);
    }
  });
}

function extractDps(data: unknown): FloorHeatingDps | null {
  if (
    data &&
    typeof data === "object" &&
    "dps" in data &&
    data.dps &&
    typeof data.dps === "object"
  ) {
    return data.dps as FloorHeatingDps;
  }
  return null;
}

function handleStatusUpdate(dps: FloorHeatingDps): void {
  const now = Date.now();

  // Parse mode
  const rawMode = dps["2"];
  const mode: FloorHeatingMode | "unknown" =
    rawMode === "AUTO" || rawMode === "MANUAL" ? rawMode : "unknown";

  // Parse action
  const rawAction = dps["3"];
  const action: FloorHeatingAction =
    rawAction === "heating" || rawAction === "warming" || rawAction === "idle"
      ? rawAction
      : "unknown";

  // Convert temperatures from 0.1°C units
  const targetTemp = (dps["16"] ?? 0) / 10;
  const currentTemp = (dps["24"] ?? 0) / 10;
  const unit = dps["23"] === "f" ? "f" : "c";

  const status: FloorHeatingStatus = {
    mode,
    action,
    targetTemp,
    currentTemp,
    unit,
    rawDps: dps,
    timestamp: now,
  };

  state = { ...state, lastStatus: status };

  log.debug(
    {
      mode,
      action,
      targetTemp,
      currentTemp,
    },
    "Floor heating status update",
  );

  // Broadcast to SSE clients
  broadcastFloorHeating(currentTemp, targetTemp, mode, action);
}

// =============================================================================
// Floor Heating Control
// =============================================================================

/**
 * Set floor heating target temperature.
 * Temperature is in Celsius.
 */
export async function setFloorHeatingTemp(
  tempCelsius: number,
): Promise<Result<true, FloorHeatingError>> {
  const connectResult = await ensureConnected();
  if (connectResult.isErr()) {
    return err(connectResult.error);
  }

  if (!device) {
    return err(statusUnavailable("Device not available"));
  }

  log.info({ targetTemp: tempCelsius }, "Setting floor heating temperature...");

  try {
    // Convert to 0.1°C units
    const tempValue = Math.round(tempCelsius * 10);

    await device.set({ dps: 16, set: tempValue });

    // Wait for confirmation
    const confirmed = await waitForTemp(tempCelsius, 5000);
    if (!confirmed) {
      log.warn(
        { targetTemp: tempCelsius },
        "Temperature confirmation timeout (may still have worked)",
      );
    }

    log.info({ targetTemp: tempCelsius }, "Floor heating temperature set");
    return ok(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (typeof error === "object" && error !== null && "Error" in error) {
      return err(
        deviceError(message, String((error as { Error: unknown }).Error)),
      );
    }

    log.error(
      { error: message, targetTemp: tempCelsius },
      "Failed to set temperature",
    );
    return err(setTempFailed(message, tempCelsius));
  }
}

/**
 * Set floor heating mode.
 */
export async function setFloorHeatingMode(
  mode: FloorHeatingMode,
): Promise<Result<true, FloorHeatingError>> {
  const connectResult = await ensureConnected();
  if (connectResult.isErr()) {
    return err(connectResult.error);
  }

  if (!device) {
    return err(statusUnavailable("Device not available"));
  }

  log.info({ mode }, "Setting floor heating mode...");

  try {
    await device.set({ dps: 2, set: mode });

    // Brief wait for the command to process
    await new Promise((resolve) => setTimeout(resolve, 1000));

    log.info({ mode }, "Floor heating mode set");
    return ok(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ error: message, mode }, "Failed to set mode");
    return err(setTempFailed(message, 0)); // Reusing error type
  }
}

/**
 * Set floor heating ON for sauna session.
 * Sets to MANUAL mode at configured ON temperature.
 */
export async function setFloorHeatingOn(): Promise<
  Result<true, FloorHeatingError>
> {
  const config = getFloorHeatingConfig();
  if (!config) {
    return err(statusUnavailable("Floor heating not configured"));
  }

  log.info(
    { targetTemp: config.targetTempOn },
    "Activating floor heating for sauna...",
  );

  // Set mode to MANUAL
  const modeResult = await setFloorHeatingMode("MANUAL");
  if (modeResult.isErr()) {
    return modeResult;
  }

  // Set target temperature
  const tempResult = await setFloorHeatingTemp(config.targetTempOn);
  if (tempResult.isErr()) {
    return tempResult;
  }

  log.info(
    { targetTemp: config.targetTempOn },
    "Floor heating activated for sauna",
  );
  return ok(true);
}

/**
 * Set floor heating OFF after sauna session.
 * Sets to MANUAL mode at configured OFF temperature (standby).
 */
export async function setFloorHeatingOff(): Promise<
  Result<true, FloorHeatingError>
> {
  const config = getFloorHeatingConfig();
  if (!config) {
    return err(statusUnavailable("Floor heating not configured"));
  }

  log.info(
    { targetTemp: config.targetTempOff },
    "Deactivating floor heating (standby)...",
  );

  // Set mode to MANUAL
  const modeResult = await setFloorHeatingMode("MANUAL");
  if (modeResult.isErr()) {
    return modeResult;
  }

  // Set target temperature to standby
  const tempResult = await setFloorHeatingTemp(config.targetTempOff);
  if (tempResult.isErr()) {
    return tempResult;
  }

  // Note: We keep the connection open for status polling
  // Disconnect happens when app shuts down via disconnectFloorHeating()

  log.info(
    { targetTemp: config.targetTempOff },
    "Floor heating deactivated (standby)",
  );
  return ok(true);
}

/**
 * Get current floor heating status.
 */
export async function getFloorHeatingStatus(): Promise<
  Result<FloorHeatingStatus, FloorHeatingError>
> {
  const connectResult = await ensureConnected();
  if (connectResult.isErr()) {
    return err(connectResult.error);
  }

  if (!device) {
    return err(statusUnavailable("Device not available"));
  }

  try {
    await device.get({});
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (state.lastStatus) {
      return ok(state.lastStatus);
    }

    return err(statusUnavailable("No status received from device"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(statusUnavailable(message));
  }
}

// =============================================================================
// Helpers
// =============================================================================

async function waitForTemp(
  expectedTemp: number,
  timeoutMs: number,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    // Allow some tolerance (0.5°C)
    if (
      state.lastStatus &&
      Math.abs(state.lastStatus.targetTemp - expectedTemp) < 0.5
    ) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return (
    state.lastStatus !== null &&
    Math.abs(state.lastStatus.targetTemp - expectedTemp) < 0.5
  );
}
