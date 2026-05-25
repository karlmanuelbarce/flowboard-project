import { Request, Response, NextFunction } from 'express';
import redis from '../lib/redis';
import { AppError } from '../errors/AppError';

const WINDOW_SECONDS = 15 * 60;
const MAX_REQUESTS = 100;

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = `rate:${req.ip ?? 'unknown'}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
    if (count > MAX_REQUESTS) {
      return next(new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED'));
    }
    next();
  } catch (err) {
    console.warn('Rate limiter Redis error, failing open:', err);
    next();
  }
}
