import request from 'supertest';
import Redis from 'ioredis';
import app from '../src/app';

const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT) ?? 6379,
});

beforeAll(async () => {
  // Clear any leftover rate keys from previous test runs
  const keys = await redis.keys('rate:*');
  if (keys.length > 0) await redis.del(...keys);
});

afterAll(async () => {
  const keys = await redis.keys('rate:*');
  if (keys.length > 0) await redis.del(...keys);
  await redis.quit();
});

describe('Rate limiter on POST /auth/login', () => {
  it('allows up to 100 requests then blocks with 429', async () => {
    // Consume MAX_REQUESTS (100) by hitting a route that returns quickly (non-existent user).
    // Each request is ~one DB lookup that returns null — no bcrypt involved.
    for (let i = 0; i < 100; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'no-such-user@ratelimit.test', password: 'anything' });
      expect(res.status).toBe(401);
    }

    // Request 101 should be rate-limited
    const blocked = await request(app)
      .post('/auth/login')
      .send({ email: 'no-such-user@ratelimit.test', password: 'anything' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('also rate-limits POST /auth/register', async () => {
    // Re-use the same counter from above — already over limit for this IP
    const blocked = await request(app)
      .post('/auth/register')
      .send({ email: `extra-${Date.now()}@example.com`, password: 'password123' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
