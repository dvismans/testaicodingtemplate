/**
 * Notifications Module - Public API
 *
 * Exports types, service functions, and transformations for the notifications module.
 *
 * @see Rule #2 (Module Boundaries are Contracts)
 */

// Types
export type {
  CooldownState,
  McbStatusNotification,
  Notification,
  NotificationType,
  SafetyShutdownNotification,
  SystemAlertNotification,
  TemperatureNotification,
  WahaSendTextRequest,
} from "./schema.js";

export { COOLDOWN_DURATIONS, INITIAL_COOLDOWN_STATE } from "./schema.js";

// Error types
export type { NotificationError } from "./errors.js";

export {
  networkError,
  notConfigured,
  rateLimited,
  sendFailed,
} from "./errors.js";

// Service functions
export {
  getCooldownState,
  resetCooldownState,
  sendCustomNotification,
  sendSafetyShutdownNotification,
  sendTemperatureNotification,
  sendWhatsAppMessage,
} from "./service.js";

// Pure transformations (for testing and external use)
export {
  buildWahaRequest,
  createMcbStatusNotification,
  createSafetyShutdownNotification,
  createSystemAlertNotification,
  createTemperatureNotification,
  formatMcbStatusMessage,
  formatNotificationMessage,
  formatSafetyShutdownMessage,
  formatSystemAlertMessage,
  formatTemperatureMessage,
  getSafetyShutdownCooldownRemaining,
  getTemperatureCooldownRemaining,
  isSafetyShutdownAllowed,
  isTemperatureNotificationAllowed,
  phoneToWhatsAppId,
  updateSafetyShutdownCooldown,
  updateTemperatureCooldown,
} from "./transform.js";
