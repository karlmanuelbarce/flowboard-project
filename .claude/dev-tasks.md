# FlowBoard — Development Tasks

> Granular checklist per day, per session. Check off each item as you complete it.
> Built from scratch — no starter repo. Every file listed here must be created by you.

---

## Pre-Day 1 — Project Scaffolding

> Complete before starting Day 1. This is the skeleton everything else runs on.

### Session A — Root Directory Structure
- [x] Create `api/src/routes/`, `api/src/middleware/`, `api/src/lib/`, `api/src/errors/`
- [x] Create `api/prisma/`, `api/tests/`
- [x] Create `worker/src/handlers/`
- [x] Create `nginx/`
- [x] Create `docker-compose.yml` (empty for now — filled in Session D)
- [x] Create `.env.example` (empty for now — filled in Session G)
- [x] Create `README.md`

### Session B — API Package Setup
- [x] `cd api && npm init -y`
- [x] Install runtime deps: `express zod @prisma/client ioredis jsonwebtoken bcrypt pino pino-http cors helmet`
- [x] Install dev deps: `typescript ts-node @types/node @types/express @types/bcrypt @types/jsonwebtoken @types/cors jest @types/jest supertest @types/supertest ts-jest prisma pino-pretty`
- [x] Create `api/tsconfig.json` — `"strict": true`, `"target": "ES2022"`, `"module": "commonjs"`, `"outDir": "dist"`, `"rootDir": "src"`, `"esModuleInterop": true`
- [x] Add scripts to `api/package.json`: `"dev": "ts-node src/index.ts"`, `"build": "tsc"`, `"test": "jest"`, `"test:coverage": "jest --coverage"`
- [x] Create `api/src/index.ts` — imports app, starts `app.listen(PORT)`
- [x] Create `api/jest.config.ts` — preset `ts-jest`, `testEnvironment: 'node'`, testMatch `tests/**/*.test.ts`

### Session C — Worker Package Setup
- [x] `cd worker && npm init -y`
- [x] Install runtime deps: `@prisma/client ioredis pino`
- [x] Install dev deps: `typescript ts-node @types/node prisma`
- [x] Create `worker/tsconfig.json` — same strict settings as API
- [x] Add scripts to `worker/package.json`: `"dev": "ts-node src/index.ts"`, `"build": "tsc"`
- [x] Create `worker/src/index.ts` as empty file (implemented on Day 8)

### Session D — docker-compose.yml
- [x] Define service `api` — build from `./api`, port `3000:3000`, env vars from `.env`, depends on `db` and `redis`
- [x] Define service `worker` — build from `./worker`, no ports, same env vars, depends on `db` and `redis`
- [x] Define service `db` — image `postgres:16-alpine`, port `5432:5432`, volume `pgdata:/var/lib/postgresql/data`, env `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- [x] Define service `redis` — image `redis:7-alpine`, port `6379:6379`, volume `redisdata:/data`
- [x] Define service `nginx` — image `nginx:alpine`, port `80:80`, volume `./nginx/nginx.conf:/etc/nginx/conf.d/default.conf`, depends on `api`
- [x] Define named volumes: `pgdata`, `redisdata`
- [x] Define network `flowboard-net`; attach all services to it

### Session E — Dockerfiles
- [x] Create `api/Dockerfile` — `FROM node:22-alpine`, `WORKDIR /app`, `COPY package*.json .`, `RUN npm ci`, `COPY . .`, `RUN npx prisma generate`, `CMD ["ts-node", "src/index.ts"]`
- [x] Create `worker/Dockerfile` — same pattern, `CMD ["ts-node", "src/index.ts"]`
- [x] Create `.dockerignore` in both `api/` and `worker/` — exclude `node_modules`, `dist`, `.env`

### Session F — Nginx Config
- [x] Create `nginx/nginx.conf`
- [x] `upstream api { server api:3000; }`
- [x] `server { listen 80; location / { proxy_pass http://api; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; } }`

### Session G — Environment File
- [x] Create `.env` (not committed — add to `.gitignore`) copied from `.env.example`
- [x] Populate `.env.example` with all required vars:
  ```
  DATABASE_URL=postgresql://postgres:password@db:5432/flowboard
  REDIS_HOST=redis
  REDIS_PORT=6379
  JWT_SECRET=change-me-in-production
  JWT_ACCESS_EXPIRES_IN=15m
  JWT_REFRESH_EXPIRES_IN=7d
  NODE_ENV=development
  PORT=3000
  LOG_LEVEL=info
  ALLOWED_ORIGINS=http://localhost:3000
  ```
- [x] Create `.gitignore` at root — include `.env`, `node_modules`, `dist`, `*.js.map`
- [x] Run `docker compose up -d` — confirm all 5 containers start (even if api/worker exit without app code)

---

## Week 1 — Foundation

---

### Day 1 — Docker Stack, AI Context, AppError

**Commit:** `day-01: environment setup, AppError, global error handler`

#### Session A — Docker Stack Verification
- [x] `docker compose up -d` — no fatal errors
- [x] `docker compose ps` — db and redis show as healthy or running
- [x] `docker compose logs db` — PostgreSQL ready to accept connections
- [x] `docker compose logs redis` — Redis server started
- [x] `docker compose logs nginx` — nginx started (may show upstream error — ok for now)

#### Session B — AI Context File Review
- [x] Open `ai-context.md` — read every section
- [x] Confirm error handling pattern documented (AppError, next(err), never res.json in catch)
- [x] Confirm TypeScript rules documented (strict, z.infer, no `as any`)
- [x] Confirm response format documented (`{ success, data }` / `{ success, message, code }`)
- [x] Confirm DLQ format section exists (needed for Day 14 milestone verification)

#### Session C — AppError Implementation
- [x] Create `api/src/errors/AppError.ts`
- [x] `export class AppError extends Error` with constructor `(message: string, public statusCode: number, public code: string = 'INTERNAL_ERROR')`
- [x] Set `this.name = 'AppError'` and call `Error.captureStackTrace(this, this.constructor)`
- [x] Export `export function isAppError(err: unknown): err is AppError` — checks `err instanceof AppError`
- [x] Export `globalErrorHandler` as 4-argument Express middleware `(err, req, res, next)`
- [x] Handle `AppError` → `res.status(err.statusCode).json({ success: false, message: err.message, code: err.code })`
- [x] Handle `ZodError` → `res.status(422).json({ success: false, message: 'Validation error', code: 'VALIDATION_ERROR', errors: err.errors })`
- [x] Handle unknown → `res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err as Error).message, code: 'INTERNAL_ERROR' })`
- [x] In production: never include `stack` in any response

#### Session D — app.ts Wiring
- [x] Create `api/src/app.ts` — `const app = express(); export default app;`
- [x] Add `app.use(express.json())` — body parser
- [x] Add a test route: `app.get('/test-error', () => { throw new AppError('test', 404, 'TEST') })`
- [x] Add `app.use(globalErrorHandler)` as the **last** `app.use` call
- [x] Update `api/src/index.ts` to import and start the app

#### Session E — Verify and Commit
- [x] `docker compose exec api npx tsc --noEmit` — zero type errors
- [x] `docker compose exec api curl localhost:3000/test-error` — confirm `{ success: false, code: 'TEST' }`
- [x] Remove the test route from `app.ts`
- [x] Push commit

---

### Day 2 — Task Routes (TypeScript + Zod)

**Commit:** `day-02: typed task routes with Zod validation`

#### Session A — Prisma Client Singleton
- [x] Create `api/src/lib/prisma.ts`
- [x] Use global singleton pattern to avoid multiple PrismaClient instances during hot reload:
  ```ts
  const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
  export const prisma = globalForPrisma.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
  ```

#### Session B — GET /tasks/:id
- [x] Create `api/src/routes/tasks.ts` — `const router = express.Router(); export default router;`
- [x] Define `const TaskIdParam = z.object({ id: z.string().uuid() })`
- [x] Implement `router.get('/:id', async (req: Request<z.infer<typeof TaskIdParam>>, res, next): Promise<void> => { ... })`
- [x] Parse params with `TaskIdParam.parse(req.params)` — ZodError propagates automatically to global handler
- [x] `prisma.task.findUnique({ where: { id } })` — throw `AppError 404 'TASK_NOT_FOUND'` if null
- [x] Return `res.json({ success: true, data: task })`
- [x] All errors go to `next(err)` — no `res.status()` inside catch

#### Session C — POST /tasks
- [x] Define `const CreateTaskSchema = z.object({ title: z.string().min(1).max(255), description: z.string().optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'), boardId: z.string().uuid() })`
- [x] Export `type CreateTaskInput = z.infer<typeof CreateTaskSchema>`
- [x] Implement `router.post('/', async (req: Request<{}, {}, CreateTaskInput>, res, next): Promise<void> => { ... })`
- [x] Parse body with `CreateTaskSchema.parse(req.body)`
- [x] `prisma.task.create({ data: { title, description, priority, boardId } })` — explicit fields, no spread
- [x] Return `res.status(201).json({ success: true, data: task })`

#### Session D — PATCH and DELETE
- [x] Define `const UpdateTaskSchema = z.object({ title: z.string().min(1).max(255).optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(), status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional() })`
- [x] PATCH handler: parse both `TaskIdParam` and `UpdateTaskSchema`; `prisma.task.update({ where: { id }, data: body })`; return updated task
- [x] Catch Prisma `P2025` error (record not found) → throw `AppError 404`
- [x] DELETE handler: parse `TaskIdParam`; `prisma.task.delete({ where: { id } })`; return `res.status(204).send()`
- [x] Catch Prisma `P2025` error → throw `AppError 404`

#### Session E — Mount and Type Check
- [x] Mount tasks router in `app.ts`: `app.use('/tasks', tasksRouter)`
- [x] `docker compose exec api npx tsc --noEmit` — fix every error
- [x] No `any` types; all handlers return `Promise<void>`; all params/bodies use `z.infer`
- [x] Push commit

---

### Day 3 — Prisma Schema, Migration, Seed

**Commit:** `day-03: prisma schema, migration, seed data`

#### Session A — schema.prisma
- [x] Create `api/prisma/schema.prisma`
- [x] Add generator block: `provider = "prisma-client-js"`
- [x] Add datasource block: `provider = "postgresql"`, `url = env("DATABASE_URL")`
- [x] Model `User`: id (uuid), email (unique), password, createdAt (now), boards Board[], auditLogs AuditLog[]
- [x] Model `Board`: id (uuid), name, ownerId, owner (relation to User), tasks Task[], createdAt (now)
- [x] Model `Task`: id (uuid), title, description?, status (default TODO), priority (default MEDIUM), boardId, board (relation), createdAt (now), updatedAt (@updatedAt)
- [x] Model `AuditLog`: id (uuid), userId, user (relation), action, entity, entityId, createdAt (now)
- [x] Enum `TaskStatus { TODO IN_PROGRESS REVIEW DONE }`
- [x] Enum `Priority { LOW MEDIUM HIGH }`

#### Session B — Migration
- [x] `docker compose exec api npx prisma migrate dev --name init`
- [x] Confirm: no errors in output; `api/prisma/migrations/` folder created
- [x] If migration fails: check `DATABASE_URL` in `.env` and that `db` container is healthy

#### Session C — Generate Client
- [x] `docker compose exec api npx prisma generate`
- [x] Confirm: `@prisma/client` types include `User`, `Board`, `Task`, `AuditLog`
- [x] Import `prisma` from `../lib/prisma` in `tasks.ts` — no TypeScript errors

#### Session D — Seed File
- [x] Create `api/prisma/seed.ts`
- [x] Import `PrismaClient` from `@prisma/client` and `bcrypt` from `bcrypt`
- [x] Hash password: `await bcrypt.hash('Dev1234!', 12)`
- [x] `prisma.user.upsert({ where: { email: 'dev@flowboard.test' }, update: {}, create: { email, password: hashedPw } })`
- [x] Create 2 boards owned by that user — upsert or clean up on repeated runs
- [x] Create 3 tasks on the first board
- [x] Add to `api/package.json`: `"prisma": { "seed": "ts-node prisma/seed.ts" }`

#### Session E — Verify
- [x] `docker compose exec api npx ts-node prisma/seed.ts` — no errors
- [x] `docker compose exec api npx prisma studio` — opens on port 5555
- [x] Confirm 1 user, 2 boards, 3 tasks in Studio
- [x] Push commit

---

### Day 4 — Boards CRUD + Full Route Wiring

**Commit:** `day-04: boards CRUD, full route layer`

#### Session A — GET /boards and POST /boards
- [x] Create `api/src/routes/boards.ts`
- [x] Define `const CreateBoardSchema = z.object({ name: z.string().min(1).max(255) })`
- [x] `GET /boards` — `prisma.board.findMany({ where: { ownerId: 'stub' } })` (owner wired Day 5)
- [x] `POST /boards` — parse body, `prisma.board.create({ data: { name, ownerId: 'stub' } })`, return 201

#### Session B — GET /boards/:id and DELETE /boards/:id
- [x] Define `const BoardIdParam = z.object({ id: z.string().uuid() })`
- [x] `GET /boards/:id` — findUnique, throw AppError 404 if null
- [x] `DELETE /boards/:id` — delete board, catch P2025, return 204

#### Session C — Mount All Routers in app.ts
- [x] Mount boards router: `app.use('/boards', boardsRouter)`
- [x] Mount placeholder auth router: `app.use('/auth', authRouter)` (empty router OK for now)
- [x] Mount placeholder health route: `app.get('/health', (_, res) => res.json({ status: 'ok' }))` (full impl Day 14)
- [x] Verify middleware order: `express.json()` → routes → `globalErrorHandler`

#### Session D — Manual Testing (Postman or Bruno)
- [x] `POST /tasks` — happy path → 201
- [x] `GET /tasks/:id` — happy path → 200
- [x] `GET /tasks/:id` with non-UUID param → 422
- [x] `GET /tasks/:id` with valid UUID, no record → 404
- [x] `POST /boards` — happy path → 201
- [x] `GET /boards/:id` — happy path → 200
- [x] `DELETE /boards/:id` — happy path → 204

#### Session E — Error Handler Smoke Test
- [x] Temporarily add route: `app.get('/err-test', () => { throw new AppError('deliberate', 404, 'TEST') })`
- [x] Call it — confirm `{ success: false, message: 'deliberate', code: 'TEST' }`
- [x] Temporarily add route: `app.get('/err-unknown', () => { throw new Error('unexpected') })`
- [x] Call it with `NODE_ENV=production` — confirm no stack trace in response body
- [x] Remove both test routes; push commit

---

### Day 5 — JWT Auth Foundation

**Commit:** `week-01 complete: API, auth foundation, Prisma schema`

#### Session A — Auth Route Scaffold + Schemas
- [x] Create `api/src/routes/auth.ts`
- [x] Define `RegisterSchema = z.object({ email: z.string().email(), password: z.string().min(8) })`
- [x] Define `LoginSchema = z.object({ email: z.string().email(), password: z.string() })`
- [x] Create `api/src/types/express.d.ts` — augment `express.Request` to include `user?: { id: string; email: string }`

#### Session B — POST /auth/register
- [x] Check for existing user by email — throw `AppError(409, 'EMAIL_IN_USE')`
- [x] `const hashedPw = await bcrypt.hash(password, 12)`
- [x] `prisma.user.create({ data: { email, password: hashedPw } })`
- [x] Generate `accessToken`: `jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '15m' })`
- [x] Generate `refreshToken`: `jwt.sign({ userId: user.id, email, tokenId: randomUUID() }, JWT_SECRET, { expiresIn: '7d' })`
- [x] Return `res.status(201).json({ success: true, data: { accessToken, refreshToken } })`

#### Session C — POST /auth/login
- [x] Find user by email — if not found, throw `AppError(401, 'INVALID_CREDENTIALS')` (same message as wrong password — don't leak which)
- [x] `const match = await bcrypt.compare(password, user.password)` — if false, throw `AppError(401, 'INVALID_CREDENTIALS')`
- [x] Generate and return token pair (same shape as register)

#### Session D — authenticate Middleware
- [x] Create `api/src/middleware/authenticate.ts`
- [x] Extract `Authorization` header — throw `AppError(401, 'UNAUTHORIZED')` if missing or not `Bearer`
- [x] `const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }` — throw `AppError(401)` on failure
- [x] `req.user = { id: payload.userId, email: payload.email }`; call `next()`
- [x] Apply `authenticate` middleware to boards and tasks routers in `app.ts`
- [x] Test: `GET /tasks` without token → 401; with valid token → continues

#### Session E — AuditLog Writes + Week 1 Checklist
- [x] In `POST /tasks` handler: after create, add `prisma.auditLog.create({ data: { userId: req.user!.id, action: 'CREATED', entity: 'Task', entityId: task.id } })`
- [x] Same in `PATCH /tasks/:id` (action: 'UPDATED') and `DELETE /tasks/:id` (action: 'DELETED')
- [x] Wire `req.user.id` into boards routes for `ownerId` (replacing 'stub')
- [x] Week 1 checklist: docker up ✓, tsc passes ✓, task routes work ✓, board routes work ✓, register/login return tokens ✓, 401 on unauth ✓, AuditLog records created ✓
- [x] Push commit

---

## Week 2 — Core Features

---

### Day 6 — Redis Client & Rate Limiter

**Commit:** `day-06: Redis client, rate limiter middleware`

#### Session A — Redis Client
- [x] Create `api/src/lib/redis.ts`
- [x] `import Redis from 'ioredis'; const redis = new Redis({ host: process.env.REDIS_HOST ?? 'redis', port: Number(process.env.REDIS_PORT) ?? 6379 });`
- [x] `redis.on('error', (err) => console.error('Redis error:', err))` — does NOT crash the process
- [x] `export default redis;`
- [x] Verify: `docker compose exec redis redis-cli PING` → `PONG`

#### Session B — Rate Limiter Middleware
- [x] Create `api/src/middleware/rateLimiter.ts`
- [x] `const WINDOW_SECONDS = 15 * 60; const MAX_REQUESTS = 100;`
- [x] Key: `` `rate:${req.ip ?? 'unknown'}` ``
- [x] `const count = await redis.incr(key); if (count === 1) await redis.expire(key, WINDOW_SECONDS);`
- [x] `if (count > MAX_REQUESTS) throw new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')`

#### Session C — Apply to Auth Routes Only
- [x] Import `rateLimiter` in `auth.ts` (or in `app.ts` per-route)
- [x] Apply to `POST /auth/login` and `POST /auth/register` — NOT to refresh, logout, or any other route
- [x] Confirm `GET /health` is NOT rate limited

#### Session D — Fail-Open Implementation
- [x] Wrap both Redis calls (`incr` and `expire`) in a single try/catch
- [x] On error: `console.warn('Rate limiter Redis error, failing open:', err); next(); return;`
- [x] Test: `docker compose stop redis` → make a login request → confirm 200/401 (not 500)
- [x] `docker compose start redis`

#### Session E — Rate Limit Test + Redis Verification
- [x] Loop 101 requests to `POST /auth/login`: `for i in $(seq 101); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost/auth/login -H "Content-Type: application/json" -d '{}'; done`
- [x] Confirm requests 1–100 return 400/401 (not 429), request 101 returns 429
- [x] `docker compose exec redis redis-cli KEYS "rate:*"` — confirm keys exist
- [x] `docker compose exec api npx tsc --noEmit` — zero errors
- [x] Push commit

---

### Day 7 — Refresh Token Rotation & Logout

**Commit:** `day-07: refresh token rotation, logout endpoint`

#### Session A — Store Refresh Tokens in Redis
- [ ] In `POST /auth/register`: after generating `refreshToken`, extract `tokenId` from the JWT payload
- [ ] `await redis.set(\`refresh:${user.id}:${tokenId}\`, '1', 'EX', 7 * 24 * 60 * 60)`
- [ ] Same in `POST /auth/login`
- [ ] Verify: login, then `docker compose exec redis redis-cli KEYS "refresh:*"` — key exists

#### Session B — POST /auth/refresh
- [ ] Add to `auth.ts`: `const RefreshSchema = z.object({ refreshToken: z.string() })`
- [ ] Parse body; `jwt.verify(refreshToken, JWT_SECRET)` — throw `AppError(401, 'INVALID_REFRESH_TOKEN')` on failure
- [ ] `const exists = await redis.get(\`refresh:${payload.userId}:${payload.tokenId}\`)` — throw 401 if null
- [ ] `await redis.del(\`refresh:${payload.userId}:${payload.tokenId}\`)` — delete BEFORE issuing new token
- [ ] Generate new `accessToken` and `refreshToken` (new `tokenId`)
- [ ] Store new refresh token in Redis with 7-day TTL
- [ ] Return `{ success: true, data: { accessToken, refreshToken } }`

#### Session C — POST /auth/logout
- [ ] Parse request body for `refreshToken`; verify JWT to extract payload
- [ ] `await redis.del(\`refresh:${payload.userId}:${payload.tokenId}\`)` — silent if key doesn't exist
- [ ] Return `res.status(204).send()`

#### Session D — Replay Attack Test
- [ ] Login → get `refreshToken`
- [ ] Call `POST /auth/refresh` with token → 200, get new token pair
- [ ] Call `POST /auth/refresh` with the **same original token again** → must return 401
- [ ] Confirm the new refresh token from step 2 still works

#### Session E — TTL Verification
- [ ] `docker compose exec redis redis-cli TTL "refresh:<userId>:<tokenId>"` — value should be ~604800
- [ ] `docker compose exec api npx tsc --noEmit` — zero errors
- [ ] Push commit

---

### Day 8 — Redis Streams & Background Worker

**Commit:** `day-08: Redis Stream events, worker consumer, AuditLog integration`

#### Session A — publishTaskEvent
- [ ] Create `api/src/lib/events.ts`
- [ ] Define `interface TaskEvent { taskId: string; action: 'CREATED' | 'UPDATED' | 'DELETED'; userId: string; payload: Record<string, unknown>; }`
- [ ] Implement `publishTaskEvent` — `redis.xadd('tasks:events', '*', 'action', event.action, 'taskId', event.taskId, 'userId', event.userId, 'payload', JSON.stringify(event.payload), 'ts', Date.now().toString())`
- [ ] Wrap in try/catch — log error but do NOT rethrow (publish failure must not fail the HTTP response)

#### Session B — Wire publishTaskEvent to Task Mutations
- [ ] In `POST /tasks`: call `publishTaskEvent({ taskId: task.id, action: 'CREATED', userId: req.user!.id, payload: { title: task.title } })` after create
- [ ] In `PATCH /tasks/:id`: action `'UPDATED'`, payload includes changed fields
- [ ] In `DELETE /tasks/:id`: action `'DELETED'`, payload includes `{ taskId: id }`
- [ ] Verify: create a task, then `docker compose exec redis redis-cli XLEN tasks:events` — count increases

#### Session C — Worker Consumer Loop
- [ ] Update `worker/src/index.ts`
- [ ] Import `Redis` from `ioredis` and `PrismaClient` from `@prisma/client`
- [ ] On startup: `redis.xgroup('CREATE', 'tasks:events', 'audit-group', '$', 'MKSTREAM')` — catch error with code `'BUSYGROUP'` (already exists — ok)
- [ ] Start async loop: `while (true) { const results = await redis.xreadgroup('GROUP', 'audit-group', 'worker-1', 'COUNT', '10', 'BLOCK', 5000, 'STREAMS', 'tasks:events', '>'); if (!results) continue; ... }`

#### Session D — Event Handlers + XACK
- [ ] Create `worker/src/handlers/taskCreated.ts`, `taskUpdated.ts`, `taskDeleted.ts`
- [ ] Each handler: `prisma.auditLog.create({ data: { userId, action, entity: 'Task', entityId: taskId } })`
- [ ] After successful `prisma.auditLog.create`: `await redis.xack('tasks:events', 'audit-group', messageId)`
- [ ] In the worker loop: dispatch to correct handler based on `action` field parsed from message fields
- [ ] Verify: `docker compose exec redis redis-cli XINFO GROUPS tasks:events` — shows `audit-group` with pending count 0 after processing

#### Session E — Dead-Letter Queue
- [ ] Track retry count in a `Map<string, number>` keyed by message ID
- [ ] On handler error: increment retry count; if count < 3, log and continue (message will be redelivered)
- [ ] If count >= 3: `await redis.lpush('tasks:events:dlq', JSON.stringify({ streamId: messageId, action, taskId, userId, payload, ts, failedAt: new Date().toISOString(), retries: 3, lastError: err.message }))`; then `await redis.xack(...)` to remove from pending
- [ ] Test: throw deliberately in a handler; process 3 times; check `redis-cli LRANGE tasks:events:dlq 0 -1` — entry appears
- [ ] Push commit

---

### Day 9 — Integration Test Suite

**Commit:** `day-09: integration test suite`

#### Session A — Test Infrastructure
- [ ] Create `docker-compose.test.yml`:
  ```yaml
  services:
    api:
      environment:
        DATABASE_URL: postgresql://postgres:password@db:5432/flowboard_test
  ```
- [ ] Confirm `jest.config.ts` exists with `preset: 'ts-jest'`, `testEnvironment: 'node'`
- [ ] Add `setupFilesAfterFramework` to run `prisma.$connect()` before suite if needed
- [ ] `docker compose -f docker-compose.test.yml exec api npx jest` — confirms runner works (0 tests ok)

#### Session B — auth.test.ts
- [ ] `beforeAll`: connect prisma; `afterAll`: `prisma.user.deleteMany(); prisma.$disconnect()`
- [ ] `POST /auth/register` — 201, body has `accessToken` and `refreshToken`
- [ ] `POST /auth/register` duplicate email — 409
- [ ] `POST /auth/register` invalid email — 422
- [ ] `POST /auth/login` — 200, tokens returned
- [ ] `POST /auth/login` wrong password — 401
- [ ] `POST /auth/login` unknown email — 401 (same message as wrong password)
- [ ] `POST /auth/refresh` — 200, new token pair
- [ ] `POST /auth/refresh` replay (same token twice) — 401 on second use
- [ ] `POST /auth/logout` — 204

#### Session C — tasks.test.ts
- [ ] `beforeAll`: register user, get `authToken`; create a board, get `boardId`
- [ ] `afterAll`: cleanup test data; `prisma.$disconnect()`
- [ ] `POST /tasks` — 201, correct shape
- [ ] `POST /tasks` missing `title` — 422
- [ ] `POST /tasks` no auth header — 401
- [ ] `GET /tasks/:id` — 200
- [ ] `GET /tasks/:id` invalid UUID — 422
- [ ] `GET /tasks/:id` valid UUID no record — 404
- [ ] `PATCH /tasks/:id` — 200, updated fields reflected
- [ ] `PATCH /tasks/:id` other user's task — register second user, get their token, attempt PATCH → 403
- [ ] `DELETE /tasks/:id` — 204
- [ ] `DELETE /tasks/:id` non-existent — 404

#### Session D — boards.test.ts
- [ ] `POST /boards` — 201
- [ ] `POST /boards` no auth — 401
- [ ] `GET /boards` — 200, array scoped to req.user
- [ ] `GET /boards/:id` — 200
- [ ] `GET /boards/:id` other user's board — 403
- [ ] `DELETE /boards/:id` — 204
- [ ] `DELETE /boards/:id` other user's board — 403

#### Session E — Rate Limiter Test + Fix Failures
- [ ] Write rate limiter test — loop 101 requests, assert 101st is 429
- [ ] `docker compose -f docker-compose.test.yml exec api npx jest` — run full suite
- [ ] Fix every failing test
- [ ] Push commit

---

### Day 10 — Coverage & Mid-Point Review

**Commit:** `week-02 complete: Redis, worker, auth hardening, test suite`

#### Session A — Coverage Run
- [ ] `docker compose exec api npx jest --coverage`
- [ ] Open HTML report in `coverage/lcov-report/index.html`
- [ ] List the top 5 uncovered lines or branches

#### Session B — Fill Coverage Gaps
- [ ] Add tests for each uncovered branch (error paths, edge cases, null checks)
- [ ] Re-run coverage — confirm lines ≥ 80% AND branches ≥ 80%

#### Session C — TypeScript Audit
- [ ] `docker compose exec api npx tsc --noEmit`
- [ ] Fix all type errors introduced during Days 6–9
- [ ] Zero errors before proceeding

#### Session D — Git Log Audit
- [ ] `git log --oneline` — confirm 9 commits
- [ ] Verify each commit message matches the exact prefix from `dev-plan.md`
- [ ] If any prefix is wrong: `git rebase -i HEAD~N` to fix (only if not yet pushed to remote)

#### Session E — Clean Restart Smoke Test
- [ ] `docker compose down -v` — removes all volumes (clean DB)
- [ ] `docker compose up -d`
- [ ] `docker compose exec api npx prisma migrate deploy` — apply migrations to fresh DB
- [ ] Full smoke test: Register → Login → Create Board → Create Task → Patch Task → Refresh Token → Logout
- [ ] Check `docker compose logs worker` — AuditLog entries logged for each task mutation
- [ ] Push commit

---

## Week 3 — Security & Ship

---

### Day 11 — Helmet, CORS, Ownership Checks

**Commit:** `day-11: Helmet, CORS, ownership checks`

#### Session A — Helmet
- [ ] `npm install helmet` (inside api container or in package.json then rebuild)
- [ ] Add `import helmet from 'helmet'; app.use(helmet());` as the **first** middleware in `app.ts`
- [ ] Make any request in Postman — check response headers:
  - [ ] `X-Content-Type-Options: nosniff` present
  - [ ] `X-Frame-Options` present
  - [ ] `X-DNS-Prefetch-Control` present

#### Session B — CORS
- [ ] `npm install cors @types/cors`
- [ ] Add `app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'], credentials: true }))` after helmet
- [ ] Add `ALLOWED_ORIGINS=http://localhost:3000` to `.env.example`
- [ ] Test with an unexpected origin header — confirm CORS rejection in response

#### Session C — Body Size Limit + Trust Proxy
- [ ] Replace `app.use(express.json())` with `app.use(express.json({ limit: '10kb' }))`
- [ ] Add `app.set('trust proxy', 1)` before routes
- [ ] Test: send a JSON payload > 10kb — confirm 413 response

#### Session D — Ownership Checks (Full Enforcement)
- [ ] In `GET /tasks/:id`: fetch task; if `task.board.ownerId !== req.user!.id` (or add `userId` to Task model) → throw `AppError(403, 'FORBIDDEN')`
- [ ] In `PATCH /tasks/:id`: ownership check before update
- [ ] In `DELETE /tasks/:id`: ownership check before delete
- [ ] In `GET /boards/:id`: ownership check
- [ ] In `DELETE /boards/:id`: ownership check
- [ ] Replace all 'stub' ownerId values with `req.user!.id`

#### Session E — Ownership + Security Tests
- [ ] Register User A; register User B
- [ ] User A creates a task
- [ ] User B uses PATCH on User A's task with valid token → 403
- [ ] User B uses DELETE on User A's task → 403
- [ ] User B uses GET on User A's board → 403
- [ ] Push commit

---

### Day 12 — Brute-Force Protection & Mass Assignment Prevention

**Commit:** `day-12: brute-force protection, mass assignment prevention`

#### Session A — Tighter Login Rate Limiter
- [ ] Create `api/src/middleware/loginRateLimiter.ts` — same INCR/EXPIRE pattern but `MAX_REQUESTS = 10` per 15 min
- [ ] Apply `loginRateLimiter` to `POST /auth/login` instead of (or in addition to) general `rateLimiter`
- [ ] Test: 10 login attempts → 10th or 11th returns 429

#### Session B — Mass Assignment Schema Audit
- [ ] Review `CreateTaskSchema` — confirm only `title`, `description`, `priority`, `boardId` are accepted
- [ ] Review `UpdateTaskSchema` — confirm no `id`, `boardId`, `createdAt`, `updatedAt` fields
- [ ] Review `CreateBoardSchema` — confirm only `name` is accepted
- [ ] Review `RegisterSchema` and `LoginSchema` — confirm no extra fields
- [ ] Confirm no Prisma call uses `...req.body` or `...parsedBody` spread — all fields are named explicitly

#### Session C — Mass Assignment Test
- [ ] `POST /tasks` with body `{ "title": "x", "priority": "HIGH", "boardId": "<uuid>", "isAdmin": true, "id": "attacker-id" }`
- [ ] Confirm: created task does NOT have `isAdmin` field; task `id` is a real UUID, not `"attacker-id"`
- [ ] `PATCH /tasks/:id` with body `{ "boardId": "other-board" }` — confirm boardId not changed (not in UpdateTaskSchema)

#### Session D — Production Error Responses
- [ ] In `globalErrorHandler`: add check `const isProd = process.env.NODE_ENV === 'production'`
- [ ] For `AppError`: always use `err.message` and `err.code`; never include `stack`
- [ ] For unknown errors: use `isProd ? 'Internal server error' : (err as Error).message`; never include `stack` in production
- [ ] Test: set `NODE_ENV=production` in `.env`, restart api container, trigger a TypeError, confirm clean error response

#### Session E — Final Verification
- [ ] `docker compose exec api npx tsc --noEmit` — zero errors
- [ ] Run full test suite — all tests pass
- [ ] Push commit

---

### Day 13 — Pino Structured Logging

**Commit:** `day-13: Pino structured logging`

#### Session A — Logger Setup
- [ ] Ensure `pino`, `pino-http`, `pino-pretty` are in `api/package.json` (installed during Pre-Day 1)
- [ ] Create `api/src/lib/logger.ts`:
  ```ts
  import pino from 'pino';
  const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization', 'body.password', 'body.token'],
    transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  });
  export default logger;
  ```

#### Session B — Replace console.log in API
- [ ] Search `api/src/` for all `console.log`, `console.error`, `console.warn`
- [ ] Replace each with the correct pino method: `logger.info`, `logger.error`, `logger.warn`
- [ ] Use structured objects: `logger.error({ err, userId: req.user?.id }, 'Task not found')` — NOT string concat

#### Session C — pino-http Request Logging
- [ ] Add to `app.ts`: `import pinoHttp from 'pino-http'; app.use(pinoHttp({ logger }));`
- [ ] Place after `app.use(helmet())` but before routes
- [ ] Make a request — check logs include `method`, `url`, `statusCode`, `responseTime`

#### Session D — Worker Logging
- [ ] Import pino in `worker/src/index.ts` — create logger instance with same config
- [ ] Replace all `console.log` / `console.error` in worker and handlers
- [ ] Log `logger.info({ action, taskId }, 'AuditLog written')` on each successful event
- [ ] Log `logger.warn({ streamId, retries }, 'Moving to DLQ')` before each DLQ push

#### Session E — Redaction Verification
- [ ] Make `POST /auth/login` with `{ "email": "x@x.com", "password": "secret123" }`
- [ ] `docker compose logs api` — confirm `password` field shows as `[Redacted]`
- [ ] Make `GET /tasks` with `Authorization: Bearer <token>` header
- [ ] `docker compose logs api` — confirm `authorization` shows as `[Redacted]`
- [ ] Push commit

---

### Day 14 — Health Checks & DLQ Documentation

**Commit:** `day-14: health checks, DLQ documentation`

#### Session A — GET /health
- [ ] Create `api/src/routes/health.ts`
- [ ] `router.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }))`
- [ ] `router.get('/ready', async (req, res, next): Promise<void> => { ... })` — implemented Session B
- [ ] Export router

#### Session B — GET /ready
- [ ] Import `prisma` and `redis` in `health.ts`
- [ ] Try `await prisma.$queryRaw\`SELECT 1\`` and `await redis.ping()` inside a single try/catch
- [ ] On success: `res.json({ status: 'ready', db: 'ok', redis: 'ok' })`
- [ ] On failure: `next(new AppError('Service not ready', 503, 'NOT_READY'))`

#### Session C — Mount Without Auth
- [ ] In `app.ts`: mount health router BEFORE applying `authenticate` middleware
- [ ] `app.use(healthRouter)` — no `/health` prefix needed since routes are already `/health` and `/ready`
- [ ] Confirm health routes do NOT require a token: `curl http://localhost/health` → 200

#### Session D — Dependency Down Tests
- [ ] `docker compose stop redis` → `GET /ready` → 503; check response body has `code: 'NOT_READY'`
- [ ] `docker compose start redis` → `GET /ready` → 200
- [ ] `docker compose stop db` → `GET /ready` → 503
- [ ] `docker compose start db`
- [ ] Test via Nginx on port 80: `curl http://localhost/health` → 200 (not 502)

#### Session E — DLQ Documentation Audit
- [ ] Open `ai-context.md` — find the DLQ section under "Redis Key Conventions"
- [ ] Verify key name: `tasks:events:dlq` — matches what your worker writes
- [ ] Verify entry JSON fields: `streamId`, `action`, `taskId`, `userId`, `payload`, `ts`, `failedAt`, `retries`, `lastError`
- [ ] If your worker writes any different fields: update `ai-context.md` to match
- [ ] Push commit

---

### Day 15 — Security Gate Self-Review

**Commit:** `week-03 complete: OWASP hardening, production patterns, Security Gate ready`

#### Session A — Checklist: Repository, Auth, Validation (Brief §5.1–5.3)
- [ ] `git log --oneline` shows all 15 commits with correct prefixes
- [ ] `docker compose up -d` from clean state — all 5 services healthy
- [ ] `docker compose exec api npx tsc --noEmit` — zero errors
- [ ] No hardcoded secrets anywhere in source; `.env.example` is complete
- [ ] `POST /auth/register` → bcrypt hash stored (confirm via Prisma Studio — password column is a long hash)
- [ ] `POST /auth/login` → accessToken 15min TTL, refreshToken 7d TTL
- [ ] `POST /auth/refresh` → rotation confirmed, replay → 401
- [ ] `POST /auth/logout` → 204, key deleted from Redis
- [ ] Every `/boards` and `/tasks` route → 401 without token
- [ ] Cross-user access → 403
- [ ] Invalid body → 422 with descriptive message
- [ ] Extra fields in body are stripped (not in response)
- [ ] UUID path params validated — non-UUID → 422

#### Session B — Checklist: Security, Redis, Worker, Tests (Brief §5.4–5.7)
- [ ] Helmet headers visible in Postman response
- [ ] CORS rejects unexpected origins
- [ ] 15kb payload → 413
- [ ] 429 after login rate limit exceeded
- [ ] `NODE_ENV=production` → no stack traces in errors
- [ ] `redis-cli KEYS "rate:*"` — shows rate keys after auth attempts
- [ ] `redis-cli TTL "refresh:*"` — shows ~604800 for a fresh token
- [ ] `redis-cli XLEN tasks:events` — increases after task mutations
- [ ] `redis-cli XINFO GROUPS tasks:events` — shows `audit-group`
- [ ] AuditLog table shows rows for every task create/update/delete (check Prisma Studio)
- [ ] `redis-cli XPENDING tasks:events audit-group - + 10` — shows 0 pending after worker processes
- [ ] DLQ populated after 3 failures (manually test)
- [ ] `docker compose -f docker-compose.test.yml exec api npx jest --coverage` → ≥ 80% lines and branches
- [ ] All auth test scenarios present (register, duplicate email, login, wrong pw, refresh, replay, logout)
- [ ] Rate limiter test present — 429 confirmed

#### Session C — Checklist: Observability (Brief §5.8)
- [ ] `GET /health` → 200 with `uptime` field
- [ ] `GET /ready` → 200 normally
- [ ] `GET /ready` with Redis stopped → 503
- [ ] `GET /ready` with DB stopped → 503
- [ ] `docker compose logs api` after a request — shows `method`, `url`, `statusCode`, `responseTime`
- [ ] Login request logged without `password` value visible
- [ ] Authenticated request logged without `authorization` value visible

#### Session D — Clean Start Final Validation
- [ ] `docker compose down -v`
- [ ] `docker compose up -d`
- [ ] `docker compose exec api npx prisma migrate deploy`
- [ ] `docker compose exec api npx tsc --noEmit` → 0 errors
- [ ] `docker compose -f docker-compose.test.yml exec api npx jest --coverage` → ≥ 80%

#### Session E — Verbal Walkthrough + Notify Trainer
- [ ] Close your editor and terminal
- [ ] Answer aloud without looking:

  > *"A PATCH /tasks/:id request comes in. Nginx receives it on port 80 and proxies it to api:3000. The authenticate middleware extracts the Bearer token and calls jwt.verify — no DB or Redis call needed. req.user is attached. The route handler parses req.params with TaskIdParam (Zod, UUID) and req.body with UpdateTaskSchema. Prisma updates the task in PostgreSQL. publishTaskEvent writes a TASK_UPDATED event to the tasks:events Redis Stream with XADD. The API returns { success: true, data: updatedTask }. Meanwhile, the worker's XREADGROUP loop picks up the event, the taskUpdated handler writes an AuditLog row to PostgreSQL, and XACK is called to remove the message from pending."*

- [ ] If you stumble on any step: open the code, re-read it, close it, try again
- [ ] When you can say it cleanly: push final commit and notify your trainer
