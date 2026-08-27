# Technical Architecture Document
## Project: SOC Log Analysis & Detection Dashboard

**Version:** 1.0 (Draft)
**Author:** Jems
**Status:** Pre-development

---

## 1. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Log shipping | **Vector** (or Filebeat) | Lightweight agent that tails log files/syslog and forwards structured events. Vector is Rust-based, low resource overhead, and configuration is declarative (TOML), which is easier to version-control than Logstash pipelines. |
| Log storage/search | **OpenSearch** | Purpose-built for storing and querying huge volumes of semi-structured log data fast. Open-source fork of Elasticsearch (no licensing cost), and it's the same query/aggregation model used by real SIEM tools, so the skills transfer directly to SOC analyst roles. |
| Application database | **PostgreSQL** | Stores structured relational data that OpenSearch is a poor fit for: users, roles, rules, alerts (metadata), audit log, blocklist. Needs real transactions and foreign keys (e.g., "this alert belongs to this rule belongs to this user") — a relational DB is the right tool, not a document store. |
| Backend API | **Node.js + Express** | Matches your existing experience (Sentinel IDS was built on this stack), so you can move fast and reuse patterns (middleware, auth). Express is simple enough to reason about every request path, which matters for a security tool where you want to audit exactly what each endpoint does. |
| Detection/rule engine | **Node worker process** (separate from the API process) | Evaluating rules against a continuous log stream is a different workload than serving HTTP requests — running it as a separate process means a slow or stuck rule evaluation never blocks the dashboard from responding. Communicates with the API via Postgres (writes alerts) and reads from OpenSearch. |
| Frontend | **React** | Needed because the RBAC-gated rule builder, blocking actions, and alert workflow are custom interactions that a pre-built tool (Kibana/OpenSearch Dashboards) doesn't offer out of the box. |
| Auth | **JWT (access + refresh token pair)**, stored in httpOnly cookies | Stateless auth scales simply, and httpOnly cookies avoid exposing tokens to XSS. Session "kill on suspend" is handled with a short-lived access token + a server-side refresh-token revocation list in Postgres (see schema below). |
| Containerization | **Docker Compose** | You already have Docker experience from SCRB; Compose lets you spin up OpenSearch + Postgres + API + worker + frontend as one reproducible stack — essential for demoing this project to interviewers. |
| Reverse proxy (optional but recommended) | **Nginx** | Terminates TLS, routes `/api` to Express and everything else to the React build, and is a realistic piece of infrastructure to include in a demo. |

---

## 2. Project File & Folder Structure

```
soc-dashboard/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js                  # Express app entrypoint
│   │   ├── config/
│   │   │   ├── db.js                 # Postgres connection pool
│   │   │   └── opensearch.js         # OpenSearch client setup
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT verification
│   │   │   ├── rbac.js               # permission-checking middleware
│   │   │   └── auditLogger.js        # writes to audit_log on mutating routes
│   │   ├── routes/
│   │   │   ├── auth.routes.js        # login, refresh, logout
│   │   │   ├── users.routes.js       # user management, suspension
│   │   │   ├── rules.routes.js       # rule CRUD, dry-run
│   │   │   ├── alerts.routes.js      # alert list, status updates, notes
│   │   │   ├── logs.routes.js        # log search proxy to OpenSearch
│   │   │   ├── blocklist.routes.js   # IP blocklist CRUD
│   │   │   └── audit.routes.js       # audit log viewer
│   │   ├── controllers/              # one file per route group, business logic
│   │   ├── models/                   # Postgres query functions per table
│   │   └── utils/
│   │       ├── geoip.js
│   │       └── ruleCompiler.js       # converts stored rule JSON → OpenSearch query
│   └── Dockerfile
│
├── worker/
│   ├── package.json
│   ├── src/
│   │   ├── index.js                  # polling/streaming loop
│   │   ├── ruleEvaluator.js          # runs active rules against new log events
│   │   └── actions/
│   │       ├── createAlert.js
│   │       └── autoBlockIp.js
│   └── Dockerfile
│
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Overview.jsx
│   │   │   ├── AlertFeed.jsx
│   │   │   ├── AlertDetail.jsx
│   │   │   ├── LogExplorer.jsx
│   │   │   ├── RuleManagement.jsx
│   │   │   ├── Blocklist.jsx
│   │   │   ├── UserManagement.jsx
│   │   │   ├── AuditLog.jsx
│   │   │   └── GeoMap.jsx
│   │   ├── components/               # shared UI: tables, filters, badges, modals
│   │   ├── context/AuthContext.jsx   # holds current user + role, gates UI elements
│   │   └── api/                      # fetch wrappers per resource
│   └── Dockerfile
│
├── ingestion/
│   └── vector.toml                   # log shipper config
│
└── docs/
    ├── PRD.md
    ├── architecture.md               # this document
    └── rules-schema.md
```

---

## 3. Database Schema (PostgreSQL)

All tables below live in the application Postgres database. Raw log content itself is **not** stored here — it lives in OpenSearch; Postgres only stores structured metadata that needs relationships and transactions.

### `users`
Stores every person who can log into the dashboard.
- `id` (PK)
- `email` (unique)
- `password_hash`
- `role` — one of `viewer`, `analyst`, `admin`
- `is_active` — boolean; set to `false` when suspended
- `suspended_reason` — text, nullable
- `suspended_at` — timestamp, nullable
- `created_at`

**Relationship:** A user can create many rules, resolve many alerts, and generate many audit log entries — but a user is never deleted, only deactivated, so history stays intact.

### `refresh_tokens`
Tracks issued refresh tokens so a suspended user's sessions can be killed immediately, not just at token expiry.
- `id` (PK)
- `user_id` (FK → `users.id`)
- `token_hash`
- `revoked` — boolean
- `expires_at`
- `created_at`

**Relationship:** Many refresh tokens belong to one user. On suspension, all of that user's tokens get `revoked = true`.

### `rules`
Stores admin-created detection rules (the "rule builder" output).
- `id` (PK)
- `name`
- `description`
- `log_source` — e.g. `ssh_auth`, `nginx_access`
- `match_conditions` — JSONB: array of `{field, operator, value}`
- `threshold` — integer (e.g., "5 occurrences")
- `time_window_seconds` — integer (e.g., 60)
- `severity` — `low` / `medium` / `high` / `critical`
- `mitre_technique_id` — text, nullable (e.g., `T1110`)
- `action_on_trigger` — `alert_only` or `alert_and_block_ip`
- `is_active` — boolean
- `created_by` (FK → `users.id`)
- `created_at`, `updated_at`

**Relationship:** One rule can trigger many alerts. One user (an Admin) creates many rules.

### `alerts`
Stores every time a rule fires.
- `id` (PK)
- `rule_id` (FK → `rules.id`)
- `source_ip`
- `target_host`, nullable
- `severity` — copied from the rule at trigger time (so it doesn't change retroactively if the rule is edited later)
- `status` — `new`, `investigating`, `resolved`, `false_positive`
- `opensearch_log_ids` — JSONB array of the underlying log document IDs in OpenSearch, so the UI can fetch raw log content on demand
- `assigned_to` (FK → `users.id`, nullable)
- `created_at`

**Relationship:** Many alerts belong to one rule. Many alerts can be assigned to one analyst.

### `alert_notes`
Analyst comments/notes on an alert during investigation.
- `id` (PK)
- `alert_id` (FK → `alerts.id`)
- `user_id` (FK → `users.id`)
- `note` — text
- `created_at`

**Relationship:** Many notes belong to one alert; many notes are written by one user.

### `ip_blocklist`
External IPs blocked because of malicious activity.
- `id` (PK)
- `ip_address`
- `reason`
- `triggered_by_rule_id` (FK → `rules.id`, nullable — null if manually added)
- `added_by` (FK → `users.id`, nullable — null if auto-added by the rule engine)
- `expires_at` — nullable, for temporary blocks
- `created_at`

**Relationship:** An entry is optionally linked to the rule that triggered it and/or the admin who added it manually.

### `audit_log`
Records every meaningful state-changing action for compliance/accountability.
- `id` (PK)
- `user_id` (FK → `users.id`, nullable — null if system-triggered)
- `action` — e.g. `rule_created`, `rule_disabled`, `user_suspended`, `ip_blocked`, `alert_status_changed`
- `target_type` — e.g. `rule`, `user`, `alert`, `ip_blocklist`
- `target_id` — the ID of the affected row
- `details` — JSONB, free-form context (e.g., old value → new value)
- `created_at`

**Relationship:** Every other table's mutations are mirrored here as a log entry, but audit_log has no foreign key constraints enforced back onto those tables (it must survive even if the original row is later deleted).

### Entity relationship summary (plain English)
- A **user** has one role and can be suspended.
- A **user** (if Admin) creates **rules**.
- A **rule**, when triggered by the worker, creates an **alert**, and optionally adds an entry to the **ip_blocklist**.
- An **alert** can have many **alert_notes** written by analysts, and is eventually resolved.
- Every meaningful action across all of the above is mirrored into **audit_log**.
- **refresh_tokens** exist purely to let you forcibly log out a user the moment they're suspended.

---

## 4. Environment Variables & Configuration Notes

### Backend (`backend/.env`)
```
# Postgres
DATABASE_URL=postgres://user:password@postgres:5432/soc_dashboard

# OpenSearch
OPENSEARCH_NODE=http://opensearch:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=changeme

# Auth
JWT_ACCESS_SECRET=<generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate with a different random value>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# GeoIP
GEOIP_DB_PATH=./data/GeoLite2-City.mmdb

# App
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

### Worker (`worker/.env`)
```
DATABASE_URL=postgres://user:password@postgres:5432/soc_dashboard
OPENSEARCH_NODE=http://opensearch:9200
POLL_INTERVAL_MS=5000
```

### Frontend (`frontend/.env`)
```
VITE_API_BASE_URL=http://localhost:4000/api
```

### Config notes to be aware of before building
- **Never commit `.env` files** — only `.env.example` with placeholder values goes into the repo.
- **JWT secrets must be different for access vs refresh tokens** — if they're the same, a leaked access token could be used to mint new refresh tokens.
- **OpenSearch runs in single-node mode for this project** — its default Docker image expects a minimum memory allocation (`OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m` is a reasonable dev setting); without this it can fail to start on lower-memory machines.
- **GeoIP database (MaxMind GeoLite2) requires a free account to download** — it is not bundled and must be fetched separately before first run; check current MaxMind license terms before redistributing it in any public repo.
- **The rule engine's `match_conditions` JSONB must never accept raw code or regex from the UI without validation** — always validate against a fixed enum of allowed fields/operators server-side before compiling to an OpenSearch query, even though the frontend already constrains the rule builder UI (never trust client-side validation alone).
- **Session revocation check adds a DB read on every authenticated request** (checking `refresh_tokens.revoked`) — acceptable at this project's scale, but worth knowing this is the tradeoff for being able to instantly kill a suspended user's access.
