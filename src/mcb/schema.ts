/**
 * MCB Module - Schemas and Types
 *
 * Defines the data shapes for MCB (Main Circuit Breaker) control.
 * Schemas are the source of truth - types derived with z.infer<>.
 *
 * @see Rule #4 (Data First)
 */
import { z } from "zod";

// =============================================================================
// MCB Status
// =============================================================================

/**
 * MCB operational status values.
 */
export const McbStatusSchema = z.enum(["ON", "OFF", "UNKNOWN"]);

export type McbStatus = z.infer<typeof McbStatusSchema>;

// =============================================================================
// MCB Commands
// =============================================================================

/**
 * Commands that can be sent to the MCB.
 */
export const McbCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("TURN_ON") }),
  z.object({ type: z.literal("TURN_OFF") }),
]);

export type McbCommand = z.infer<typeof McbCommandSchema>;

// =============================================================================
// Tuya Cloud API Types
// =============================================================================

/**
 * Tuya API token response.
 */
export const TuyaTokenResponseSchema = z.object({
  success: z.boolean(),
  result: z
    .object({
      access_token: z.string(),
      expire_time: z.number(),
      refresh_token: z.string().optional(),
      uid: z.string().optional(),
    })
    .optional(),
  msg: z.string().optional(),
  code: z.number().optional(),
});

export type TuyaTokenResponse = z.infer<typeof TuyaTokenResponseSchema>;

/**
 * Tuya API command response.
 */
export const TuyaCommandResponseSchema = z.object({
  success: z.boolean(),
  result: z.boolean().optional(),
  msg: z.string().optional(),
  code: z.number().optional(),
});

export type TuyaCommandResponse = z.infer<typeof TuyaCommandResponseSchema>;

/**
 * Tuya API request signature headers.
 */
export type TuyaSignHeaders = Readonly<{
  client_id: string;
  sign_method: string;
  t: string;
  sign: string;
  access_token?: string;
  "Content-Type"?: string;
}>;

/**
 * Tuya command payload for device control.
 */
export const TuyaCommandPayloadSchema = z.object({
  commands: z.array(
    z.object({
      code: z.string(),
      value: z.boolean(),
    }),
  ),
});

export type TuyaCommandPayload = z.infer<typeof TuyaCommandPayloadSchema>;

// =============================================================================
// Local API Types (Python MCB API)
// =============================================================================

/**
 * Response from the Python MCB Local API status endpoint.
 */
export const LocalMcbStatusResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  device_id: z.string().optional(),
  dps_data: z
    .object({
      "1": z.boolean().optional(), // Switch state: true = ON, false = OFF
    })
    .passthrough()
    .optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type LocalMcbStatusResponse = z.infer<
  typeof LocalMcbStatusResponseSchema
>;

// =============================================================================
// Token Cache
// =============================================================================

/**
 * Cached Tuya access token.
 */
export type TuyaTokenCache = Readonly<{
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
}>;
