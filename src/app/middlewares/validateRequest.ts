import { NextFunction, Request, Response } from "express";
import { ZodObject } from "zod";

const body =
  (schema: ZodObject) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await schema.parseAsync({
          body: req.body,
        });
        return next();
      } catch (err) {
        next(err);
      }
    };
export const query =
  (schema: ZodObject) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await schema.parseAsync({
          body: req.query,
        });
        return next();
      } catch (err) {
        next(err);
      }
    };
const validateRequest = { body, query }

export default validateRequest;
