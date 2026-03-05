import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { HTTP_MESSAGE, HTTP_STATUS } from "../config/http.constants";
import { LOG_CONTEXT } from "../config/log.constants";
import { AppError } from "../lib/app-error";
import { logger } from "../lib/logger";

const toErrorMetadata = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? {
        errorMessage: error.message,
        stack: error.stack
      }
    : {
        error: String(error)
      };

export const notFoundHandler: RequestHandler = (req, res) => {
  logger.warn("Route not found", {
    context: LOG_CONTEXT.ERROR_HANDLER,
    method: req.method,
    path: req.originalUrl
  });

  res.status(HTTP_STATUS.NOT_FOUND).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = res.locals.requestId as string | undefined;
  const requestMetadata = {
    context: LOG_CONTEXT.ERROR_HANDLER,
    requestId,
    method: req.method,
    path: req.originalUrl
  };

  if (error instanceof ZodError) {
    logger.warn("Validation error", {
      ...requestMetadata,
      issues: error.flatten().fieldErrors
    });

    res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: HTTP_MESSAGE.VALIDATION_FAILED,
      issues: error.flatten().fieldErrors
    });
    return;
  }

  if (error instanceof AppError) {
    const logMethod = error.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR ? logger.error : logger.warn;

    logMethod("Application error", {
      ...requestMetadata,
      statusCode: error.statusCode,
      details: error.details,
      message: error.message
    });

    res.status(error.statusCode).json({
      message: error.message,
      details: error.details
    });
    return;
  }

  logger.error("Unhandled server error", {
    ...requestMetadata,
    ...toErrorMetadata(error)
  });

  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    message: HTTP_MESSAGE.INTERNAL_SERVER_ERROR
  });
};
