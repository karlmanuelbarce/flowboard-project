import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isAppError(err)) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      errors: err.errors,
    });
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    message: isProd ? 'Internal server error' : (err as Error).message,
    code: 'INTERNAL_ERROR',
  });
}
