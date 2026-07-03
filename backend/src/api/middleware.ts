import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { TelemetryModel } from '../models/telemetry.js';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error handled by middleware:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
  });
}

export function validateBody(schema: any) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function latencyLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInMs = (diff[0] * 1e9 + diff[1]) / 1e6;
    console.log(`[Telemetry] HTTP ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${durationInMs.toFixed(2)}ms`);
    
    TelemetryModel.create({
      event_type: 'http_request',
      name: `${req.method} ${req.originalUrl}`,
      provider: 'express',
      duration_ms: Number(durationInMs.toFixed(2)),
      status: String(res.statusCode),
    }).catch(err => console.error('[Telemetry] Failed to save http_request log:', err));
  });
  next();
}


