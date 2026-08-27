# Grid Sentry — Working Memory / Context

> Handoff context for continuing this project in a fresh session. Read this
> first. It captures decisions, current status, how to run, and what's next —
> everything not obvious from the code alone.
>
> _Last updated: 2026-08-27 (after TICKET-000 → 002)._

---

## 1. What this is

Grid Sentry is a **self-hosted SOC (Security Operations Center) dashboard** —
ingest logs → detect malicious activity with custom rules → triage alerts →
respond (suspend accounts / block IPs). It's a **portfolio/demo project**
targeting SOC-analyst roles, so realism matters more than shortcuts.

Full spec lives in [`docs/`](docs/): PRD, Technical Architecture, Security &
Access, Frontend Spec, and Feature Tickets (TICKET-000 → 013).

## 2. Locked decisions (agreed with the user 2026-08-27)

| Decision | Choice | Notes |
|---|---|---|
| **Language** | **TypeScript** | Spec's folder tree showed `.js/.jsx`; we upgraded. |
| **Frontend** | **Tailwind + Recharts + react-simple-maps** | Tokens in `frontend/tailwind.config.js`. Recharts/maps deferred to TICKET-008 (not installed yet). |
| **Demo log source** | **Real sshd + Hydra in Docker** | Bundled `ssh-target` container; Vector tails its auth log. Compose stubs commented until TICKET-003. |
| **Build scope** | **TICKET-000 → 002 first** | Infra + auth + RBAC. Done. |

## 3. Current status — DONE: TICKET-000, 001, 002

- **000 Foundation** — Docker Compose (postgres, opensearch, backend, worker,
  frontend) at repo root; schema migration `db/migrations/001_init.sql` (all 7
  tables, auto-applied on first Postgres start); per-service `.env.example`;
  `GET /api/health`.
- **001 Auth** — bcrypt login; 15-min access JWT + 7-day refresh token (SHA-256
  hashed in PG, httpOnly cookie); `/auth/refresh`, `/auth/logout`, `/auth/me`;
  generic credential errors (no user enumeration); suspended-account block.
- **002 RBAC** — central permissions map + `requirePermission` guard (403
  before any handler). See design note below.

**Verification (all green, offline — no Docker needed):**
`backend` tsc clean · **19/19 Vitest pass** · `worker` tsc clean ·
`frontend` tsc + vite build clean · `docker compose config` valid.

## 4. Key design choices to preserve

- **Instant session kill / role change:** the access token carries `sid` (the
  `refresh_tokens` row id). Every authenticated request re-reads
  `revoked / expires_at / is_active / role` from Postgres via
  `getSessionStatus(sid)`. So suspensions and role changes take effect on the
  **next request**, not at token expiry. (Security doc edge cases 3 & 10.)
- **Permissions are centralized** in `backend/src/auth/permissions.ts` — the
  single source of truth. Never hardcode role checks in routes; declare a
  `Permission` and use `requirePermission`.
- **Access token in memory only** on the frontend (never localStorage); refresh
  token is the httpOnly cookie. `AuthContext` silently refreshes on load + on 401.

## 5. Deviations from the original docs (deliberate — keep them)

1. Built in **TypeScript** (docs showed JS).
2. **`audit_log.user_id` FK removed** — audit entries must survive row changes
   (Technical Architecture §3); a FK would block that.
3. **Admin seed moved out of SQL** into `npm run seed:admin` (env-driven) so no
   password hash is ever committed.
4. **Vector path** → bundled `ssh-target` container's log, not host
   `/var/log/auth.log` (doesn't exist on Windows/Mac).
5. **"New Country Login" sample rule is misleading** — as written it fires on
   every successful login (`threshold:1` + "Accepted password"). Real
   unseen-country detection needs stateful geo-history the DSL lacks. Revisit at
   TICKET-005.

## 6. How to run

```bash
docker-compose up --build                          # start full stack
docker-compose exec backend npm run seed:admin     # seed admin (reads backend/.env)
```

- Frontend http://localhost:3000 · API http://localhost:4000/api ·
  OpenSearch http://localhost:9200 · Postgres localhost:5432
- **Login:** `admin@gridsentry.local` / password in `backend/.env`
  (`ADMIN_PASSWORD`, currently `-5oywtxZ4F7NkTVd`).
- Local dev per service: `cd <svc> && npm install && npm run dev`.
- Tests: `cd backend && npm test`.

## 7. Secrets

`.env`, `backend/.env`, `worker/.env`, `frontend/.env` are **git-ignored** and
already contain generated dev secrets (stack runs out of the box). Only
`.env.example` templates are committed. Before any non-local use: rotate all
secrets, change the admin password, set `COOKIE_SECURE=true` (needs TLS).

## 8. Environment on this machine

- Node 24.16, npm 10.8, Docker 28.1 + Compose v2.35 (**engine was NOT running —
  must start Docker Desktop to run the stack**), git 2.49, WSL2 Ubuntu present.
- MaxMind GeoLite2 key **not yet provided** — needed only for TICKET-008 geo-IP.

## 9. Pending (needs user's OK — do NOT do unprompted)

- **Delete duplicate docs:** `docs/SOC_Dashboard_*.md` (5 files, identical to
  `Grid_Sentry_*` except line-2 title) and the superseded `docs/001_init.sql`,
  `docs/docker-compose.yml`, `docs/vector.toml`, `docs/sample_rules.json`.
- **No git commit yet** — `git init` was run; committing is the user's call.

## 10. Next up (in dependency order)

- **TICKET-003** — Vector → OpenSearch ingestion (+ `ssh-target` & attacker
  containers; uncomment the compose stubs). Index mapping: `timestamp`,
  `source_ip`, `log_source`, `raw_message`, `event_type`.
- **004** Log search/explorer → **005** rule engine + worker (fills the worker
  skeleton in `worker/src/index.ts`) → **006** alerts → **007** suspend/block →
  **008** dashboard + geo-IP → **009** audit log. Then V2: 010–013.

## 11. File map (built so far)

```
docker-compose.yml            # 5 services; ingestion stubs commented (TICKET-003)
db/migrations/001_init.sql    # full schema, 4 enums, indexes (no admin insert)
ingestion/vector.toml         # ssh auth -> OpenSearch
backend/src/
  app.ts, index.ts            # Express app factory + listener
  config/{env,db,opensearch,logger}.ts
  auth/permissions.ts         # ROLE_PERMISSIONS — RBAC source of truth
  middleware/{auth,rbac,errorHandler}.ts
  routes/{auth,health,protected.demo}.routes.ts
  controllers/auth.controller.ts
  models/{users,refreshTokens}.model.ts
  utils/{tokens,password,ApiError}.ts
  scripts/seedAdmin.ts
  __tests__/*.test.ts         # permissions, rbac, tokens, password (19 tests)
worker/src/index.ts           # detection loop skeleton (heartbeat only)
frontend/src/
  context/AuthContext.tsx     # token mgmt + silent refresh
  pages/{Login,Overview}.tsx  # Overview live-probes the RBAC matrix
  tailwind.config.js          # design tokens (severity palette, Plex fonts)
```

---

_Note: Claude Code auto-loads `CLAUDE.md` (not `MEMORY.md`) as project context
each session. If you want this loaded automatically every time, say so and I'll
add a `CLAUDE.md` that points here (or rename this file)._
