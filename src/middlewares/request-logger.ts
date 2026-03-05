import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../config/http.constants";
import { LOG_CONTEXT } from "../config/log.constants";
import { logger } from "../lib/logger";

const toMilliseconds = (startTime: bigint): number => {
  const elapsedNanoseconds = process.hrtime.bigint() - startTime;
  return Number(elapsedNanoseconds) / 1_000_000;
};

export const requestLogger: RequestHandler = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const requestId = req.header("x-request-id") ?? randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationMs = toMilliseconds(startTime);
    const metadata = {
      context: LOG_CONTEXT.REQUEST,
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: req.auth?.userId
    };

    if (res.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      logger.error("Request completed with server error", metadata);
      return;
    }

    if (res.statusCode >= HTTP_STATUS.BAD_REQUEST) {
      logger.warn("Request completed with client error", metadata);
      return;
    }

    logger.http("Request completed", metadata);
  });

  next();
};
