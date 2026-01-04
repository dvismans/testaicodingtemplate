/**
 * Greeting module schemas - define data shapes BEFORE writing logic.
 * Schemas are the source of truth - derive types with z.infer<>.
 *
 * @see Rule #4 (Data First)
 */
import { z } from "zod";

/**
 * Input schema for greeting requests.
 * Validates at system boundary.
 */
export const GreetingRequestSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .describe("Name to greet"),
});

/**
 * Output schema for greeting responses.
 */
export const GreetingResponseSchema = z.object({
  message: z.string().describe("The greeting message"),
  timestamp: z.string().datetime().describe("ISO timestamp of greeting"),
  requestId: z.string().uuid().describe("Request trace ID"),
});

// Derived types - never define these separately from schemas
export type GreetingRequest = z.infer<typeof GreetingRequestSchema>;
export type GreetingResponse = z.infer<typeof GreetingResponseSchema>;
