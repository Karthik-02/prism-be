import { createLogger, format, transports, addColors, type Logger } from "winston";

import { env } from "../config/env";
import { LOG_LEVEL, LOG_LEVEL_COLORS, LOG_LEVELS_PRIORITY } from "../config/log.constants";

addColors(LOG_LEVEL_COLORS);

const isProduction = env.NODE_ENV === "production";

const buildMetadata = (metadata: Record<string, unknown>): string =>
  Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : "";

const logFormatter = format.printf(({ timestamp, level, message, stack, ...metadata }) => {
  const content = stack ? `${message}\n${stack}` : message;
  return `${timestamp} ${level}: ${content}${buildMetadata(metadata)}`;
});

export const logger: Logger = createLogger({
  levels: LOG_LEVELS_PRIORITY,
  level: env.LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    ...(isProduction ? [] : [format.colorize({ all: true })]),
    logFormatter
  ),
  transports: [new transports.Console()],
  exitOnError: false
});

export { LOG_LEVEL };
