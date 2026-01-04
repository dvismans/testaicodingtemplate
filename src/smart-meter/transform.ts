/**
 * Smart Meter Module - Pure Transformations
 *
 * Pure functions for smart meter data transformations.
 * No side effects, no I/O - just data in, data out.
 *
 * @see Rule #5 (Pure Transformations), #8 (Immutability)
 */
import type {
  ExceededPhase,
  PhaseData,
  PhaseId,
  SmartMeterRawResponse,
  ThresholdResult,
} from "./schema.js";

// =============================================================================
// Threshold Checking
// =============================================================================

/**
 * Check if any phase exceeds the amperage threshold.
 *
 * @param data - Phase amperage data
 * @param threshold - Maximum allowed amperage
 * @returns ThresholdResult indicating which phases (if any) exceeded
 *
 * @example
 * const result = checkThresholds({ l1: 20, l2: 30, l3: 15 }, 25);
 * // { exceeds: true, phases: [{ phase: 'L2', amperage: 30 }] }
 */
export function checkThresholds(
  data: PhaseData,
  threshold: number,
): ThresholdResult {
  const exceededPhases: ExceededPhase[] = [];

  if (data.l1 > threshold) {
    exceededPhases.push({ phase: "L1", amperage: data.l1 });
  }

  if (data.l2 > threshold) {
    exceededPhases.push({ phase: "L2", amperage: data.l2 });
  }

  if (data.l3 > threshold) {
    exceededPhases.push({ phase: "L3", amperage: data.l3 });
  }

  if (exceededPhases.length === 0) {
    return { exceeds: false };
  }

  return { exceeds: true, phases: exceededPhases };
}

/**
 * Format threshold result for logging or notification.
 *
 * @param result - The threshold check result
 * @returns Human-readable string describing exceeded phases
 *
 * @example
 * formatThresholdResult({ exceeds: true, phases: [{ phase: 'L2', amperage: 30 }] })
 * // "L2 (30A)"
 */
export function formatThresholdResult(result: ThresholdResult): string {
  if (!result.exceeds) {
    return "No phases exceeded threshold";
  }

  return result.phases.map((p) => `${p.phase} (${p.amperage}A)`).join(", ");
}

// =============================================================================
// Response Parsing
// =============================================================================

/**
 * Parse raw smart meter API response into PhaseData.
 *
 * The smart meter API returns an array of readings.
 * Each reading is an array where:
 * - Index 11: L1 amperage
 * - Index 12: L2 amperage
 * - Index 13: L3 amperage
 *
 * @param response - Raw API response
 * @returns PhaseData or null if parsing fails
 */
export function parseSmartMeterResponse(
  response: SmartMeterRawResponse,
): PhaseData | null {
  if (!Array.isArray(response) || response.length === 0) {
    return null;
  }

  const latestReading = response[0];

  if (!Array.isArray(latestReading) || latestReading.length < 14) {
    return null;
  }

  // Extract amperage values from indices 11, 12, 13
  const l1Raw = latestReading[11];
  const l2Raw = latestReading[12];
  const l3Raw = latestReading[13];

  // Parse as integers, defaulting to 0 for invalid values
  const l1 = parseAmperageValue(l1Raw);
  const l2 = parseAmperageValue(l2Raw);
  const l3 = parseAmperageValue(l3Raw);

  return { l1, l2, l3 };
}

/**
 * Parse a raw amperage value to a number.
 *
 * @param value - Raw value from API (string, number, or null)
 * @returns Parsed number or 0 for invalid values
 */
function parseAmperageValue(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

// =============================================================================
// Phase Utilities
// =============================================================================

/**
 * Get all phase IDs.
 */
export const PHASE_IDS: ReadonlyArray<PhaseId> = ["L1", "L2", "L3"] as const;

/**
 * Get amperage for a specific phase.
 *
 * @param data - Phase data
 * @param phase - Phase identifier
 * @returns Amperage value
 */
export function getPhaseAmperage(data: PhaseData, phase: PhaseId): number {
  switch (phase) {
    case "L1":
      return data.l1;
    case "L2":
      return data.l2;
    case "L3":
      return data.l3;
  }
}

/**
 * Calculate total amperage across all phases.
 *
 * @param data - Phase data
 * @returns Sum of all phase amperages
 */
export function getTotalAmperage(data: PhaseData): number {
  return data.l1 + data.l2 + data.l3;
}

/**
 * Get the maximum amperage across all phases.
 *
 * @param data - Phase data
 * @returns Maximum amperage and which phase has it
 */
export function getMaxAmperage(
  data: PhaseData,
): Readonly<{ phase: PhaseId; amperage: number }> {
  const values: Array<{ phase: PhaseId; amperage: number }> = [
    { phase: "L1", amperage: data.l1 },
    { phase: "L2", amperage: data.l2 },
    { phase: "L3", amperage: data.l3 },
  ];

  return values.reduce((max, curr) =>
    curr.amperage > max.amperage ? curr : max,
  );
}
