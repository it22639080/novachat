import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingRequestId = req.header("x-request-id");
  req.requestId = incomingRequestId && incomingRequestId.length <= 120 ? incomingRequestId : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
