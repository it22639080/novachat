import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject, z } from "zod";

type RequestSchemas = {
  body?: AnyZodObject;
  params?: AnyZodObject;
  query?: AnyZodObject;
};

export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body) as z.infer<typeof schemas.body>;
    }

    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as z.infer<typeof schemas.params>;
    }

    if (schemas.query) {
      req.query = schemas.query.parse(req.query) as z.infer<typeof schemas.query>;
    }

    next();
  };
}
