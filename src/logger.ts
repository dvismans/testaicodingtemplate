/**
 * Module-scoped color-coded loggers using pino.
 * Each module gets its own named logger with assigned color.
 *
 * @see Rule #27-32
 */
import pino from "pino";
import { config } from "./config.js";

// ANSI color codes for module identification
const MODULE_COLORS = {
  api: "\x1b[34m", // blue
  greeting: "\x1b[36m", // cyan
  health: "\x1b[32m", // green
  middleware: "\x1b[33m", // yellow
} as const;

const RESET = "\x1b[0m";

type ModuleName = keyof typeof MODULE_COLORS;

/**
 * Creates a module-scoped logger with color-coded output.
 * Use at the top of each module file.
 *
 * @example
 * ```typescript
 * // src/greeting/service.ts
 * import { createLogger } from '../logger';
 * const log = createLogger('greeting');
 *
 * log.info({ name }, 'Processing greeting');
 * ```
 */
export const createLogger = (module: ModuleName) => {
  const color = MODULE_COLORS[module];

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
};

// Re-export pino types for convenience
export type { Logger } from "pino";
