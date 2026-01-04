/**
 * Greeting transformations - pure functions with no side effects.
 * Each function does ONE thing: (input: A) => B
 *
 * @see Rule #5, #6, #8-14
 */
import { type Result, err, ok } from "neverthrow";
import { config } from "../config.js";
import { type GreetingError, forbiddenNameError } from "./errors.js";
import type { GreetingRequest, GreetingResponse } from "./schema.js";

/**
 * List of forbidden names (business rule).
 * In a real app, this might come from config or database.
 */
const FORBIDDEN_NAMES: ReadonlyArray<string> = ["error", "fail", "crash"];

/**
 * Validates business rules for greeting.
 * Pure function - returns Result, doesn't throw.
 */
export const validateGreetingRules = (
  request: GreetingRequest,
): Result<GreetingRequest, GreetingError> => {
  const lowerName = request.name.toLowerCase();

  const forbidden = FORBIDDEN_NAMES.find((f) => lowerName.includes(f));
  if (forbidden) {
    return err(
      forbiddenNameError(
        request.name,
        `Name contains forbidden word: ${forbidden}`,
      ),
    );
  }

  return ok(request);
};

/**
 * Formats name for greeting (capitalize first letter).
 * Pure transformation.
 */
export const formatName = (name: string): string => {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/**
 * Creates greeting message from validated request.
 * Pure function - no side effects.
 */
export const createGreetingMessage = (name: string): string => {
  const formattedName = formatName(name);
  const baseMessage = `Hello, ${formattedName}! Welcome to ${config.APP_NAME}.`;

  // Feature flag controls emoji (disabled by default per UI rules)
  if (config.ENABLE_GREETING_EMOJI) {
    return `${baseMessage} 👋`;
  }

  return baseMessage;
};

/**
 * Builds complete greeting response.
 * Pure function - takes all dependencies as parameters.
 */
export const buildGreetingResponse = (
  name: string,
  requestId: string,
): GreetingResponse => ({
  message: createGreetingMessage(name),
  timestamp: new Date().toISOString(),
  requestId,
});
