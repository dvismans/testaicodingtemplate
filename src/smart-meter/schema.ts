/**
 * Smart Meter Module - Schemas and Types
 *
 * Defines the data shapes for smart meter readings and threshold checks.
 * Schemas are the source of truth - types derived with z.infer<>.
 *
 * @see Rule #4 (Data First)
 */
import { z } from "zod";

// =============================================================================
// Phase Data
// =============================================================================

/**
 * Amperage data for all three phases.
 */
export const PhaseDataSchema = z.object({
  l1: z.number().describe("L1 phase amperage in amps"),
  l2: z.number().describe("L2 phase amperage in amps"),
  l3: z.number().describe("L3 phase amperage in amps"),
});

export type PhaseData = Readonly<z.infer<typeof PhaseDataSchema>>;

/**
 * Phase identifiers.
 */
export type PhaseId = "L1" | "L2" | "L3";

// =============================================================================
// Threshold Result
// =============================================================================

/**
 * Information about a phase that exceeded the threshold.
 */
export type ExceededPhase = Readonly<{
  phase: PhaseId;
  amperage: number;
}>;

/**
 * Result of threshold check - either no phases exceeded or a list of exceeded phases.
 */
export type ThresholdResult =
  | { readonly exceeds: false }
  | { readonly exceeds: true; readonly phases: ReadonlyArray<ExceededPhase> };

// =============================================================================
// Smart Meter API Response
// =============================================================================

/**
 * Raw response from the smart meter API.
 * The API returns an array of readings, each reading is an array of values.
 * Indices 11, 12, 13 contain L1, L2, L3 amperage.
 */
export const SmartMeterRawResponseSchema = z.array(
  z.array(z.union([z.string(), z.number(), z.null()])),
);

export type SmartMeterRawResponse = z.infer<typeof SmartMeterRawResponseSchema>;
