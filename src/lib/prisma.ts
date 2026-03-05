import { PrismaClient } from "@prisma/client";
import { LOG_CONTEXT } from "../config/log.constants";
import { logger } from "./logger";

export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "warn" },
    { emit: "event", level: "error" }
  ]
});

prisma.$on("warn", (event) => {
  logger.warn("Prisma warning", {
    context: LOG_CONTEXT.PRISMA,
    message: event.message,
    target: event.target
  });
});

prisma.$on("error", (event) => {
  logger.error("Prisma error", {
    context: LOG_CONTEXT.PRISMA,
    message: event.message,
    target: event.target
  });
});
