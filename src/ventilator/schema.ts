/**
 * Ventilator Module - Schemas and Types
 *
 * Defines the data shapes for Shelly relay ventilator control.
 * Schemas are the source of truth - types derived with z.infer<>.
 *
 * @see Rule #4 (Data First)
 */
import { z } from "zod";

// =============================================================================
// Ventilator Configuration
// =============================================================================

/**
 * Ventilator (Shelly relay) configuration.
 */
export const VentilatorConfigSchema = z.object({
  enabled: z.literal(true),
  ipAddress: z.string().describe("Shelly relay IP address"),
  delayOffMinutes: z
    .number()
    .positive()
    .describe("Minutes to run after MCB OFF"),
  keepAliveMinutes: z
    .number()
    .positive()
    .describe("Minutes between keep-alive cycles"),
  timeoutMs: z.number().positive().describe("HTTP request timeout in ms"),
});

export type VentilatorConfig = z.infer<typeof VentilatorConfigSchema>;

// =============================================================================
// Ventilator State
// =============================================================================

/**
 * Current ventilator operational state.
 */
export type VentilatorState = Readonly<{
  /** Current relay status: true = ON, false = OFF, null = unknown */
  status: boolean | null;
  /** Timestamp when delayed OFF will trigger (null if no timer active) */
  delayedOffEndTime: number | null;
  /** Whether keep-alive cycling is active */
  keepAliveActive: boolean;
  /** Last time status was updated */
  lastUpdate: number | null;
}>;

/**
 * Initial ventilator state.
 */
export const INITIAL_VENTILATOR_STATE: VentilatorState = {
  status: null,
  delayedOffEndTime: null,
  keepAliveActive: false,
  lastUpdate: null,
};

// =============================================================================
// Shelly API Response
// =============================================================================

/**
 * Shelly Gen2 device status response (GetStatus RPC).
 */
export const ShellyStatusResponseSchema = z.object({
  "switch:0": z
    .object({
      output: z.boolean(),
    })
    .optional(),
});

export type ShellyStatusResponse = z.infer<typeof ShellyStatusResponseSchema>;

/**
 * Shelly Gen1 relay response.
 */
export const ShellyRelayResponseSchema = z.object({
  ison: z.boolean().optional(),
});

export type ShellyRelayResponse = z.infer<typeof ShellyRelayResponseSchema>;
