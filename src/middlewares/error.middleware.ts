import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: Array<{ field: string; message: string }> | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ZodError' && 'issues' in err) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = (err as any).issues.map((issue: any) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  }

  logger.error({ err, statusCode }, 'Request error');

  const errorResponse: Record<string, unknown> = { code, message };

  if (details) {
    errorResponse.details = details;
  }

  if (env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json({
    success: false,
    error: errorResponse,
  });
};
