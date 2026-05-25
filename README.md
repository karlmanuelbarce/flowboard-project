# FlowBoard

Production-grade task management REST API — Stratpoint Node.js Engineering Program Part 2 capstone.

## Services

| Service  | Description                        | Port |
|----------|------------------------------------|------|
| api      | Express/TypeScript REST API        | 3000 |
| worker   | Redis Stream consumer (no HTTP)    | —    |
| db       | PostgreSQL 16                      | 5432 |
| redis    | Redis 7                            | 6379 |
| nginx    | Reverse proxy                      | 80   |

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

## Structure

```
api/       Express API (TypeScript)
worker/    Background worker (TypeScript)
nginx/     Reverse proxy config
```