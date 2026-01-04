/**
 * MCB Module - Public API
 *
 * Exports only what's needed by other modules.
 * Internal implementation details stay hidden.
 *
 * @see Rule #2 (Module Boundaries are Contracts)
 */

// Types
export type { McbStatus, McbCommand } from "./schema.js";
export type { McbError } from "./errors.js";

// Error utilities
export { formatMcbError } from "./errors.js";

// Service functions (side effects)
export {
  turnMcbOn,
  turnMcbOff,
  getMcbStatus,
  clearTokenCache,
} from "./service.js";

// Pure transformations (for testing)
export {
  buildCommandPayload,
  buildCommandPath,
  parseLocalMcbStatus,
  isTokenValid,
  calculateTokenExpiry,
} from "./transform.js";
