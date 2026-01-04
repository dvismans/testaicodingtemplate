/**
 * Greeting module public API.
 * Modules import from other modules via index.ts only - no deep imports.
 *
 * @see Rule #1, #2
 */
export { processGreeting } from "./service.js";
export type { GreetingError } from "./errors.js";
export type { GreetingRequest, GreetingResponse } from "./schema.js";
export { GreetingRequestSchema, GreetingResponseSchema } from "./schema.js";
