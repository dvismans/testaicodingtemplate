/**
 * Greeting service - orchestrates transformations and handles side effects.
 * This is the "imperative shell" that wraps pure functions.
 *
 * @see Rule #5, #43, #87
 */
import { type Result, err, ok } from "neverthrow";
import { createLogger } from "../logger.js";
import { type GreetingError, validationError } from "./errors.js";
import { GreetingRequestSchema, type GreetingResponse } from "./schema.js";
import { buildGreetingResponse, validateGreetingRules } from "./transform.js";

const log = createLogger("greeting");

/**
 * Process a greeting request.
 * Orchestration reads like a spec: parse → validate → build response
 *
 * @see Rule #43 (Self-Documenting Flow)
 */
export const processGreeting = (
  rawInput: unknown,
  requestId: string,
): Result<GreetingResponse, GreetingError> => {
  log.info({ operation: "processGreeting", requestId }, "→ Starting greeting");

  // Step 1: Parse input (Zod validation at boundary)
  const parsed = GreetingRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    log.warn(
      { operation: "processGreeting", requestId, issues: parsed.error.issues },
      "  ↳ Validation failed",
    );
    return err(validationError(parsed.error.issues));
  }

  log.debug(
    { operation: "processGreeting", requestId, name: parsed.data.name },
    "  ↳ Input parsed",
  );

  // Step 2: Validate business rules
  const validationResult = validateGreetingRules(parsed.data);
  if (validationResult.isErr()) {
    log.warn(
      {
        operation: "processGreeting",
        requestId,
        error: validationResult.error,
      },
      "  ↳ Business rule validation failed",
    );
    return err(validationResult.error);
  }

  log.debug(
    { operation: "processGreeting", requestId },
    "  ↳ Business rules passed",
  );

  // Step 3: Build response
  const response = buildGreetingResponse(parsed.data.name, requestId);

  log.info(
    { operation: "processGreeting", requestId, message: response.message },
    "✓ Greeting completed",
  );

  return ok(response);
};
