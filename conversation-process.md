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
- Frontend: React (19) + Vite + TS at `apps/web` (port 5173) — scaffolded in Phase 7
- DB: PostgreSQL 16 via Docker (host port **5433** — see lesson below)
- Cache/presence: Redis 7 via Docker
- ORM: TypeORM (`@nestjs/typeorm`), `@nestjs/config`
- Validation: class-validator + class-transformer (DTOs)
- Hashing: bcrypt
- Auth: Passport JWT done (Phase 6); RBAC per-project roles done (Phase 8)
  via `@Roles()` + RolesGuard (owner > collaborator > viewer)
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
   - User re-confirmed via `npm ls` (passes — because of step 1!) and
     confirmed port 5433. Lesson: verify with tools AND remember the timeline.
2. **Created `apps/api/src/users/dto/create-user.dto.ts`** — `@IsEmail`,
   `@IsString`, `@MinLength(8)`, `@IsNotEmpty`, `@IsOptional`. Fully commented.
3. **Created `apps/api/src/users/users.service.ts`** — constant `SALT_ROUNDS = 10`,
   `bcrypt.hash()` generating its own random salt, `repository.create()` ->
   `save()` in a try/catch, `isUniqueViolation()` helper checking PG SQLSTATE
   `23505` (handles TypeORM-wrapped `driverError.code`), throws
   `ConflictException`. Returns `Omit<User, 'password_hash'>` via destructuring.
4. **Created `apps/api/src/users/users.controller.ts`** — `@Controller('users')`,
   `@Post()` + `@Body() CreateUserDto` -> `POST /users`.
5. **Created `apps/api/src/users/users.module.ts`** — `TypeOrmModule.forFeature([User])`,
   registers controller + service, `exports: [UsersService]` (for Phase 6 auth).
6. **Wired into `apps/api/src/app.module.ts`** — imported `UsersModule` and added
   it to the `imports` array.
7. **Global ValidationPipe in `apps/api/src/main.ts`** —
   `useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`.
8. **Build + lint** — `npm run build` (nest build) clean; `npm run lint` (oxlint) clean.
9. **Live API tests** (server started in background via `node dist/main.js`):
   - Valid register -> 201, response contains NO `password_hash`.
   - Duplicate email -> **409** `A user with this email already exists`.
   - Short password -> **400** `password must be at least 8 characters`.
   - Bonus `{"role":"admin","foo":"bar"}` junk -> stripped by whitelist, user
     still created fine. Verified NO `role` column exists in the table.
10. **DB verification** via `docker exec devcollab-postgres-1 psql`:
    - `\d users` shows `UUID PK`, `UNIQUE CONSTRAINT` on `email`, nullable
      `avatar_url`, `created_at`. No `role` column -> mass-assignment blocked.
    - Two rows present; hashes start `$2b$10$` = bcrypt v2b, cost 10, random salt.
11. **Stopped the background API process** (PID saved to %TEMP% for cleanup).
12. **Docker tip discovered**: Docker Desktop installs at
    `%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe` (NOT the default
    Program Files path), and the engine must be running before `docker compose up`.

### Commands learned this session
| Command | What it does |
| --- | --- |
| `npm ls <pkg> [<pkg>...]` | Verify installed packages + versions |
| `npm install -w api <pkg>` | Install a runtime dep into the `api` workspace |
| `npm install -w api -D <pkg>` | Install a dev-only dep (types) into `api` |
| `Start-Process <exe>` / `Stop-Process -Id <pid>` | Start/stop a background process on Windows |
| `Invoke-RestMethod -Method Post -Body ...` | Send a JSON POST from PowerShell (throws on 4xx/5xx — catch it) |
| `docker exec devcollab-postgres-1 psql -U devcollab -d devcollab -c "<sql>"` | Run SQL inside the Postgres container |

### Interview notes
**What is a DTO?** A Data Transfer Object is a plain class that *describes the
shape of data crossing a boundary* (here: the HTTP request body). It types the
payload at compile time AND carries `class-validator` decorators that validate
at runtime. Nest trusts it as the single source of truth for "what does a valid
request look like" — controller stays skinny, service stays focused on business
logic. Layering (Controller -> DTO -> Service -> Repository) is the classic
NestJS answer.

**Why bcrypt over SHA-256?** SHA-256 is a *fast, deterministic* function
designed for integrity checks, not passwords. Fast + deterministic = attackers
can brute-force billions of guesses/sec and precompute rainbow tables. bcrypt is
a *slow, salted, adaptive* KDF: it internally iterates 2^(cost) times (cost 10 =
1024 rounds), so each guess is expensive, and it auto-generates a random salt so
identical passwords never produce identical hashes. Its slowness is a feature:
you tune it up as hardware gets faster.

**Why hash server-side even over HTTPS?** HTTPS protects data *in transit*
(between browser and server). The server must still protect data *at rest* —
if the DB is ever breached, dumping the `users` table must not reveal
passwords. Also, TLS termination happens at the server; beyond that hop, the
plaintext password would exist in server memory/logs. Hash as soon as it
arrives, so the raw secret exists only transiently in memory, never on disk.

**What is a salt?** A random value mixed into the password before hashing, so
the same password yields a different hash every time. It defeats *rainbow
tables* (precomputed hash->password maps) and *cross-user* attacks (two users
with `password123` get totally different hashes — you can't tell they're the
same). bcrypt embeds the salt into the output string
(`$2b$10$<22-char-salt><31-char-hash>`), so no separate storage field is needed
and the salt is verified automatically on a future login check.

### How to reproduce the "phase complete" starting point later
1. `docker compose up -d` (from repo root; engine must be running).
2. `cd apps\api && npm run start:dev`
3. POST http://localhost:3000/users with a JSON body.

---

## Session 2 — Phase 6: Auth module (login + JWT access/refresh)

### Goal
`POST /auth/login` (bcrypt.compare -> JWT access+refresh tokens), `POST
/auth/refresh` (rotates tokens), protected `GET /users/me` via Passport JWT.

### Decisions
- Two secrets + two lifetimes: access 15m / refresh 7d. Both generated in `.env`.
- Stateless refresh tokens for now (no server-side store) — noted for later:
  production typically stores + rotates them in the DB.
- RBAC (roles guard) **deferred to Phase 8**: roles describe project
  *membership* (owner/collaborator/viewer), not users, so they belong with the
  Project entity.

### What was done, in order
1. Installed `@nestjs/jwt@12.0.1 @nestjs/passport@12.0.0 passport@0.7.0
   passport-jwt@4.0.1` (+ dev `@types/passport-jwt@4.0.1`).
2. `.env`: appended `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (2x64 hex chars,
   generated, never printed), `JWT_ACCESS_EXPIRES_IN=15m`,
   `JWT_REFRESH_EXPIRES_IN=7d`.
3. Created `apps/api/src/auth/`:
   - `jwt-payload.interface.ts` — `{ sub, email, type: 'access'|'refresh' }`
   - `dto/login.dto.ts` — email + password (NO MinLength: login accepts what
     signup enforced years ago)
   - `dto/refresh.dto.ts` — `refresh_token`
   - `jwt.strategy.ts` — `PassportStrategy(Strategy, 'jwt')`, Bearer extraction,
     checks `type === 'access'`, returns `{ userId: payload.sub, email }`
   - `jwt-auth.guard.ts` — `AuthGuard('jwt')`
   - `auth.service.ts` — login (constant-time compare, no user-enumeration),
     refresh (verify w/ refresh secret, type check, re-issue pair)
   - `auth.controller.ts` — POST /auth/login, POST /auth/refresh
   - `auth.module.ts` — imports UsersModule + PassportModule.register + JwtModule
4. `users.service.ts`: added `findByEmail` and `findById`.
5. `users.controller.ts`: added `@UseGuards(JwtAuthGuard)` `GET /users/me`.
6. Wired AuthModule into `app.module.ts`.

### Errors hit & the lesson each taught (the real value of this session)
1. **TS2345 during `nest build`**: `config.get('JWT_ACCESS_SECRET')` is
   `string | undefined`; passport-jwt's `secretOrKey` won't accept undefined.
   Fix: `config.getOrThrow(...)` — fails at STARTUP if env var is missing,
   instead of silently verifying against nothing. Strict TS caught a real bug.
2. **UnknownDependenciesException on JwtAuthGuard in UsersModule**: read
   `node_modules/@nestjs/passport/dist/passport.module.js` -> bare
   `PassportModule` is `@Module({})` and provides NOTHING in v12. The
   `AuthModuleOptions` the guard injects exists ONLY via
   `PassportModule.register()/.registerAsync()`. Fix: every module using a
   passport guard imports `PassportModule.register({...})`. (@Global alone
   didn't help because the bare module had no providers to export.)
3. **500 on /users/me + /auth/refresh, log showed
   `TypeORMError: Undefined value encountered in property 'User.id'`**:
   dashboard clue = both failing paths call `findById`. Root cause: JWTs were
   signed WITHOUT the `sub` claim (my `signTokens(userId,...)` received the id
   but never put it in the payload), so `payload.sub` / `req.user.userId` were
   `undefined`. TypeORM v1 THROWS on `where: { id: undefined }` (v0.3 silently
   ignored — the crash was the DB catching the bug). Fix: `{ sub: userId, ... }`.

### Verified live
- Login wrong password -> 401   (no user enumeration: same message always)
- Login correct -> 200: tokenType Bearer, access+refresh present
- GET /users/me WITH token -> 200, no password_hash
- GET /users/me WITHOUT token -> 401
- POST /auth/refresh with refresh token -> 200 new pair
- POST /auth/refresh with ACCESS token -> 401 (type claim defends it)
- Build + lint clean all the way through.

### Interview notes
**JWT (JSON Web Token)**: 3 base64url parts, `header.payload.signature`,
signed with the server secret so ANY server can verify without a shared
session store (stateless). Trade-offs: can't revoke early — hence SHORT access
lifetimes (15m) + a refresh token with its own longer lifetime.

**Why access AND refresh tokens?** Access token = "admission ticket" reused on
every request; the shorter it lives, the smaller the blast radius if stolen.
Refresh token = only used to mint new access tokens, kept in a secure place
(long-lived). Stealing only the access token is nearly useless; rotation also
means a session can be killed by losing the refresh token.

**Passport "strategy" abstraction**: passport-jwt = one strategy; Nest wraps it
so `AuthGuard('jwt')` = "run the jwt strategy, put its result on req.user,
401 on failure". Strategies are the shapes of authentication (jwt, local,
oauth) — eg. later: WS handshake auth, Github OAuth.

**@UseGuards + Guards**: guard = class with canActivate() that runs BEFORE the
handler; returning false -> 403/401, handler never executes. Guards are
declarative request gatekeepers (frames of the request pipeline).

### How to reproduce later
1. `docker compose up -d`; 2. `cd apps\api && npm run start:dev`
3. Register a user, login to get tokens, call `GET /users/me` with
   `Authorization: Bearer <access>`, refresh with `{ "refresh_token": ... }`.

---

## Session 3 — Phase 7: Frontend foundation (React + Vite at apps/web)

### Goal
Stand up the SPA: React 19 + Vite + TS, react-router, an API client, an auth
context (login/register/logout/me), protected routes for `/home`, and wire the
browser <-> API security boundary (CORS).

### Decisions
- Keep the API-first posture: the SPA is a plain client of `:3000`, no SSR, no
  backend proxy (Vite dev `server.proxy` rejected — CORS header is the
  production pattern and we test it directly).
- Tokens live in `localStorage` for now (simplest, standard for SPAs); the
  trade-off vs httpOnly cookies (XSS vs CSRF surface) is logged below for
  interview prep. Rotation is already on the API (Phase 6).
- `.env` for the web app uses the `VITE_` prefix (Vite only exposes those to
  the client bundle — server secrets can't leak).
- Hand-wrote the Vite config layer (files written, not `npm create vite`), so
  every file is intentional and commented.

### What was done, in order
1. Wiped the Next.js scaffold out of `apps/web` (would have fought the
   node/CommonJS setup); `npm prune` removed extraneous `next@16.3.4`.
2. Installed the new stack:
   `react@19.2.8 react-dom@19.2.8 react-router-dom@7.18.3`,
   dev: `vite@7.3.6 @vitejs/plugin-react@4.7.0 typescript@7.0.2
   @types/react@19.2.18 @types/react-dom@19.2.5`.
3. Wrote config: `package.json`, `vite.config.ts` (react plugin, port 5173,
   `strictPort`), `tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`,
   `index.html` (root div + `/src/main.tsx`), `.env`
   (`VITE_API_URL=http://localhost:3000`), `.gitignore`.
4. Wrote `src/`:
   - `main.tsx` — ReactDOM root.
   - `App.tsx` — `<Routes>`: `/`, `/login`, `/register`, `/home` (protected), `*`.
   - `lib/api.ts` — typed fetch wrapper (base URL from Vite env, JSON
     parse/stringify, Bearer injection, 401 -> clear tokens + redirect /login).
   - `auth/AuthContext.tsx` — provider holding `user`, `login()`, `register()`,
     `logout()`; revalidates `GET /users/me` on mount with a stored access token.
   - `auth/ProtectedRoute.tsx` — redirects to `/login` (with `state.from`) when
     unauthenticated, else renders `<Outlet/>`.
   - `pages/RegisterPage.tsx`, `LoginPage.tsx`, `HomePage.tsx` — forms hit the
     API, tiny CSS, navigate to `/home` on success.
5. `npm run build` (tsc -b && vite build) PASS — 47 modules, 1.78s, dist output.
   `npm run lint` (oxlint) and `npm run check-types` clean.
6. API side of the wire:
   - `apps/api/src/main.ts` — `app.enableCors({ origin: ['http://localhost:5173'] })`.
   - `apps/api/package.json` — added `"dev": "nest start --watch"`.
   - root `turbo.json` — build `outputs` updated `.next/**` -> `["dist/**"]`.

### Errors hit & the lesson each taught (the real value of this session)
1. **CORS silently absent**: the frontend could NOT read API responses even
   though `enableCors` was in `src/main.ts`. Root cause: `dist/main.js` was
   STALE — the running server was old compiled code. `npm run build` fixed it.
   Lesson: on Windows dev, the API you *run* is `dist`, not `src`; if behavior
   disagrees with source, rebuild first, then debug.
2. **Preflight test returned 404**: my OPTIONS request had no
   `Access-Control-Request-Method` header, so the cors middleware treated it as
   a normal request and no route handled OPTIONS. A real browser preflight
   includes that header. Fix the test, not the app.
3. **`Invoke-RestMethod -ResponseHeadersVariable` "failed" with an empty
   message**: `-ResponseHeadersVariable` is PowerShell 7+. On 5.1 it's a
   *parameter binding error* (empty ErrorDetails). Use `Invoke-WebRequest` +
   `.Headers`.
4. **"Vite not up" false negatives**: Vite binds to `localhost`, and
   `TcpClient.Connect('127.0.0.1', ...)` / even `'localhost'` sometimes lands on
   the wrong address family (Win11 `localhost` = IPv6 `::1` nuance). Reliable
   check: retry `Invoke-WebRequest http://localhost:PORT` — it resolves DNS
   itself.
5. **Shell/tool hangs launching Vite**: starting via `npm`/`cmd` leaves orphaned
   `node` processes that keep the shell tool waiting forever (silent 90s
   timeouts). Working recipe (used for the API since Session 1): launch
   `node <abs-path-to-vite-bin>` directly with the 8.3 short path
   (`C:\Users\PARNIK~1\...`) to dodge spaces, redirect output to a file, poll,
   then `Stop-Process`. Everything proven works was re-run as a self-cleaning
   `.ps1` file.
6. **`POST /auth/login` returns 201, not 200** — NestJS default status for
   `@Post` is 201 unless `@HttpCode(HttpStatus.OK)`. Frontend uses `res.ok`, so
   it's harmless; we could add `@HttpCode(200)` later for REST purity.

### Verified live (end-to-end smoke)
- Web: `vite build` clean; dev server up -> `HTTP 200`,
  `<title>DevCollab</title>`, `/src/main.tsx` script served.
- CORS preflight `OPTIONS /users` (Origin http://localhost:5173 +
  Access-Control-Request-Method: POST) -> **204** with
  `Access-Control-Allow-Origin: http://localhost:5173` and
  `Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE`.
- Real requests WITH `Origin` header: `POST /users` -> 201 + ACAO echo;
  `POST /auth/login` -> 201 + ACAO echo.
- API regression: `GET /users/me` no token -> 401.

### Interview notes
**Context API vs lifting state up / Redux?** Context gives any component under
a provider access to shared state without prop-drilling and re-renders them on
change. Good for low-frequency app-wide state like the current user. A store
(Redux/Zustand) adds selectors/middleware/serialization worth it when state is
large & frequently updated; for one-window auth state Context is the built-in,
framework-native choice. AuthContext + `useAuth()` hook = the standard pattern.

**ProtectedRoute pattern**: a component that checks auth state BEFORE rendering
its children; if missing -> `<Navigate to="/login" state={{from}}>` (a
declarative redirect). After login we read `location.state?.from` and send the
user back — better UX than always dumping them on `/home`.

**Why a fetch wrapper instead of axios?** One place to: set baseURL, apply
`Authorization`, serialize/parse JSON, surface `{message}` errors from our API,
and centralize the 401 "session dead" handling. Zero extra dependency; axios
would add interceptors doing the same thing. Keeps pages free of HTTP boilerplate.

**Why CORS, actually?** The browser enforces the Same-Origin Policy: a page on
`localhost:5173` may not READ a response from `localhost:3000` unless the
*server* opts in via `Access-Control-Allow-Origin`. It's opt-in security by the
API, not a request the client can grant itself. We allow exactly the one dev
origin. (A Vite proxy is an alternative that defeats SOP only during dev by
making calls appear same-origin — but then production needs CORS/nginx anyway,
so we tested the real mechanism.)

**localStorage tokens vs httpOnly cookies**: Bearer-over-`localStorage` is
invulnerable to CSRF (no cookie is auto-sent) but if an XSS runs, it can read
tokens. httpOnly cookies are invisible to JS (XSS-safe for the token) but
introduce CSRF risks that need SameSite/CSRF tokens. SPA convention: short
access token (15m) + rotating refresh keeps the window small; many real apps
also pin the refresh token to device/IP. Cloudflare & friends now default
renderers to deny-by-default third-party storage — worth a mention in talk #2.

**Why `VITE_` prefix**: Vite inlines env vars into the public bundle at build
time; only `VITE_*` are exposed so a `process.env`-style leak of server secrets
is structurally impossible.

### How to reproduce later
1. Docker up; `cd apps\api` -> `npm run start:dev` (API on :3000).
2. `cd apps\web` -> `npm run dev` (Vite on :5173).
3. Open http://localhost:5173 -> register -> replicate login -> land on
   `/home` with email shown -> logout returns to `/login`.

---

## Session 4 — Phase 8: Projects + RBAC membership

### Goal
`Project` entity + CRUD, a `ProjectMember` join table with roles, and
per-project authorization: `@Roles(...)` metadata + a `RolesGuard`.

### Decisions (agreed with user)
- Project fields: `name` (required) + `description` (optional) only — no
  repo URL / visibility yet (added later when the feature needs them).
- **Owner only** may add/remove/change members.
- Scope: Projects + RBAC only; files/folders deferred to a later phase.
- Roles ordered OWNER > COLLABORATOR > VIEWER (rank 3/2/1). Exactly one
  OWNER per project — the creator, immutable (no second owner, no
  self-demotion: either would leave a project ownerless).
- `@Roles(VIEWER)` = any member passes; `@Roles(OWNER)` = owner only. The
  partial order lets ONE guard express the whole access matrix.
- `password_hash` hardened with `select: false` so any future `relations`
  join (project members, comments, …) can never leak hashes.

### What was done, in order
1. Entities:
   - `projects/project-role.enum.ts` — string enum `owner|collaborator|viewer`
     (string values keep the Postgres enum readable).
   - `projects/project.entity.ts` — uuid PK, `name`, `description` nullable,
     `owner_id` (FK -> users, ON DELETE CASCADE), `created_at`, `members`
     OneToMany.
   - `projects/project-member.entity.ts` — **composite PK**
     `(project_id, user_id)`, `role` enum column default `viewer`, FK CASCADE
     both directions.
2. DTOs: `create-project` (name required), `update-project` (all optional),
   `add-member` (`userId` + `role`), `update-member-role` (`role`).
3. `common/decorators/roles.decorator.ts` — `ROLES_KEY` + `@Roles(...)`
   (`SetMetadata`).
4. `projects/roles.guard.ts` — reads `@Roles` via Reflector, loads the
   caller's `ProjectMember` row, rank check -> 403. No `@Roles` metadata =
   allow (JwtAuthGuard still ran).
5. `projects/projects.service.ts`:
   - `create` — **one transaction**: project row + creator's OWNER row
     (`dataSource.transaction`, ACID).
   - `findAllForUser` — QueryBuilder `innerJoin` membership, selects the user's
     `role` per project (front-end needs it for UI decisions).
   - `findOneForUser` — project + full member list (`relations: { members: {
     user: true } }`); non-members get the same **404 as a missing project**
     (no existence leak).
   - `update`/`remove` / member ops — owner checks inline (defense in depth;
     the guard already enforced it).
6. `projects.controller.ts` — `POST|GET /projects`, `GET|PATCH|DELETE
   /projects/:id`, `POST|PATCH|DELETE /projects/:id/members[/:memberId]`;
   class-level `@UseGuards(JwtAuthGuard, RolesGuard)`.
7. `projects.module.ts` + wired into `app.module.ts` (entities + module).
8. `user.entity.ts`: `password_hash` -> `@Column({ select: false })`;
   `UsersService.findByEmail` re-adds it via `.addSelect('user.password_hash')`
   (the ONLY caller that needs it — login).

### Gotchas swallowed this session (the real value)
1. **`save()` is an UPSERT, not "insert or die"**: re-adding an existing
   member updated their role instead of erroring. Switching to
   `membersRepository.insert(...)` makes duplicates hit the composite PK and
   surface as 409. Rule: `save()` for "insert-or-update", `insert()` when you
   rely on the constraint firing.
2. **`select: false` applies even to QueryBuilder `findOne`**: after hardening,
   `login()` silently broke (hash undefined -> `bcrypt.compare` -> no match ->
   401). Fail mode was invisible (no crash). Lesson: when you add `select:
   false`, grep every consumer that legitimately needs the column.
3. **PowerShell: `return $action` on a ScriptBlock does NOT run it** —
   `TryReq { ... }` must be `return (& $action)`. Caused a full cascade of
   "null body" test flakiness.
4. **PS 5.1 `ConvertFrom-Json '[]'` yields `$null`**, so `@($null).Count` = 1
   and "list is empty" assertions invert. Use a null-aware count helper.
5. **RolesGuard hits the same PassportModule v12 gotcha** (bare module is
   empty) — third module in a row (Users, Auth, Projects).

### Verified live (30/30 assertions)
- Create -> 201; owner auto-OWNER row; list shows role owner.
- Outsider: GET project -> 404, own list empty (member before invite).
- Add collaborator -> 201; member GET -> 200, `my_role` collaborator,
  member list 2 rows, **no `password_hash` in the whole body**.
- Collaborator PATCH / DELETE / add-member -> 403 (guard).
- Owner PATCH -> 200, name updated.
- Second owner -> 400, duplicate member -> 409, ghost user -> 404,
  self-demotion -> 400.
- Demote -> viewer 200; remove member -> 200; member now 404.
- Delete project -> 200; cascade cleared memberships; owner list empty.
- `\d` confirms composite PK, enum type, `ON DELETE CASCADE` FKs.

### Interview notes
**Authorization vs authentication**: auth = *who are you* (JwtAuthGuard);
authorization = *what may you do* (RolesGuard). Spring/Rails-style RBAC:
decorator declares requirement (`@Roles('owner')`), a guard resolves the
actor's role against the resource and denies 403.

**Composite primary keys**: `(project_id, user_id)` IS the membership identity
— the DB enforces "one row per user per project" atomically, no app-level
check-then-insert race. This is the "optimistic" counterpart to the 409 path:
we insert, the constraint decides, we translate 23505.

**Why a transaction for create**: two writes (project + owner row) that only
make sense together; a half-done create would leave an ownerless project.
`dataSource.transaction` gives ACID / rollback on any error.

**Why default-visible relations are dangerous**: loading
`relations: { members: { user: true } }` pulls the FULL user rows — including
`password_hash` — into the JSON. `@Column({ select: false })` makes the hash
opt-IN, so joined responses physically cannot contain it.

**How @Roles works under the hood**: decorators are functions that *attach
metadata* (`SetMetadata`); `Reflector` retrieves it at request time; the guard
*acts*. Same metadata machinery Nest uses for `@Get`, `@Controller`, etc.

### How to reproduce later
1. `docker compose up -d`; `cd apps\api && npm run start:dev`.
2. Register + login; `POST /projects {"name":"..."}`; `POST
   /projects/:id/members {"userId":"...","role":"collaborator"}`.
3. Observe 403s for non-owners on PATCH/DELETE/member routes.

---

## Session 5 — Phase 9: Files inside projects

### Goal
`File` entity + CRUD nested under projects (`/projects/:id/files`), reusing
the existing `@Roles` + `RolesGuard` for RBAC (viewer read / collaborator
write / owner delete). Decisions taken with defaults after the interview was
skipped: **no versioning yet** (add history when diffing/review arrives) and
**path-string folders** (folders derived at read time, no folder entity).

### What was done, in order
1. `files/file.entity.ts` — uuid PK, `project_id` FK (CASCADE), `path`
   varchar(500), `content` TEXT, `created_by` FK, Created/UpdatedDate;
   `@Unique(['project_id','path'])`.
2. DTOs: `create-file` (path regex-validated, content string),
   `update-file` (content only).
3. `files.service.ts` — list (metadata only via `select`, content excluded),
   findOne (full content), create (project exists + 23505 -> 409),
   update (save, `@UpdateDateColumn` bumps `updated_at`), remove.
4. `files.controller.ts` — 5 routes, all under existing
   `@UseGuards(JwtAuthGuard, RolesGuard)`; GETs `@Roles(VIEWER)`,
   POST/PATCH `@Roles(COLLABORATOR)`, DELETE `@Roles(OWNER)`.
5. Wired into `app.module.ts` (File entity + FilesModule).

### Errors hit & the lesson each taught
1. **TS2307**: `file.entity.ts` imported `User` from `'./user.entity'` —
   wrong dir (file lives in `src/files/`, User in `src/users/`). Nested
   modules need `../users/...` relative imports.
2. **UnknownDependenciesException: RolesGuard can't resolve
   ProjectMemberRepository in FilesModule**: a guard is instantiated in the
   module that USES it, not the module that declares it. FilesModule had to
   add `ProjectMember` to its own `TypeOrmModule.forFeature([...])`. (In
   ProjectsModule it worked because the same guard + repo live there
   together.) First instance of the module-local injector gotcha.
3. Path regex v1 allowed leading slash + double slashes; tightened to
   `^[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*$`.

### Verified live (24/24 assertions)
- Collaborator creates `package.json` + `src/main.ts` (201, correct
  `created_by`); duplicate path 409; `/evil.ts` & `a//b.ts` 400.
- List returns metadata only (no content), both files, path-ordered.
- Viewer: GET file 200 + content; create/update/delete all 403.
- Collaborator: update 200 (content changed); delete 403.
- Outsider list 403; owner delete 200; list shrinks; deleted file 404.

### Interview notes
**Path-as-folder vs folder entities**: a string path is the minimal model —
sorting by path gives a valid tree, no trees/recursion/DB cycles. Cost: rename
= "move file", and "folder belongs to a file" conflicts (file `a` + file
`a/b`) need explicit rules. Upgrade to a folder entity only when drag-to-move
operations justify the complexity (YAGNI now).

**Why list strips content**: the file tree view should never pay to transfer
every file's body; an on-demand `GET /files/:id` fetches content only for the
open file. Pay-per-need, and it halves payloads.

**1GB TEXT vs blob**: code files are small; TEXT is plenty and keeps rows
readable/debuggable. Binary + blob + filesystem-level storage (S3 buckets) is
the later "import repo" feature.

**Guards are module-local**: `@UseGuards(SomeGuardClass)` makes Nest build the
guard inside the USING module's injector, so every module that uses RolesGuard
must provide ProjectMemberRepository. Shared guards across feature modules are
a strong signal for a shared `AuthzModule` (later refactor).

### How to reproduce later
1. `docker compose up -d`; `cd apps\api && npm run start:dev`.
2. Register/login; create project; add a collaborator + viewer.
3. As collaborator: `POST /projects/:id/files` then `PATCH /files/:fileId`.
4. As viewer: GET list + file; watch PATCH/DELETE return 403.

---

*Append future sessions below this line.*