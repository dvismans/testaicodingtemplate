/**
 * MCB Local Module - Service Layer
 *
 * Direct local communication with MCB device using tuyapi.
 * Replaces Python Tuya-MCB-API middleware.
 *
 * @see Rule #5 (Pure Transformations at edges)
 */
import { type Result, err, ok } from "neverthrow";
import TuyAPI from "tuyapi";

import { getMcbLocalConfig } from "../config.js";
import { createLogger } from "../logger.js";
import {
  type McbLocalError,
  commandFailed,
  connectionFailed,
  deviceError,
  statusUnavailable,
  timeout,
} from "./errors.js";
import {
  INITIAL_MCB_LOCAL_STATE,
  type McbDps,
  type McbLocalState,
  type McbLocalStatus,
} from "./schema.js";

const log = createLogger("mcb");

// =============================================================================
// Module State
// =============================================================================

let state: McbLocalState = INITIAL_MCB_LOCAL_STATE;
let device: InstanceType<typeof TuyAPI> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let statusCallback: ((status: McbLocalStatus) => void) | null = null;

// =============================================================================
// State Accessors
// =============================================================================

/**
 * Get current MCB local state.
 */
export function getMcbLocalState(): McbLocalState {
  return state;
}

/**
 * Get last known MCB status.
 */
export function getLastMcbLocalStatus(): McbLocalStatus | null {
  return state.lastStatus;
}

/**
 * Check if MCB is currently connected.
 */
export function isMcbConnected(): boolean {
  return state.connectionState === "connected";
}

// =============================================================================
// Device Connection
// =============================================================================

/**
 * Initialize and connect to MCB device.
 *
 * @param onStatus - Callback for status updates
 * @returns Result indicating success or failure
 */
export async function connectMcbLocal(
  onStatus?: (status: McbLocalStatus) => void,
): Promise<Result<true, McbLocalError>> {
  if (device && state.connectionState === "connected") {
    log.warn("MCB local already connected");
    return ok(true);
  }

  const config = getMcbLocalConfig();
  statusCallback = onStatus ?? null;

  log.info(
    { deviceId: config.deviceId, ip: config.deviceIp },
    "Connecting to MCB locally via tuyapi...",
  );

  state = { ...state, connectionState: "connecting", lastError: null };

  try {
    device = new TuyAPI({
      id: config.deviceId,
      key: config.localKey,
      ip: config.deviceIp,
      version: config.protocolVersion,
      issueGetOnConnect: true,
    });

    // Set up event handlers
    setupDeviceHandlers(device);

    // Find device (verifies IP)
    await device.find();

    // Connect
    await device.connect();

    // Wait for connection confirmation
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 10000);

      const checkConnected = setInterval(() => {
        if (state.connectionState === "connected") {
          clearTimeout(timeout);
          clearInterval(checkConnected);
          resolve();
        }
      }, 100);
    });

    // Start polling
    startPolling(config.pollIntervalMs);

    log.info("MCB local connection established");
    return ok(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state = { ...state, connectionState: "error", lastError: message };
    log.error({ error: message }, "Failed to connect to MCB locally");
    return err(
      connectionFailed(message, error instanceof Error ? error : undefined),
    );
  }
}

/**
 * Disconnect from MCB device.
 */
export function disconnectMcbLocal(): void {
  stopPolling();

  if (device) {
    try {
      device.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    device = null;
  }

  state = INITIAL_MCB_LOCAL_STATE;
  statusCallback = null;
  log.info("MCB local disconnected");
}

// =============================================================================
// Device Event Handlers
// =============================================================================

function setupDeviceHandlers(dev: InstanceType<typeof TuyAPI>): void {
  dev.on("connected", () => {
    log.info("MCB local: connected event");
    state = { ...state, connectionState: "connected", lastError: null };
  });

  dev.on("disconnected", () => {
    log.warn("MCB local: disconnected event");
    state = { ...state, connectionState: "disconnected" };
  });

  dev.on("error", (error: Error) => {
    log.error({ error: error.message }, "MCB local: error event");
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
      // Merge partial update with existing DPS
      const mergedDps = { ...state.lastStatus.rawDps, ...dps } as McbDps;
      handleStatusUpdate(mergedDps);
    }
  });
}

/**
 * Extract DPS from unknown data structure.
 */
function extractDps(data: unknown): McbDps | null {
  if (
    data &&
    typeof data === "object" &&
    "dps" in data &&
    data.dps &&
    typeof data.dps === "object"
  ) {
    // Type assertion after runtime check
    return data.dps as McbDps;
  }
  return null;
}

function handleStatusUpdate(dps: McbDps): void {
  const now = Date.now();
  const status: McbLocalStatus = {
    isOn: dps["1"],
    voltage: dps["22"] / 10, // Convert decivolts to volts
    rawDps: dps,
    timestamp: now,
  };

  const statusChanged = state.lastStatus?.isOn !== status.isOn;
  state = { ...state, lastStatus: status };

  if (statusChanged) {
    log.info(
      { isOn: status.isOn, voltage: status.voltage },
      "MCB status changed",
    );
  } else {
    log.debug(
      { isOn: status.isOn, voltage: status.voltage },
      "MCB status update",
    );
  }

  statusCallback?.(status);
}

// =============================================================================
// Polling
// =============================================================================

function startPolling(intervalMs: number): void {
  stopPolling();

  log.debug({ intervalMs }, "Starting MCB local polling");

  pollInterval = setInterval(async () => {
    if (device && state.connectionState === "connected") {
      try {
        await device.get({});
      } catch (error) {
        log.debug(
          { error: error instanceof Error ? error.message : String(error) },
          "Poll request failed (will retry)",
        );
      }
    }
  }, intervalMs);
}

function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// =============================================================================
// MCB Control
// =============================================================================

/**
 * Turn MCB ON locally.
 */
export async function turnMcbOnLocal(): Promise<Result<true, McbLocalError>> {
  if (!device || state.connectionState !== "connected") {
    return err(statusUnavailable("MCB not connected"));
  }

  log.info("Turning MCB ON via local tuyapi...");

  try {
    await device.set({ dps: 1, set: true });

    // Wait for confirmation
    const confirmed = await waitForStatus(true, 5000);
    if (!confirmed) {
      return err(timeout("Did not receive ON confirmation", 5000));
    }

    log.info("MCB turned ON successfully");
    return ok(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Check for device-level error
    if (typeof error === "object" && error !== null && "Error" in error) {
      return err(
        deviceError(message, String((error as { Error: unknown }).Error)),
      );
    }

    log.error({ error: message }, "Failed to turn MCB ON");
    return err(commandFailed(message, "on"));
  }
}

/**
 * Turn MCB OFF locally.
 */
export async function turnMcbOffLocal(): Promise<Result<true, McbLocalError>> {
  if (!device || state.connectionState !== "connected") {
    return err(statusUnavailable("MCB not connected"));
  }

  log.info("Turning MCB OFF via local tuyapi...");

  try {
    await device.set({ dps: 1, set: false });

    // Wait for confirmation
    const confirmed = await waitForStatus(false, 5000);
    if (!confirmed) {
      return err(timeout("Did not receive OFF confirmation", 5000));
    }

    log.info("MCB turned OFF successfully");
    return ok(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (typeof error === "object" && error !== null && "Error" in error) {
      return err(
        deviceError(message, String((error as { Error: unknown }).Error)),
      );
    }

    log.error({ error: message }, "Failed to turn MCB OFF");
    return err(commandFailed(message, "off"));
  }
}

/**
 * Get current MCB status locally.
 */
export async function getMcbStatusLocal(): Promise<
  Result<McbLocalStatus, McbLocalError>
> {
  if (!device || state.connectionState !== "connected") {
    return err(statusUnavailable("MCB not connected"));
  }

  try {
    await device.get({});

    // Wait a bit for the data event
    await new Promise((resolve) => setTimeout(resolve, 500));

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

/**
 * Wait for MCB to reach expected status.
 */
async function waitForStatus(
  expectedOn: boolean,
  timeoutMs: number,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (state.lastStatus?.isOn === expectedOn) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return state.lastStatus?.isOn === expectedOn;
}
