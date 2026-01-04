/**
 * Notifications Module - Pure Transformations
 *
 * Pure functions for building notification messages and managing cooldowns.
 * No side effects, no I/O - just data in, data out.
 *
 * @see Rule #5 (Pure Transformations), #8 (Immutability)
 */
import type {
  CooldownState,
  McbStatusNotification,
  Notification,
  SafetyShutdownNotification,
  SystemAlertNotification,
  TemperatureNotification,
  WahaSendTextRequest,
} from "./schema.js";
import { COOLDOWN_DURATIONS } from "./schema.js";

// =============================================================================
// Message Formatting
// =============================================================================

/**
 * Format a temperature notification message.
 */
export function formatTemperatureMessage(temp: number): string {
  return `Sauna temperature is now ${temp.toFixed(1)}°C`;
}

/**
 * Format a safety shutdown notification message.
 */
export function formatSafetyShutdownMessage(
  phases: ReadonlyArray<string>,
): string {
  return `SAFETY ALERT: MCB automatically switched OFF due to high amperage detected on phase(s): ${phases.join(", ")}. Please check your electrical load before manually switching back on.`;
}

/**
 * Format an MCB status notification message.
 */
export function formatMcbStatusMessage(
  status: "on" | "off",
  reason?: string,
): string {
  const base = `MCB has been turned ${status.toUpperCase()}`;
  return reason ? `${base}: ${reason}` : base;
}

/**
 * Format a system alert message.
 */
export function formatSystemAlertMessage(message: string): string {
  return `System Alert: ${message}`;
}

/**
 * Format any notification into a message string.
 */
export function formatNotificationMessage(notification: Notification): string {
  switch (notification.type) {
    case "temperature_alert":
      return formatTemperatureMessage(notification.temperature);
    case "safety_shutdown":
      return formatSafetyShutdownMessage(notification.triggerPhases);
    case "mcb_status":
      return formatMcbStatusMessage(notification.status, notification.reason);
    case "system_alert":
      return formatSystemAlertMessage(notification.message);
  }
}

// =============================================================================
// WAHA Request Building
// =============================================================================

/**
 * Build WAHA sendText request payload.
 *
 * @param chatId - WhatsApp chat ID (phone@c.us format)
 * @param message - Message text
 * @param session - WAHA session name
 * @returns Request payload
 */
export function buildWahaRequest(
  chatId: string,
  message: string,
  session = "default",
): WahaSendTextRequest {
  return {
    chatId,
    text: message,
    session,
  };
}

/**
 * Convert phone number to WhatsApp chat ID format.
 *
 * @param phone - Phone number (with or without + prefix)
 * @returns Chat ID in phone@c.us format
 */
export function phoneToWhatsAppId(phone: string): string {
  // Remove + prefix and any spaces/dashes
  const cleaned = phone.replace(/[\s+-]/g, "");
  return `${cleaned}@c.us`;
}

// =============================================================================
// Notification Factories
// =============================================================================

/**
 * Create a temperature notification.
 */
export function createTemperatureNotification(
  temperature: number,
  now: number,
): TemperatureNotification {
  return {
    type: "temperature_alert",
    temperature,
    timestamp: now,
  };
}

/**
 * Create a safety shutdown notification.
 */
export function createSafetyShutdownNotification(
  triggerPhases: ReadonlyArray<string>,
  now: number,
): SafetyShutdownNotification {
  return {
    type: "safety_shutdown",
    triggerPhases,
    timestamp: now,
  };
}

/**
 * Create an MCB status notification.
 */
export function createMcbStatusNotification(
  status: "on" | "off",
  now: number,
  reason?: string,
): McbStatusNotification {
  return reason !== undefined
    ? { type: "mcb_status", status, reason, timestamp: now }
    : { type: "mcb_status", status, timestamp: now };
}

/**
 * Create a system alert notification.
 */
export function createSystemAlertNotification(
  message: string,
  now: number,
): SystemAlertNotification {
  return {
    type: "system_alert",
    message,
    timestamp: now,
  };
}

// =============================================================================
// Cooldown Management
// =============================================================================

/**
 * Check if a safety shutdown notification is allowed (not in cooldown).
 *
 * @param state - Current cooldown state
 * @param now - Current timestamp in ms
 * @returns true if notification is allowed
 */
export function isSafetyShutdownAllowed(
  state: CooldownState,
  now: number,
): boolean {
  return now - state.safetyShutdown >= COOLDOWN_DURATIONS.safetyShutdown;
}

/**
 * Check if a temperature notification is allowed (not in cooldown).
 *
 * @param state - Current cooldown state
 * @param now - Current timestamp in ms
 * @returns true if notification is allowed
 */
export function isTemperatureNotificationAllowed(
  state: CooldownState,
  now: number,
): boolean {
  return now - state.temperature >= COOLDOWN_DURATIONS.temperature;
}

/**
 * Get remaining cooldown time for safety shutdown.
 *
 * @param state - Current cooldown state
 * @param now - Current timestamp in ms
 * @returns Remaining milliseconds, or 0 if not in cooldown
 */
export function getSafetyShutdownCooldownRemaining(
  state: CooldownState,
  now: number,
): number {
  const remaining =
    COOLDOWN_DURATIONS.safetyShutdown - (now - state.safetyShutdown);
  return Math.max(0, remaining);
}

/**
 * Get remaining cooldown time for temperature alerts.
 *
 * @param state - Current cooldown state
 * @param now - Current timestamp in ms
 * @returns Remaining milliseconds, or 0 if not in cooldown
 */
export function getTemperatureCooldownRemaining(
  state: CooldownState,
  now: number,
): number {
  const remaining = COOLDOWN_DURATIONS.temperature - (now - state.temperature);
  return Math.max(0, remaining);
}

/**
 * Update cooldown state after sending a safety shutdown notification.
 */
export function updateSafetyShutdownCooldown(
  state: CooldownState,
  now: number,
): CooldownState {
  return { ...state, safetyShutdown: now };
}

/**
 * Update cooldown state after sending a temperature notification.
 */
export function updateTemperatureCooldown(
  state: CooldownState,
  now: number,
): CooldownState {
  return { ...state, temperature: now };
}
