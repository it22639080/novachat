import type { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId: res.req.requestId,
      timestamp: new Date().toISOString()
    }
  });
}

export function sendFailure(
  res: Response,
  error: { code: string; message: string; details?: unknown },
  statusCode: number
) {
  return res.status(statusCode).json({
    success: false,
    error,
    meta: {
      requestId: res.req.requestId,
      timestamp: new Date().toISOString()
    }
  });
}
