/**
 * Greeting module error types - typed error unions, not strings.
 * Errors carry context about what failed.
 *
 * @see Rule #31, #87
 */
import type { ZodIssue } from "zod";

/**
 * Typed error union for greeting operations.
 * Each variant includes context for debugging.
 */
export type GreetingError =
  | {
      readonly type: "VALIDATION_FAILED";
      readonly issues: ReadonlyArray<ZodIssue>;
    }
  | {
      readonly type: "NAME_FORBIDDEN";
      readonly name: string;
      readonly reason: string;
    };

/**
 * Helper to create validation error.
 */
export const validationError = (
  issues: ReadonlyArray<ZodIssue>,
): GreetingError => ({
  type: "VALIDATION_FAILED",
  issues,
});

/**
 * Helper to create forbidden name error.
 */
export const forbiddenNameError = (
  name: string,
  reason: string,
): GreetingError => ({
  type: "NAME_FORBIDDEN",
  name,
  reason,
});
