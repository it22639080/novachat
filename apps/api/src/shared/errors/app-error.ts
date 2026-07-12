export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(params: { statusCode: number; code: string; message: string; details?: unknown }) {
    super(params.message);
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
  }
}

export const unauthorized = (message = "Authentication is required") =>
  new AppError({ statusCode: 401, code: "UNAUTHORIZED", message });

export const badRequest = (message = "Bad request", details?: unknown) =>
  new AppError({ statusCode: 400, code: "BAD_REQUEST", message, details });

export const forbidden = (message = "You do not have permission to perform this action") =>
  new AppError({ statusCode: 403, code: "FORBIDDEN", message });

export const notFound = (message = "Resource not found") =>
  new AppError({ statusCode: 404, code: "NOT_FOUND", message });

export const conflict = (message = "Resource conflict") =>
  new AppError({ statusCode: 409, code: "CONFLICT", message });

export const paymentRequired = (code: string, message: string, details?: unknown) =>
  new AppError({ statusCode: 402, code, message, details });

export const badGateway = (code: string, message: string, details?: unknown) =>
  new AppError({ statusCode: 502, code, message, details });

export const serviceUnavailable = (code: string, message: string, details?: unknown) =>
  new AppError({ statusCode: 503, code, message, details });
