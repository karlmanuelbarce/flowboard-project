import { Router, Request } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { rateLimiter } from '../middleware/rateLimiter';
import redis from '../lib/redis';

const REFRESH_TTL = 7 * 24 * 60 * 60;

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

router.post('/register', rateLimiter, async (req: Request<{}, {}, RegisterInput>, res, next): Promise<void> => {
  try {
    const { email, password } = RegisterSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already in use', 409, 'EMAIL_IN_USE');

    const hashedPw = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, password: hashedPw } });

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' },
    );
    const tokenId = randomUUID();
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, tokenId },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
    await redis.set(`refresh:${user.id}:${tokenId}`, '1', 'EX', REFRESH_TTL);

    res.status(201).json({ success: true, data: { accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', rateLimiter, async (req: Request<{}, {}, LoginInput>, res, next): Promise<void> => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' },
    );
    const tokenId = randomUUID();
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, tokenId },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
    await redis.set(`refresh:${user.id}:${tokenId}`, '1', 'EX', REFRESH_TTL);

    res.json({ success: true, data: { accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
});

const RefreshSchema = z.object({ refreshToken: z.string() });

router.post('/refresh', async (req, res, next): Promise<void> => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);

    let payload: { userId: string; email: string; tokenId: string };
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as typeof payload;
    } catch {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const exists = await redis.get(`refresh:${payload.userId}:${payload.tokenId}`);
    if (!exists) throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');

    await redis.del(`refresh:${payload.userId}:${payload.tokenId}`);

    const accessToken = jwt.sign(
      { userId: payload.userId, email: payload.email },
      JWT_SECRET,
      { expiresIn: '15m' },
    );
    const newTokenId = randomUUID();
    const newRefreshToken = jwt.sign(
      { userId: payload.userId, email: payload.email, tokenId: newTokenId },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
    await redis.set(`refresh:${payload.userId}:${newTokenId}`, '1', 'EX', REFRESH_TTL);

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next): Promise<void> => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);

    try {
      const payload = jwt.verify(refreshToken, JWT_SECRET) as {
        userId: string;
        tokenId: string;
      };
      await redis.del(`refresh:${payload.userId}:${payload.tokenId}`);
    } catch {
      // invalid or expired token — nothing to delete, treat as already logged out
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
