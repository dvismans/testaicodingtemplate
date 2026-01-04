/**
 * Module-scoped color-coded loggers for the Sauna Control System.
 *
 * Each module gets its own named logger with an assigned color for
 * easy visual identification in development logs.
 *
 * @see Rule #27-32 (Traceability & Observability)
 */
import pino from "pino";
import { config } from "./config.js";

/**
 * Module color assignments for visual log differentiation.
 * Colors use ANSI escape codes.
 */
const MODULE_COLORS: Record<string, string> = {
  // Core modules
  api: "\x1b[34m", // blue
  monitoring: "\x1b[33m", // yellow

  // Device control modules
  mcb: "\x1b[36m", // cyan
  meter: "\x1b[35m", // magenta
  ventilator: "\x1b[32m", // green

  // Communication modules
  mqtt: "\x1b[91m", // bright red
  sse: "\x1b[94m", // bright blue
  notifications: "\x1b[95m", // bright magenta

  // Infrastructure
  config: "\x1b[90m", // gray
};

const RESET = "\x1b[0m";

/**
 * Valid module names for type safety.
 */
export type ModuleName = keyof typeof MODULE_COLORS;

/**
 * Create a module-scoped logger with color-coded output.
 *
 * @param module - The module name (must be one of the predefined modules)
 * @returns A pino logger instance configured for the module
 *
 * @example
 * const log = createLogger('mcb');
 * log.info({ deviceId }, 'Turning MCB ON');
 */
export function createLogger(module: ModuleName): pino.Logger {
  const color = MODULE_COLORS[module] ?? "\x1b[37m"; // default white

  const isDevelopment = config.NODE_ENV === "development";

  if (isDevelopment) {
    // Pretty printing for development
    return pino({
      name: module,
      level: config.LOG_LEVEL,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          messageFormat: `${color}[{name}]${RESET} {msg}`,
          ignore: "pid,hostname",
          translateTime: "HH:MM:ss",
        },
      },
    });
  }

  // Structured JSON for production
  return pino({
    name: module,
    level: config.LOG_LEVEL,
  });
}

/**
 * Log operation entry with consistent format.
 */
export function logOperationStart(
  logger: pino.Logger,
  operation: string,
  context: Record<string, unknown> = {},
): void {
  logger.info({ operation, ...context }, `→ ${operation} started`);
}

/**
 * Log operation completion with duration.
 */
export function logOperationComplete(
  logger: pino.Logger,
  operation: string,
  startTime: number,
  context: Record<string, unknown> = {},
): void {
  const durationMs = Date.now() - startTime;
  logger.info(
    { operation, durationMs, ...context },
    `✓ ${operation} completed (${durationMs}ms)`,
  );
}

/**
 * Log operation failure with error details.
 */
export function logOperationFailed(
  logger: pino.Logger,
  operation: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(
    { operation, error: errorMessage, ...context },
    `✗ ${operation} failed: ${errorMessage}`,
  );
}
