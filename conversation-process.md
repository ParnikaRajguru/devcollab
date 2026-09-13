# DevCollab — Conversation & Learning Log

This file records our working sessions: decisions made, files created,
commands run, errors diagnosed, and interview-ready explanations.
It is appended to and updated every session.

---

## Project Snapshot

**DevCollab** — a real-time collaborative code review platform (like Google Docs for code).

**Stack (final — do not propose alternatives):**
- Monorepo: Turborepo + npm workspaces
- Backend: NestJS + TypeScript (CommonJS) at `apps/api` (port 3000)
- Frontend: React + Vite + TS at `apps/web` (not started)
- DB: PostgreSQL 16 via Docker (host port **5433** — see lesson below)
- Cache/presence: Redis 7 via Docker
- ORM: TypeORM (`@nestjs/typeorm`), `@nestjs/config`
- Validation: class-validator + class-transformer (DTOs)
- Hashing: bcrypt
- Auth (upcoming): Passport JWT (access + refresh), Guards, RBAC
- Real-time (later): Socket.IO + Monaco

## Trusted errors / gotchas discovered so far

1. **The home-folder `.git` hijack** — a parent `C:\Users\Parnika Rajguru\.git`
   swallowed the repo. Fixed by reinitializing a fresh repo. `.env` stays ignored.
2. **Postgres host port is 5433**, not 5432 — `docker-compose.yml` maps
   `5433:5432`, so `.env` uses `DATABASE_PORT=5433`. When code and docs
   disagree, **the code wins**.
3. **README/master-plan claims deps were installed when they weren't** — always
   verify with `npm ls <pkg>` before assuming.

---

## Session 1 — Phase 5: Users module (register user)

### Goal
Build `POST /users`: DTO validation -> bcrypt hashing -> save via TypeORM
repository -> exclude `password_hash` from response -> 409 on duplicate email.

### Decisions (agreed with user)
- **Inline comments in code** (user chose this for learning).
- Duplicate email -> **`409 Conflict`** with message `A user with this email already exists`.
- Strip `password_hash` manually via object destructuring (no serializer magic yet).
- `salt rounds = 10` (bcrypt cost factor 2^10).

### What was done, in order
1. **Installed deps** (they were genuinely missing despite the master plan):
   - `npm install -w api class-validator class-transformer bcrypt`
   - `npm install -w api -D @types/bcrypt`
   - Result: class-validator@0.15.1, class-transformer@0.5.1, bcrypt@6.0.0,
     @types/bcrypt@6.0.0. `@nestjs/common` pulls class-validator/transformer
     as peers; `deduped` = one shared copy in root `node_modules`.
   - Note: EBADENGINE warnings came from NestJS's internal Angular CLI dep
     (wants Node >= 24.15; we run 24.12) — harmless.
2. **Created `apps/api/src/users/dto/create-user.dto.ts`** — see file for
   line-by-line comments.
3. *(remaining steps pending as the session continues)*

### Commands learned this session
| Command | What it does |
| --- | --- |
| `npm ls <pkg> [<pkg>...]` | Verify installed packages + versions |
| `npm install -w api <pkg>` | Install a runtime dep into the `api` workspace |
| `npm install -w api -D <pkg>` | Install a dev-only dep (types) into `api` |

### Interview notes (to be written at end of session)

---

*Append future sessions below this line.*