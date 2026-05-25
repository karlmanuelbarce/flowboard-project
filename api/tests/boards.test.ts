import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/app';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const OWNER_EMAIL = `boards-owner-${Date.now()}@example.com`;
const OTHER_EMAIL = `boards-other-${Date.now()}@example.com`;
const PASSWORD = 'password123';

let ownerToken: string;
let otherToken: string;
let boardId: string;

beforeAll(async () => {
  const ownerReg = await request(app)
    .post('/auth/register')
    .send({ email: OWNER_EMAIL, password: PASSWORD });
  ownerToken = ownerReg.body.data.accessToken;

  const otherReg = await request(app)
    .post('/auth/register')
    .send({ email: OTHER_EMAIL, password: PASSWORD });
  otherToken = otherReg.body.data.accessToken;
});

afterAll(async () => {
  await prisma.task.deleteMany({ where: { board: { owner: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } } } });
  await prisma.board.deleteMany({ where: { owner: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } } });
  await prisma.auditLog.deleteMany({ where: { user: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } });
  await prisma.$disconnect();
});

describe('POST /boards', () => {
  it('creates a board and returns 201', async () => {
    const res = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Board' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Owner Board');
    boardId = res.body.data.id;
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/boards')
      .send({ name: 'No Auth Board' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for missing name', async () => {
    const res = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /boards', () => {
  it('returns boards scoped to the authenticated user', async () => {
    const res = await request(app)
      .get('/boards')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const ids = res.body.data.map((b: { id: string }) => b.id);
    expect(ids).toContain(boardId);
  });

  it('does not return boards owned by other users', async () => {
    const res = await request(app)
      .get('/boards')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((b: { id: string }) => b.id);
    expect(ids).not.toContain(boardId);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/boards');
    expect(res.status).toBe(401);
  });
});

describe('GET /boards/:id', () => {
  it('returns the board by ID', async () => {
    const res = await request(app)
      .get(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(boardId);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/boards/${boardId}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent board', async () => {
    const res = await request(app)
      .get('/boards/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOARD_NOT_FOUND');
  });

  it('returns 422 for invalid UUID param', async () => {
    const res = await request(app)
      .get('/boards/not-a-uuid')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(422);
  });

  // Ownership enforcement added in Day 11
  test.todo('returns 403 when another user accesses a board they do not own');
});

describe('DELETE /boards/:id', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).delete(`/boards/${boardId}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent board', async () => {
    const res = await request(app)
      .delete('/boards/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOARD_NOT_FOUND');
  });

  // Ownership enforcement added in Day 11
  test.todo('returns 403 when another user tries to delete the board');

  it('deletes the board and returns 204', async () => {
    const res = await request(app)
      .delete(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 after deletion', async () => {
    const res = await request(app)
      .get(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });
});
