/**
 * Ventilator Module - Pure Transformations
 *
 * Pure functions for ventilator state calculations.
 * No side effects, no I/O - just data in, data out.
 *
 * @see Rule #5 (Pure Transformations), #8 (Immutability)
 */
import type { VentilatorConfig, VentilatorState } from "./schema.js";

// =============================================================================
// Timer Calculations
// =============================================================================

/**
 * Calculate the end time for a delayed OFF timer.
 *
 * @param config - Ventilator configuration
 * @param now - Current timestamp in ms
 * @returns Timestamp when the timer should end
 */
export function calculateDelayEndTime(
  config: VentilatorConfig,
  now: number,
): number {
  return now + config.delayOffMinutes * 60 * 1000;
}

/**
 * Check if it's time to reset the keep-alive timer.
 *
 * @param lastReset - Last keep-alive reset timestamp in ms
 * @param intervalMinutes - Keep-alive interval in minutes
 * @param now - Current timestamp in ms
 * @returns True if keep-alive should be triggered
 */
export function shouldResetKeepAlive(
  lastReset: number,
  intervalMinutes: number,
  now: number,
): boolean {
  const intervalMs = intervalMinutes * 60 * 1000;
  return now - lastReset >= intervalMs;
}

/**
 * Calculate remaining time on delayed OFF timer.
 *
 * @param delayEndTime - When the timer will end
 * @param now - Current timestamp in ms
 * @returns Remaining milliseconds (0 if expired or no timer)
 */
export function calculateRemainingDelayMs(
  delayEndTime: number | null,
  now: number,
): number {
  if (delayEndTime === null) {
    return 0;
  }

  const remaining = delayEndTime - now;
  return remaining > 0 ? remaining : 0;
}

/**
 * Format remaining time for display.
 *
 * @param remainingMs - Remaining milliseconds
 * @returns Formatted string like "5:30" or "0:00"
 */
export function formatRemainingTime(remainingMs: number): string {
  if (remainingMs <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// =============================================================================
// State Updates (Immutable)
// =============================================================================

/**
 * Update ventilator state with new status.
 *
 * @param state - Current state
 * @param status - New relay status
 * @param now - Current timestamp
 * @returns New state with updated status
 */
export function updateVentilatorStatus(
  state: VentilatorState,
  status: boolean | null,
  now: number,
): VentilatorState {
  return {
    ...state,
    status,
    lastUpdate: now,
  };
}

/**
 * Start delayed OFF timer.
 *
 * @param state - Current state
 * @param endTime - When the timer should end
 * @returns New state with delayed OFF scheduled
 */
export function startDelayedOff(
  state: VentilatorState,
  endTime: number,
): VentilatorState {
  return {
    ...state,
    delayedOffEndTime: endTime,
  };
}

/**
 * Clear delayed OFF timer.
 *
 * @param state - Current state
 * @returns New state with timer cleared
 */
export function clearDelayedOff(state: VentilatorState): VentilatorState {
  return {
    ...state,
    delayedOffEndTime: null,
  };
}

/**
 * Start keep-alive cycling.
 *
 * @param state - Current state
 * @returns New state with keep-alive active
 */
export function startKeepAlive(state: VentilatorState): VentilatorState {
  return {
    ...state,
    keepAliveActive: true,
  };
}

/**
 * Stop keep-alive cycling.
 *
 * @param state - Current state
 * @returns New state with keep-alive inactive
 */
export function stopKeepAlive(state: VentilatorState): VentilatorState {
  return {
    ...state,
    keepAliveActive: false,
  };
}

/**
 * Reset ventilator state to initial.
 *
 * @returns Fresh initial state
 */
export function resetState(): VentilatorState {
  return {
    status: null,
    delayedOffEndTime: null,
    keepAliveActive: false,
    lastUpdate: null,
  };
}
