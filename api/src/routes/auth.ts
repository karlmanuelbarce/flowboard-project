import { Router, Request } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';

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

router.post('/register', async (req: Request<{}, {}, RegisterInput>, res, next): Promise<void> => {
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
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, tokenId: randomUUID() },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.status(201).json({ success: true, data: { accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req: Request<{}, {}, LoginInput>, res, next): Promise<void> => {
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
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, tokenId: randomUUID() },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.json({ success: true, data: { accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
});

export default router;
