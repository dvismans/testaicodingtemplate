/**
 * Typed configuration - all config lives in .env, parsed with Zod at startup.
 * App crashes immediately on invalid config - fail fast.
 *
 * Sauna Control System configuration covering:
 * - Server settings
 * - MCB device (Tuya Cloud + Local API)
 * - Smart meter polling
 * - MQTT sensor topics
 * - Shelly ventilator control
 * - WAHA notifications
 *
 * @see Rule #47, #61-65 (Typed Config Schema, All Config in .env)
 */
import { z } from "zod";

/**
 * Custom boolean parser for environment variables.
 * z.coerce.boolean() doesn't work with string "false" (it's truthy).
 */
const envBoolean = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((val) =>
      val === undefined ? defaultValue : val.toLowerCase() === "true",
    );

/**
 * Parse optional URL - empty string becomes undefined
 */
const optionalUrl = z
  .string()
  .optional()
  .transform((val) => (val && val.trim() !== "" ? val : undefined));

const ConfigSchema = z.object({
  // ==========================================================================
  // Server Configuration
  // ==========================================================================
  PORT: z.coerce.number().default(8083).describe("HTTP server port"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development")
    .describe("Runtime environment"),
  APP_NAME: z.string().default("SaunaControl").describe("Application name"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info")
    .describe("Pino log level"),

  // ==========================================================================
  // MCB Device Configuration
  // ==========================================================================
  MCB_DEVICE_ID: z
    .string()
    .min(1, "MCB_DEVICE_ID is required")
    .describe("Tuya device ID for MCB"),
  MCB_LOCAL_API_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:8091")
    .describe("Python MCB Local API endpoint for status polling"),

  // ==========================================================================
  // Tuya Cloud API Configuration
  // ==========================================================================
  TUYA_ACCESS_ID: z
    .string()
    .min(1, "TUYA_ACCESS_ID is required")
    .describe("Tuya IoT Platform Access ID"),
  TUYA_ACCESS_KEY: z
    .string()
    .min(1, "TUYA_ACCESS_KEY is required")
    .describe("Tuya IoT Platform Access Key"),
  TUYA_BASE_URL: z
    .string()
    .url()
    .default("https://openapi.tuyaeu.com")
    .describe("Tuya Cloud API base URL (region-specific)"),

  // ==========================================================================
  // Safety Thresholds (phase data now from MQTT)
  // ==========================================================================
  AMPERAGE_THRESHOLD: z.coerce
    .number()
    .positive()
    .default(25)
    .describe("Amperage threshold (A) - MCB auto-shutdown if exceeded"),
  POLLING_INTERVAL_MS: z.coerce
    .number()
    .positive()
    .default(5000)
    .describe("Polling interval in milliseconds"),
  SWITCH_OFF_COOLDOWN_MS: z.coerce
    .number()
    .positive()
    .default(10000)
    .describe("Cooldown after auto-shutdown before another can trigger (ms)"),

  // ==========================================================================
  // MQTT Configuration
  // ==========================================================================
  MQTT_BROKER_URL: z
    .string()
    .min(1, "MQTT_BROKER_URL is required")
    .describe("MQTT broker connection URL"),
  MQTT_TOPIC_DOOR: z
    .string()
    .default("homelab/sensors/sauna/door/#")
    .describe("MQTT topic for door sensor"),
  MQTT_TOPIC_RUUVI: z
    .string()
    .default("homelab/sensors/sauna/ruuvi/#")
    .describe("MQTT topic for Ruuvi temperature sensor"),
  MQTT_TOPIC_VENTILATOR: z
    .string()
    .default("homelab/sensors/sauna/ventilator/#")
    .describe("MQTT topic for ventilator status"),
  MQTT_TOPIC_FLIC: z
    .string()
    .default("homelab/controls/sauna/flic/#")
    .describe("MQTT topic for Flic button events"),
  MQTT_TOPIC_PHASE: z
    .string()
    .default("p1monitor/phase/#")
    .describe(
      "MQTT topic for P1 monitor phase data (with wildcard for subtopics)",
    ),

  // ==========================================================================
  // Ventilator (Shelly Relay) Configuration
  // ==========================================================================
  VENTILATOR_ENABLED: envBoolean(true).describe(
    "Enable/disable ventilator control",
  ),
  SHELLY_VENTILATOR_IP: z
    .string()
    .optional()
    .describe("Shelly relay IP address for ventilator control"),
  VENTILATOR_DELAY_OFF_MINUTES: z.coerce
    .number()
    .positive()
    .default(60)
    .describe("Minutes to keep ventilator running after MCB turns OFF"),
  VENTILATOR_KEEP_ALIVE_MINUTES: z.coerce
    .number()
    .positive()
    .default(25)
    .describe("Minutes between keep-alive cycles"),
  VENTILATOR_TIMEOUT_MS: z.coerce
    .number()
    .positive()
    .default(5000)
    .describe("HTTP timeout for Shelly commands (ms)"),

  // ==========================================================================
  // WhatsApp Notifications (WAHA)
  // ==========================================================================
  WAHA_SERVER: optionalUrl.describe("WAHA server endpoint"),
  WAHA_API_KEY: z.string().optional().describe("WAHA API key"),
  NOTIFICATION_PHONE: z
    .string()
    .optional()
    .describe("Phone number for notifications (WhatsApp format)"),

  // ==========================================================================
  // Feature Flags
  // ==========================================================================
  ENABLE_SAFETY_SHUTDOWN: envBoolean(true).describe(
    "Enable safety auto-shutdown on over-amperage",
  ),
  ENABLE_NOTIFICATIONS: envBoolean(true).describe(
    "Enable WhatsApp notifications",
  ),
});

// Parse at startup - crashes immediately if invalid
const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

// Type export for use elsewhere
export type Config = z.infer<typeof ConfigSchema>;

// =============================================================================
// Derived Configuration Objects
// =============================================================================

/**
 * Ventilator configuration object for service layer.
 * Returns null if ventilator is disabled or IP not configured.
 */
export function getVentilatorConfig(): Readonly<{
  enabled: true;
  ipAddress: string;
  delayOffMinutes: number;
  keepAliveMinutes: number;
  timeoutMs: number;
}> | null {
  if (!config.VENTILATOR_ENABLED || !config.SHELLY_VENTILATOR_IP) {
    return null;
  }

  return {
    enabled: true,
    ipAddress: config.SHELLY_VENTILATOR_IP,
    delayOffMinutes: config.VENTILATOR_DELAY_OFF_MINUTES,
    keepAliveMinutes: config.VENTILATOR_KEEP_ALIVE_MINUTES,
    timeoutMs: config.VENTILATOR_TIMEOUT_MS,
  };
}

/**
 * WAHA notification configuration.
 * Returns null if notifications are disabled or not configured.
 */
export function getNotificationConfig(): Readonly<{
  serverUrl: string;
  apiKey: string | undefined;
  phoneNumber: string;
}> | null {
  if (
    !config.ENABLE_NOTIFICATIONS ||
    !config.WAHA_SERVER ||
    !config.NOTIFICATION_PHONE
  ) {
    return null;
  }

  return {
    serverUrl: config.WAHA_SERVER,
    apiKey: config.WAHA_API_KEY,
    phoneNumber: config.NOTIFICATION_PHONE,
  };
}

/**
 * MQTT topics configuration.
 */
export const mqttTopics = {
  door: config.MQTT_TOPIC_DOOR,
  ruuvi: config.MQTT_TOPIC_RUUVI,
  ventilator: config.MQTT_TOPIC_VENTILATOR,
  flic: config.MQTT_TOPIC_FLIC,
  phase: config.MQTT_TOPIC_PHASE,
} as const;
