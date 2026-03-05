import type { Server } from "node:http";

import { env } from "./config/env";
import { LOG_CONTEXT } from "./config/log.constants";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { app } from "./app";

let server: Server | undefined;

const toErrorMetadata = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? {
        errorMessage: error.message,
        stack: error.stack
      }
    : {
        error: String(error)
      };

const shutdown = async (signal: string): Promise<void> => {
  logger.info("Shutdown initiated", {
    context: LOG_CONTEXT.SERVER,
    signal
  });

  if (!server) {
    await prisma.$disconnect();
    process.exit(0);
    return;
  }

  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info("Database disconnected", {
        context: LOG_CONTEXT.SERVER
      });
      process.exit(0);
    } catch (error) {
      logger.error("Error while disconnecting database during shutdown", {
        context: LOG_CONTEXT.SERVER,
        ...toErrorMetadata(error)
      });
      process.exit(1);
    }
  });
};

const bootstrap = async (): Promise<void> => {
  try {
    await prisma.$connect();

    logger.info("Database connection established", {
      context: LOG_CONTEXT.SERVER
    });

    server = app.listen(env.PORT, () => {
      logger.info("PRism backend listening", {
        context: LOG_CONTEXT.SERVER,
        port: env.PORT,
        environment: env.NODE_ENV
      });
    });
  } catch (error) {
    logger.error("Failed to start backend server", {
      context: LOG_CONTEXT.SERVER,
      ...toErrorMetadata(error)
    });
    process.exit(1);
  }
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    context: LOG_CONTEXT.SERVER,
    reason: reason instanceof Error ? reason.message : String(reason),
    ...(reason instanceof Error ? { stack: reason.stack } : {})
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    context: LOG_CONTEXT.SERVER,
    ...toErrorMetadata(error)
  });
  process.exit(1);
});

void bootstrap();
