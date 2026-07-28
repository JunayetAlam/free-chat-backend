import { NextFunction, Request, Response } from 'express';

const hasBody = (req: Request): boolean => {
  if (req.body === undefined || req.body === null) return false;
  if (typeof req.body === 'object') {
    return Object.keys(req.body).length > 0;
  }
  if (typeof req.body === 'string') {
    return req.body.trim().length > 0;
  }
  return true;
};

const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
  const bodyPresent = hasBody(req);

  console.log(
    `[Request] method=${req.method} route=${req.originalUrl} body=${bodyPresent ? 'yes' : 'no'}`,
  );

  if (bodyPresent) {
    console.log('[Request] body=', req.body);
  }

  next();
};

export default requestLogger;
