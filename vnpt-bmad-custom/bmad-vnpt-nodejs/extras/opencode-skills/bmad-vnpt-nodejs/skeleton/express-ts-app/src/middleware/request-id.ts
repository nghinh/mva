import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header('x-request-id') || randomUUID();
  res.setHeader('x-request-id', requestId);
  next();
}
