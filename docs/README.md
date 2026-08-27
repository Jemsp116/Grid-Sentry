# Grid Sentry

*A watchman for your infrastructure's data grid.*

A self-hosted Security Operations Center dashboard: ingest logs, detect malicious
activity with custom rules, triage alerts, and respond by suspending compromised
accounts or blocking attacker IPs.

## Planning documents

Read these in order before writing code — each builds on the last:

1. `Grid_Sentry_PRD.md` — what the app does, who it's for, feature list, MVP definition
2. `Grid_Sentry_Technical_Architecture.md` — stack choices, folder structure, full DB schema
3. `Grid_Sentry_Security_and_Access.md` — auth model, roles/permissions, error handling, edge cases
4. `Grid_Sentry_Frontend_Specification.md` — design system, component styles, third-party API specs
5. `Grid_Sentry_Feature_Tickets.md` — buildable tickets in dependency order, ready to hand to an AI coding tool

## Quick start

```bash
# 1. Copy environment templates
cp .env.example .env
cp .env.example backend/.env
cp .env.example worker/.env
cp .env.example frontend/.env

# 2. Generate real secrets before running anything beyond local testing
openssl rand -hex 32   # use for JWT_ACCESS_SECRET
openssl rand -hex 32   # use for JWT_REFRESH_SECRET (must be different)

# 3. Start the full stack
docker-compose up --build

# 4. Run the initial database migration (applied automatically on first
#    Postgres container start via db/migrations — see docker-compose.yml)

# 5. Seed example detection rules (once the backend is running)
#    See db/seed/sample_rules.json — load via the rule management API
#    or a seed script once TICKET-005 is built.
```

Services once running:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- OpenSearch: http://localhost:9200
- Postgres: localhost:5432

## Build order

Follow `Grid_Sentry_Feature_Tickets.md` in order — each ticket lists its dependencies.
Rough sequence: infra/auth/RBAC → log ingestion → log search → rule engine →
alerts → access control (suspend/block) → dashboard/geo-IP → audit log →
(Version 2) MITRE matrix, threat intel enrichment, notifications, export/theming.

## Before you deploy anywhere beyond your own machine

- Replace every placeholder secret in `.env` files — never commit real secrets.
- Replace the seed admin account's password hash in `db/migrations/001_init.sql`.
- Download a MaxMind GeoLite2 database (free account required) for Geo-IP lookups.
- Review `Grid_Sentry_Security_and_Access.md` section 5 (Edge Cases) before considering this launch-ready.
