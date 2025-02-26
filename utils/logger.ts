import { green, yellow } from "./colors.ts";
import { getErrorDetails } from "./errors.ts";

// logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export type LogContext = Record<string, unknown>;

interface LoggerOptions {
  serviceName?: string;
  minLevel?: LogLevel;
  defaultContext?: LogContext;
}

export class Logger {
  private serviceName: string;
  private minLevel: LogLevel;
  private defaultContext: LogContext;

  constructor(options: LoggerOptions = {}) {
    this.serviceName = options.serviceName || "app";
    this.minLevel =
      options.minLevel !== undefined ? options.minLevel : LogLevel.DEBUG;
    this.defaultContext = options.defaultContext || {};
  }

  child(context: LogContext): Logger {
    return new Logger({
      serviceName: this.serviceName,
      minLevel: this.minLevel,
      defaultContext: { ...this.defaultContext, ...context },
    });
  }

  private log(level: LogLevel, message: string, context: LogContext = {}) {
    if (level < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const mergedContext = { ...this.defaultContext, ...context };
    // For the cotnextStr, separate the default context and the additional context on two lines
    let contextStr: string | null =
      (Object.keys(context).length
        ? "\n" + yellow("Context:") + JSON.stringify(context, null, 2)
        : "") +
      (Object.keys(this.defaultContext).length
        ? "\n" +
          yellow("Default Context:") +
          JSON.stringify(this.defaultContext, null, 2)
        : "");

    if (contextStr.trim() === "") {
      contextStr = null;
    }

    const logEntry = {
      timestamp,
      level: levelStr,
      service: this.serviceName,
      message,
      ...mergedContext,
    };

    const completeString = `[${timestamp}] [${levelStr}] ${green(
      `[${this.serviceName}]`
    )} ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        contextStr
          ? console.debug(completeString, contextStr)
          : console.debug(completeString);
        break;
      case LogLevel.INFO:
        contextStr
          ? console.info(completeString, contextStr)
          : console.info(completeString);
        break;
      case LogLevel.WARN:
        contextStr
          ? console.warn(completeString, contextStr)
          : console.warn(completeString);
        break;
      case LogLevel.ERROR:
        contextStr
          ? console.error(completeString, contextStr)
          : console.error(completeString);
        break;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(logEntry) + "\n");
    const today = new Date().toISOString().split("T")[0];
    const fileName = `logs/${today}.log`;
    Deno.writeFile(fileName, data, { append: true });
  }

  debug(message: string, context: LogContext = {}) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context: LogContext = {}) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context: LogContext = {}) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context: LogContext = {}) {
    this.log(LogLevel.ERROR, message, context);
  }

  withHandler(handlerName: string): Logger {
    return this.child({ handler: handlerName });
  }

  /**
   * Safely logs an error with the logger
   * @param logger Logger instance
   * @param message Log message
   * @param error The error object
   * @param additionalContext Optional additional context
   */
  logError(
    message: string,
    error: unknown,
    additionalContext: Record<string, unknown> = {}
  ) {
    const errorDetails = getErrorDetails(error);
    this.error(message, { ...errorDetails, ...additionalContext });
  }
}

export const createLogger = (
  serviceName: string,
  defaultContext: LogContext = {}
): Logger => {
  const minLevel = getLogLevelFromEnv();
  return new Logger({ serviceName, minLevel, defaultContext });
};

function getLogLevelFromEnv(): LogLevel {
  const envLevel = Deno.env.get("LOG_LEVEL")?.toUpperCase();
  switch (envLevel) {
    case "DEBUG":
      return LogLevel.DEBUG;
    case "INFO":
      return LogLevel.INFO;
    case "WARN":
      return LogLevel.WARN;
    case "ERROR":
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO; // Default to INFO
  }
}
