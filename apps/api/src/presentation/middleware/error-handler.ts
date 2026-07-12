import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../../infrastructure/logger/logger.js";
import { AppError } from "../../shared/errors/app-error.js";
import { sendFailure } from "../../shared/http/api-response.js";

function isDatabaseUnavailableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; name?: string; message?: string };

  return (
    maybeError.code === "P1000" ||
    maybeError.code === "P1001" ||
    maybeError.code === "P1002" ||
    maybeError.code === "P1003" ||
    maybeError.name === "PrismaClientInitializationError" ||
    Boolean(maybeError.message?.includes("Can't reach database server"))
  );
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    sendFailure(
      res,
      {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten()
      },
      400
    );
    return;
  }

  if (error instanceof AppError) {
    sendFailure(
      res,
      {
        code: error.code,
        message: error.message,
        details: error.details
      },
      error.statusCode
    );
    return;
  }

  if (isDatabaseUnavailableError(error)) {
    logger.error({ err: error, requestId: req.requestId }, "Database is unavailable");
    sendFailure(
      res,
      {
        code: "DATABASE_UNAVAILABLE",
        message: "Database is unavailable. Check that Postgres is running and migrations are applied."
      },
      503
    );
    return;
  }

  logger.error({ err: error, requestId: req.requestId }, "Unhandled API error");
  sendFailure(res, { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" }, 500);
};
