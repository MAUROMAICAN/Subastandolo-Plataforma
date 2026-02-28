/**
 * Logger ligero para la app.
 * En desarrollo imprime a consola; en producción puede enviar a un servicio.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel = import.meta.env.DEV ? "debug" : "warn";
const minLevelNum = LOG_LEVELS[minLevel as LogLevel] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= minLevelNum;
}

function formatMsg(tag: string, message: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${tag}] ${message}`;
}

export const logger = {
  debug(tag: string, message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.debug(formatMsg(tag, message), ...args);
    }
  },
  info(tag: string, message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.info(formatMsg(tag, message), ...args);
    }
  },
  warn(tag: string, message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(formatMsg(tag, message), ...args);
    }
  },
  error(tag: string, message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(formatMsg(tag, message), ...args);
    }
  },
};
