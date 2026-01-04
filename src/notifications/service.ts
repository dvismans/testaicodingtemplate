/**
 * Notifications Module - Service Layer
 *
 * WAHA WhatsApp API integration for sending notifications.
 * Handles rate limiting with cooldown management.
 *
 * @see Rule #87 (Result Type for All Operations That Can Fail)
 */
import { type Result, err, ok } from "neverthrow";

import { getNotificationConfig } from "../config.js";
import { createLogger } from "../logger.js";
import {
  networkError,
  notConfigured,
  rateLimited,
  sendFailed,
} from "./errors.js";
import type { NotificationError } from "./errors.js";
import type {
  CooldownState,
  SafetyShutdownNotification,
  TemperatureNotification,
} from "./schema.js";
import { INITIAL_COOLDOWN_STATE } from "./schema.js";
import {
  buildWahaRequest,
  formatSafetyShutdownMessage,
  formatTemperatureMessage,
  getSafetyShutdownCooldownRemaining,
  getTemperatureCooldownRemaining,
  isSafetyShutdownAllowed,
  isTemperatureNotificationAllowed,
  phoneToWhatsAppId,
  updateSafetyShutdownCooldown,
  updateTemperatureCooldown,
} from "./transform.js";

const log = createLogger("notifications");

// =============================================================================
// Module State
// =============================================================================

let cooldownState: CooldownState = INITIAL_COOLDOWN_STATE;

/**
 * Get current cooldown state (for testing/monitoring).
 */
export function getCooldownState(): CooldownState {
  return cooldownState;
}

/**
 * Reset cooldown state (for testing).
 */
export function resetCooldownState(): void {
  cooldownState = INITIAL_COOLDOWN_STATE;
}

// =============================================================================
// Core Send Function
// =============================================================================

/**
 * Send a WhatsApp message via WAHA API.
 *
 * @param message - Message text to send
 * @returns Result with void on success or error
 */
export async function sendWhatsAppMessage(
  message: string,
): Promise<Result<void, NotificationError>> {
  const wahaConfig = getNotificationConfig();

  if (!wahaConfig) {
    return err(
      notConfigured(
        "WhatsApp notifications not configured (WAHA_SERVER or NOTIFICATION_PHONE missing)",
      ),
    );
  }

  const chatId = phoneToWhatsAppId(wahaConfig.phoneNumber);
  const payload = buildWahaRequest(chatId, message);
  const url = `${wahaConfig.serverUrl}/api/sendText`;

  log.debug({ url, chatId }, "Sending WhatsApp notification...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(wahaConfig.apiKey && { "X-API-Key": wahaConfig.apiKey }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      log.error(
        { statusCode: response.status, error: errorText },
        "WAHA API request failed",
      );
      return err(
        sendFailed(
          `WAHA API returned ${response.status}: ${errorText}`,
          response.status,
        ),
      );
    }

    log.info({ chatId }, "WhatsApp notification sent successfully");
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error({ error: message }, "Failed to send WhatsApp notification");
    return err(
      networkError(message, error instanceof Error ? error : undefined),
    );
  }
}

// =============================================================================
// Temperature Notifications
// =============================================================================

/**
 * Send a temperature alert notification.
 *
 * Respects cooldown to prevent spam.
 *
 * @param temperature - Temperature value in Celsius
 * @returns Result with void on success or error
 */
export async function sendTemperatureNotification(
  temperature: number,
): Promise<Result<void, NotificationError>> {
  const now = Date.now();

  // Check cooldown
  if (!isTemperatureNotificationAllowed(cooldownState, now)) {
    const remaining = getTemperatureCooldownRemaining(cooldownState, now);
    log.debug(
      { remainingMs: remaining },
      "Temperature notification rate limited",
    );
    return err(rateLimited("Temperature notification in cooldown", remaining));
  }

  const message = formatTemperatureMessage(temperature);
  const result = await sendWhatsAppMessage(message);

  if (result.isOk()) {
    cooldownState = updateTemperatureCooldown(cooldownState, now);
    log.info({ temperature }, "Temperature notification sent");
  }

  return result;
}

// =============================================================================
// Safety Shutdown Notifications
// =============================================================================

/**
 * Send a safety shutdown notification.
 *
 * Respects cooldown to prevent spam.
 *
 * @param triggerPhases - Array of phase names that triggered the shutdown (e.g., ["L1", "L2"])
 * @returns Result with void on success or error
 */
export async function sendSafetyShutdownNotification(
  triggerPhases: ReadonlyArray<string>,
): Promise<Result<void, NotificationError>> {
  const now = Date.now();

  // Check cooldown
  if (!isSafetyShutdownAllowed(cooldownState, now)) {
    const remaining = getSafetyShutdownCooldownRemaining(cooldownState, now);
    log.debug(
      { remainingMs: remaining },
      "Safety shutdown notification rate limited",
    );
    return err(
      rateLimited("Safety shutdown notification in cooldown", remaining),
    );
  }

  const message = formatSafetyShutdownMessage(triggerPhases);
  const result = await sendWhatsAppMessage(message);

  if (result.isOk()) {
    cooldownState = updateSafetyShutdownCooldown(cooldownState, now);
    log.info({ phases: triggerPhases }, "Safety shutdown notification sent");
  }

  return result;
}

// =============================================================================
// Generic Notification Sending
// =============================================================================

/**
 * Send a custom message (no cooldown).
 *
 * Use this for one-off system notifications.
 *
 * @param message - Custom message text
 * @returns Result with void on success or error
 */
export async function sendCustomNotification(
  message: string,
): Promise<Result<void, NotificationError>> {
  log.debug(
    { messageLength: message.length },
    "Sending custom notification...",
  );
  return sendWhatsAppMessage(message);
}
