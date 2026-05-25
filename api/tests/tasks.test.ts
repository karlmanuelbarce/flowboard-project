import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/app';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const USER_EMAIL = `tasks-test-${Date.now()}@example.com`;
const USER_PASSWORD = 'password123';

let accessToken: string;
let boardId: string;
let taskId: string;

beforeAll(async () => {
  const reg = await request(app)
    .post('/auth/register')
    .send({ email: USER_EMAIL, password: USER_PASSWORD });
  accessToken = reg.body.data.accessToken;

  const board = await request(app)
    .post('/boards')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Test Board' });
  boardId = board.body.data.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { user: { email: USER_EMAIL } } });
  await prisma.task.deleteMany({ where: { board: { owner: { email: USER_EMAIL } } } });
  await prisma.board.deleteMany({ where: { owner: { email: USER_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
  await prisma.$disconnect();
});

describe('POST /tasks', () => {
  it('creates a task and returns 201', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'My Task', boardId, priority: 'HIGH' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('My Task');
    expect(res.body.data.priority).toBe('HIGH');
    expect(res.body.data.status).toBe('TODO');
    taskId = res.body.data.id;
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'No Auth', boardId });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for missing title', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ boardId });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid boardId (not a UUID)', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Bad Board', boardId: 'not-a-uuid' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /tasks/:id', () => {
  it('returns the task', async () => {
    const res = await request(app)
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(taskId);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/tasks/${taskId}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .get('/tasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TASK_NOT_FOUND');
  });

  it('returns 422 for invalid UUID param', async () => {
    const res = await request(app)
      .get('/tasks/not-a-uuid')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
  });
});

describe('PATCH /tasks/:id', () => {
  it('updates task fields and returns the updated task', async () => {
    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'IN_PROGRESS', priority: 'LOW' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.priority).toBe('LOW');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .send({ status: 'DONE' });

    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .patch('/tasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'DONE' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TASK_NOT_FOUND');
  });

  it('returns 422 for invalid status value', async () => {
    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'INVALID_STATUS' });

    expect(res.status).toBe(422);
  });

  // Ownership enforcement is added in Day 11 (Helmet, CORS, ownership checks)
  test.todo('returns 403 when a different user tries to update the task');
});

describe('DELETE /tasks/:id', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).delete(`/tasks/${taskId}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .delete('/tasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TASK_NOT_FOUND');
  });

  // Ownership enforcement is added in Day 11
  test.todo('returns 403 when a different user tries to delete the task');

  it('deletes the task and returns 204', async () => {
    const res = await request(app)
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 after deletion', async () => {
    const res = await request(app)
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });
});
