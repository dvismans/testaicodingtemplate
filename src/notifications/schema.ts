/**
 * Notifications Module - Schemas and Types
 *
 * Defines the data shapes for WAHA WhatsApp notifications.
 * Schemas are the source of truth - types derived with z.infer<>.
 *
 * @see Rule #4 (Data First)
 */
import { z } from "zod";

// =============================================================================
// WAHA API Schemas
// =============================================================================

/**
 * WAHA sendText request payload.
 */
export const WahaSendTextRequestSchema = z.object({
  chatId: z.string().describe("WhatsApp chat ID (phone@c.us format)"),
  text: z.string().describe("Message text to send"),
  session: z.string().default("default").describe("WAHA session name"),
});

export type WahaSendTextRequest = z.infer<typeof WahaSendTextRequestSchema>;

/**
 * WAHA API response (success case).
 */
export const WahaSuccessResponseSchema = z.object({
  id: z.string().optional(),
  timestamp: z.number().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type WahaSuccessResponse = z.infer<typeof WahaSuccessResponseSchema>;

// =============================================================================
// Notification Types
// =============================================================================

/**
 * Notification type discriminator.
 */
export type NotificationType =
  | "temperature_alert"
  | "safety_shutdown"
  | "mcb_status"
  | "system_alert";

/**
 * Base notification payload.
 */
export type BaseNotification = Readonly<{
  type: NotificationType;
  timestamp: number;
}>;

/**
 * Temperature alert notification.
 */
export type TemperatureNotification = BaseNotification &
  Readonly<{
    type: "temperature_alert";
    temperature: number;
  }>;

/**
 * Safety shutdown notification.
 */
export type SafetyShutdownNotification = BaseNotification &
  Readonly<{
    type: "safety_shutdown";
    triggerPhases: ReadonlyArray<string>;
  }>;

/**
 * MCB status notification.
 */
export type McbStatusNotification = BaseNotification &
  Readonly<{
    type: "mcb_status";
    status: "on" | "off";
    reason?: string;
  }>;

/**
 * System alert notification.
 */
export type SystemAlertNotification = BaseNotification &
  Readonly<{
    type: "system_alert";
    message: string;
  }>;

/**
 * Union of all notification types.
 */
export type Notification =
  | TemperatureNotification
  | SafetyShutdownNotification
  | McbStatusNotification
  | SystemAlertNotification;

// =============================================================================
// Cooldown State
// =============================================================================

/**
 * Cooldown state for rate limiting notifications.
 */
export type CooldownState = Readonly<{
  /** Last safety shutdown notification timestamp */
  safetyShutdown: number;
  /** Last temperature alert timestamp */
  temperature: number;
}>;

/**
 * Initial cooldown state.
 */
export const INITIAL_COOLDOWN_STATE: CooldownState = {
  safetyShutdown: 0,
  temperature: 0,
};

/**
 * Default cooldown durations in milliseconds.
 */
export const COOLDOWN_DURATIONS = {
  /** Safety shutdown notifications - 1 minute cooldown */
  safetyShutdown: 60_000,
  /** Temperature alerts - 5 minute cooldown */
  temperature: 300_000,
} as const;

