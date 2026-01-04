/**
 * Typed configuration - all config lives in .env, parsed with Zod at startup.
 * App crashes immediately on invalid config - fail fast.
 *
 * @see Rule #47, #61-65
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

const ConfigSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000).describe("HTTP server port"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development")
    .describe("Runtime environment"),

  // Application
  APP_NAME: z.string().default("MyApp").describe("Application name"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info")
    .describe("Pino log level"),

  // Feature Flags
  ENABLE_GREETING_EMOJI: envBoolean(false).describe(
    "Add emoji to greetings (disabled by default per UI rules)",
  ),

  // Timeouts
  REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .default(5000)
    .describe("Request timeout in milliseconds"),
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
