# FlowBoard — Development Plan

> 15-day build plan. Built from scratch — no forked repo, no starter code.
> Each day ends with a required commit. Do not advance until that commit is pushed.
> Follow the Explore → Plan → Act → Verify workflow for every non-trivial task.

---

## Pre-Day 1 — Project Scaffolding (Do Before Day 1 Commit)
**[Pre-Day 1 — COMPLETE]**

Before writing any application code, the project skeleton must exist.

**Sessions:**
- Session A: Create root directory structure — `api/`, `worker/`, `docker-compose.yml`, `.env.example`, `README.md`
- Session B: Initialize `api/` as a Node.js + TypeScript project — `package.json`, `tsconfig.json` (strict mode), install core dependencies
- Session C: Initialize `worker/` as a separate Node.js + TypeScript project — own `package.json`, `tsconfig.json`
- Session D: Write `docker-compose.yml` — define all 5 services (api, worker, db, redis, nginx) with correct ports, volumes, and env vars
- Session E: Write `api/Dockerfile` and `worker/Dockerfile` — Node 22 Alpine base, build steps, entrypoints
- Session F: Write `nginx/nginx.conf` — reverse proxy config forwarding to api:3000
- Session G: Write `.env.example` — all required env vars documented (DATABASE_URL, REDIS_HOST, JWT_SECRET, etc.)

> This is the foundation everything else runs on. Take the time to get Docker Compose right — a broken stack on Day 1 is expensive.

---

## Week 1 — Foundation (Days 1–5)

**Theme:** Running stack, TypeScript route layer, Prisma data model, JWT auth foundation.

---

### Day 1 — Docker Stack, AI Context, AppError ✓

**Goal:** All 5 Docker services start. AI context file is live. AppError class and global error handler committed.

**Why:** Every error in FlowBoard flows through the global handler. Building this on Day 1 means every route written from Day 2 onward has a consistent, safe error path. The AI context file is what keeps the AI generating consistent, project-aware code from this point forward.

**Sessions:**
- Session A: `docker compose up -d` — verify all 5 containers run; read logs for any startup errors
- Session B: Review `ai-context.md` at the project root — confirm all sections are present and accurate
- Session C: Create `api/src/errors/AppError.ts` — class extending Error, `isAppError` guard, `globalErrorHandler` middleware
- Session D: Create `api/src/app.ts` — Express app with `express.json()` and `globalErrorHandler` wired as last middleware
- Session E: Verify with a deliberate throw — confirm `{ success: false, message, code }` response shape; run `npx tsc --noEmit`

**Commit:** `day-01: environment setup, AppError, global error handler` ✓

---

### Day 2 — TypeScript Route Layer (Tasks) ✓

**Goal:** All four task endpoints typed end-to-end. `npx tsc --noEmit` passes with zero errors.

**Why:** This is the core typed handler pattern — Zod schema → `z.infer` → `Request<Params, _, Body>` → `next(err)`. You'll repeat this pattern for every route. Get it right here.

**Sessions:**
- Session A: Create `api/src/lib/prisma.ts` — Prisma Client singleton (global pattern to survive hot reload)
- Session B: Create `api/src/routes/tasks.ts` — router scaffold, define `TaskIdParam`, implement `GET /tasks/:id`
- Session C: Define `CreateTaskSchema`, implement `POST /tasks` — return 201
- Session D: Define `UpdateTaskSchema` (all fields optional), implement `PATCH /tasks/:id` and `DELETE /tasks/:id` (204)
- Session E: Mount tasks router in `app.ts`; run `npx tsc --noEmit` — fix every type error before committing

**Commit:** `day-02: typed task routes with Zod validation` ✓

---

### Day 3 — Prisma Schema, Migration, Seed

**Goal:** Full data model in PostgreSQL. Migration runs clean. Seed data confirmed in Prisma Studio.

**Why:** The schema is the contract for the entire API. Getting it right and migrated on Day 3 means you're using real typed queries from Day 4 onward — no schema changes mid-week.

**Sessions:**
- Session A: Write `api/prisma/schema.prisma` — User, Board, Task, AuditLog models + TaskStatus and Priority enums
- Session B: Run `docker compose exec api npx prisma migrate dev --name init` — confirm migration completes cleanly
- Session C: Run `docker compose exec api npx prisma generate` — confirm TypeScript types are generated
- Session D: Write `api/prisma/seed.ts` — 1 user (bcrypt-hashed), 2 boards, 3 tasks; use upsert on email to be idempotent
- Session E: Run seed; open Prisma Studio; verify all records are present

**Commit:** `day-03: prisma schema, migration, seed data`

---

### Day 4 — Boards CRUD + Full Route Wiring

**Goal:** All board endpoints implemented. All task routes wired to real Prisma queries. Manually tested in Postman/Bruno.

**Why:** Day 4 is the first day everything connects — routes, Prisma, TypeScript types, and the global error handler all working together end-to-end.

**Sessions:**
- Session A: Implement `api/src/routes/boards.ts` — `GET /boards`, `POST /boards` with `CreateBoardSchema`
- Session B: Implement `GET /boards/:id` and `DELETE /boards/:id` — ownership check stub (full enforcement Day 11)
- Session C: Update `api/src/app.ts` — mount boards router; add placeholder `/auth` and `/health` mounts
- Session D: Manual API testing in Postman/Bruno — all task and board happy paths; all expected error cases
- Session E: Test global error handler deliberately — throw AppError 404, confirm response shape; throw unknown Error, confirm 500

**Commit:** `day-04: boards CRUD, full route layer`

---

### Day 5 — JWT Auth Foundation

**Goal:** Register and login return JWT tokens. `authenticate` middleware protects all routes. AuditLog entries written on task mutations.

**Why:** Auth is the backbone of the security model. Everything in Week 3 (ownership checks, rate limiting, brute-force protection) builds on this foundation.

**Sessions:**
- Session A: Install `jsonwebtoken`, `bcrypt` + their `@types`; create `api/src/routes/auth.ts` with `RegisterSchema` and `LoginSchema`
- Session B: `POST /auth/register` — bcrypt hash (cost 12), upsert check, generate token pair, return tokens
- Session C: `POST /auth/login` — verify with bcrypt.compare; same 401 for "not found" and "wrong password" (don't leak which)
- Session D: Create `api/src/middleware/authenticate.ts` — verify Bearer token, attach `req.user = { id, email }`; augment Express Request type
- Session E: Apply `authenticate` to all `/boards` and `/tasks` routes; test 401 on missing token; add `prisma.auditLog.create` calls to task mutations

**Commit:** `week-01 complete: API, auth foundation, Prisma schema`

---

## Week 2 — Core Features (Days 6–10)

**Theme:** Redis integration, production-grade auth with token rotation, background worker, integration test suite.

---

### Day 6 — Redis Client & Rate Limiter

**Goal:** Redis wired up. Rate limiter on auth endpoints. Redis failure handled gracefully (fail-open).

**Why:** The fail-open pattern is the most important part of this day. A broken Redis must never bring down the API — traffic should flow through, not be blocked.

**Sessions:**
- Session A: Create `api/src/lib/redis.ts` — ioredis singleton, error listener (logs but does not crash)
- Session B: Create `api/src/middleware/rateLimiter.ts` — INCR + EXPIRE pattern, key `rate:{ip}`, 100 req / 15 min
- Session C: Wrap Redis calls in try/catch — on error: log with logger.warn, call `next()` to fail open
- Session D: Apply `rateLimiter` to `POST /auth/login` and `POST /auth/register` only — not globally
- Session E: Test 429 trigger (loop 101 requests); test fail-open (stop Redis, confirm requests still succeed)

**Commit:** `day-06: Redis client, rate limiter middleware`

---

### Day 7 — Refresh Token Rotation & Logout

**Goal:** Refresh tokens stored in Redis with 7-day TTL. Token rotation on every use. Replay attack blocked.

**Why:** Without rotation, a stolen refresh token is valid for 7 full days. Rotation limits the exposure window to seconds — the moment the legitimate user next refreshes, the stolen token is invalidated.

**Sessions:**
- Session A: Update register and login to store refresh tokens in Redis — key: `refresh:{userId}:{tokenId}`, TTL: 604800s
- Session B: Implement `POST /auth/refresh` — verify JWT, check Redis, DEL old key, issue new pair, store new key
- Session C: Implement `POST /auth/logout` — DEL refresh key from Redis, return 204
- Session D: Test replay attack — use same refresh token twice; second call must return 401
- Session E: Verify TTLs in Redis CLI; confirm no refresh token survives past 7 days

**Commit:** `day-07: refresh token rotation, logout endpoint`

---

### Day 8 — Redis Streams & Background Worker

**Goal:** Task events published to Redis Stream on every mutation. Worker consumes them and writes AuditLog. Failed messages go to DLQ after 3 retries.

**Why:** The async decoupling pattern — user never waits for audit logging — is what makes the API fast and resilient. The DLQ ensures no event is silently dropped.

**Sessions:**
- Session A: Create `api/src/lib/events.ts` — `publishTaskEvent` using `redis.xadd` to `tasks:events`; wrap in try/catch so publish failure never fails the HTTP response
- Session B: Call `publishTaskEvent` in all three task mutation handlers (create, update, delete)
- Session C: Create `worker/src/index.ts` — ioredis + PrismaClient setup; create consumer group `audit-group` on startup (catch BUSYGROUP error); start XREADGROUP loop
- Session D: Create `worker/src/handlers/` — one handler per action; each writes AuditLog and calls XACK on success
- Session E: Implement retry tracking and DLQ — after 3 failures, LPUSH to `tasks:events:dlq` with full context JSON (see DLQ format in `ai-context.md`); verify end-to-end

**Commit:** `day-08: Redis Stream events, worker consumer, AuditLog integration`

---

### Day 9 — Integration Test Suite

**Goal:** Tests for all endpoints. Minimum 1 happy-path + 1 error-path per endpoint. Auth tests cover the full flow including replay attack.

**Why:** The Security Gate trainer runs your test suite. Tests written now also catch regressions when you harden the API in Week 3.

**Sessions:**
- Session A: Set up `docker-compose.test.yml` — separate test DB; configure Jest with `testEnvironment: 'node'`; verify `npx jest` runs inside container
- Session B: Write `api/tests/auth.test.ts` — register, duplicate email, login, wrong password, refresh, replay attack, logout
- Session C: Write `api/tests/tasks.test.ts` — full CRUD with happy + error paths; beforeAll registers user and creates a board
- Session D: Write `api/tests/boards.test.ts` — full CRUD; ownership cross-user 403 tests
- Session E: Write rate limiter test (loop to 429); run full suite; fix all failures before committing

**Commit:** `day-09: integration test suite`

---

### Day 10 — Coverage & Mid-Point Review

**Goal:** Coverage ≥ 80% lines and branches. All 9 prior commits verified. Clean stack restart from scratch.

**Why:** This is a mandatory quality gate before Week 3. Gaps in tests or broken features found here are cheap to fix. The same gaps found during the Security Gate are a fail.

**Sessions:**
- Session A: Run `npx jest --coverage` — review the HTML report; list uncovered branches
- Session B: Add targeted tests to reach 80% on both lines and branches
- Session C: Run `npx tsc --noEmit` — fix any type errors introduced during Days 6–9
- Session D: `git log --oneline` — confirm all 9 commits with correct message prefixes
- Session E: `docker compose down -v && docker compose up -d` — clean restart; full smoke test (register → login → create task → refresh → logout)

**Commit:** `week-02 complete: Redis, worker, auth hardening, test suite`

---

## Week 3 — Security & Ship (Days 11–15)

**Theme:** OWASP hardening, production observability, Security Gate readiness.

---

### Day 11 — Helmet, CORS, Ownership Enforcement

**Goal:** Security headers on all responses. CORS locked to allowed origins. Ownership fully enforced with 403.

**Why:** A01 Broken Access Control is the #1 OWASP risk. Any authenticated user should not be able to touch another user's data — not a stub, not a partial check.

**Sessions:**
- Session A: Install `helmet` + `cors`; add `app.use(helmet())` as first middleware; verify headers in Postman
- Session B: Add `cors({ origin: process.env.ALLOWED_ORIGINS?.split(','), credentials: true })`; add `ALLOWED_ORIGINS` to `.env.example`
- Session C: Add `express.json({ limit: '10kb' })` body size limit; add `app.set('trust proxy', 1)`
- Session D: Implement full ownership checks in all task and board handlers — `resource.ownerId !== req.user.id` → throw AppError 403
- Session E: Test ownership with two different users; test 413 with 15kb payload; confirm CORS rejection from unexpected origin

**Commit:** `day-11: Helmet, CORS, ownership checks`

---

### Day 12 — Brute-Force Protection & Mass Assignment Prevention

**Goal:** Login throttle tightened. All Zod schemas explicitly whitelist fields. No stack traces in production errors.

**Why:** A07 (brute-force) and A08 (mass assignment) are both trivial to exploit and trivial to fix. The Zod schemas you've written already prevent mass assignment — this day is about auditing them and locking in the protection formally.

**Sessions:**
- Session A: Create a tighter `loginRateLimiter` — lower threshold (e.g. 10 requests per 15 min) specifically for failed auth
- Session B: Audit all Zod schemas — confirm every schema is an explicit `z.object({})` with no catch-all fields
- Session C: Test mass assignment: `POST /tasks` with `{ isAdmin: true, title: 'x', ... }` — confirm `isAdmin` is absent from created record
- Session D: Update `globalErrorHandler` — check `NODE_ENV === 'production'`; omit `stack`; return generic message for non-AppError errors
- Session E: Set `NODE_ENV=production` in `.env`, trigger a TypeError, confirm no stack trace in response

**Commit:** `day-12: brute-force protection, mass assignment prevention`

---

### Day 13 — Pino Structured Logging

**Goal:** All `console.log` replaced. Every HTTP request logged via `pino-http`. Authorization and password fields confirmed redacted.

**Why:** A02 (cryptographic failures) includes accidental token/password logging. Pino's `redact` config is the systematic fix — you can't forget to redact field-by-field if the logger does it automatically.

**Sessions:**
- Session A: Install `pino`, `pino-http`, `pino-pretty`; create `api/src/lib/logger.ts` with redact config
- Session B: Replace all `console.log` / `console.error` in `api/src/` with structured `logger.info` / `logger.error` calls
- Session C: Add `pinoHttp({ logger })` middleware to `app.ts` — after helmet/cors, before routes
- Session D: Add pino logger to `worker/src/` — replace all console calls
- Session E: Make a login request; check `docker compose logs api` — confirm `authorization` and `password` show as `[Redacted]`

**Commit:** `day-13: Pino structured logging`

---

### Day 14 — Health Checks & DLQ Documentation

**Goal:** `/health` and `/ready` live. `/ready` returns 503 when any dependency is down. DLQ format confirmed in `ai-context.md`.

**Why:** Health and readiness endpoints are what load balancers and monitoring use to know if your service is alive. Without `/ready`, a failing database is invisible until users report errors.

**Sessions:**
- Session A: Create `api/src/routes/health.ts` — `GET /health` returns `{ status: 'ok', uptime: process.uptime() }`
- Session B: Implement `GET /ready` — `prisma.$queryRaw\`SELECT 1\`` + `redis.ping()`; 503 on failure via AppError
- Session C: Mount health router in `app.ts` without `authenticate` middleware (health routes must be public)
- Session D: Test `/ready` with Redis stopped → 503; restart Redis → 200; test with DB stopped → 503
- Session E: Open `ai-context.md`, find the DLQ format section — confirm the key name and JSON entry shape exactly match what your worker writes; update if there are any discrepancies

**Commit:** `day-14: health checks, DLQ documentation`

---

### Day 15 — Security Gate Self-Review & Final Prep

**Goal:** Every checklist item in the Security Gate (Section 5 of the project brief) is ticked. You can answer the end-to-end question without looking at code.

**The Security Gate question — answer this aloud before notifying your trainer:**
> "Walk me through what happens from the moment a PATCH /tasks/:id request hits Nginx to the moment the AuditLog row is written."

**Sessions:**
- Session A: Work through Security Gate checklist sections 5.1–5.4 (Repository, Auth, Validation, Security Middleware) — fix anything unchecked
- Session B: Work through sections 5.5–5.8 (Redis, Worker/AuditLog, Tests, Observability) — fix anything unchecked
- Session C: `docker compose down -v && docker compose up -d` — clean start; run migrations; verify all services healthy
- Session D: `npx tsc --noEmit` → zero errors; `npx jest --coverage` → ≥ 80% lines and branches
- Session E: Answer the Security Gate question aloud. If you stumble, read the relevant code and try again. When you can answer it cleanly — notify your trainer.

**Commit:** `week-03 complete: OWASP hardening, production patterns, Security Gate ready`

---

## Security Gate Readiness Summary

Run through this before notifying your trainer:

| Area | Verification command / test |
|------|----------------------------|
| Clean startup | `docker compose down -v && docker compose up -d` |
| TypeScript | `docker compose exec api npx tsc --noEmit` → 0 errors |
| Tests | `docker compose -f docker-compose.test.yml exec api npx jest --coverage` → ≥ 80% |
| Auth flow | Register → login → refresh → replay (401) → logout |
| Ownership | Cross-user PATCH → 403 |
| Rate limit | 101 requests to /auth/login → 429 on 101st |
| Redis keys | `redis-cli KEYS "rate:*"`, `redis-cli KEYS "refresh:*"` |
| Refresh TTL | `redis-cli TTL "refresh:<userId>:<tokenId>"` ≈ 604800 |
| Stream | `redis-cli XLEN tasks:events` increases after task mutations |
| Consumer group | `redis-cli XINFO GROUPS tasks:events` shows `audit-group` |
| AuditLog | Prisma Studio shows rows for every task mutation |
| DLQ | `tasks:events:dlq` format matches `ai-context.md` |
| Security headers | Helmet headers visible in Postman response |
| Body limit | 15kb payload → 413 |
| Health | `GET /health` → 200; `GET /ready` → 503 with Redis stopped |
| Logging | No `authorization` or `password` values visible in logs |
| Commits | `git log --oneline` shows all 15 commits with correct prefixes |
| Secrets | No hardcoded values in source; `.env.example` is complete |
