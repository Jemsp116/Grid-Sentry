# Grid Sentry

*A watchman for your infrastructure's data grid.*

Grid Sentry is an enterprise **Security Operations Center (SOC) Log Ingestion & Threat Detection System**.
It ingests security logs from infrastructure honeypots and external applications, detects
malicious activity with custom rules, triages alerts, and responds by suspending
compromised accounts or blocking attacker IPs.

> **Build status:** MongoDB Migration, BYODB & Per-Source Operations complete — **TICKET-000 → 017**
> (infrastructure, MongoDB 7.0 + Mongoose metadata engine, JWT auth + refresh/revocation, server-side RBAC, log
> ingestion via API & OpenSearch SIEM storage, dual-mode Log Explorer with private BYODB raw telemetry, detection rule engine,
> Alert Feed & triage workflow, user suspension, IP blocklisting, Overview
> dashboard & Geo-IP visualization, audit log, MITRE ATT&CK matrix, threat intel enrichment, Slack/email notifications, CSV/JSON report export, external log ingestion API & universal client SDKs, Bring-Your-Own-Database (BYODB) MongoDB connections, and Per-Source Operations Dashboard).
>
> 📖 **Architecture & Storage Maps:** See [`docs/STORAGE_ARCHITECTURE.md`](docs/STORAGE_ARCHITECTURE.md) for a comprehensive inventory of all databases, collections, files, and secrets across the app.

---

## Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Backend API** | Node 22 · Express · TypeScript | REST API with JWT auth, server-side RBAC, Zod validation, and dynamic SDK script serving |
| **Detection Worker** | Node 22 · TypeScript | Rule evaluation engine, alert generator & auto-blocking worker |
| **Frontend** | React 18 · Vite · TypeScript · Tailwind | Dark-mode SOC Dashboard UI with Recharts, Geo-IP Threat Maps, and SourceSelector |
| **Client SDKs** | Universal JS (`/api/sdk/gridsentry.js`), ESM, Node.js, Python, Go, PHP | Installable & drop-in telemetry collectors for web apps, services, and log shippers |
| **Primary Database** | **MongoDB 7.0 (Mongoose ODM)** | Structural storage (`organizations`, `users`, `refresh_tokens`, `rules`, `alerts`, `ip_blocklist`, `audit_log`, `api_keys`, `tenant_databases`) |
| **Tenant Storage (BYODB)**| Customer MongoDB Instance | Dedicated private database storing raw website logs (`source_logs`) via AES-256-GCM encrypted link |
| **SIEM Log Storage** | OpenSearch 2.15 | High-volume log search, indexing, & aggregation engine |
| **Container Orchestration**| Docker Compose | Single command multi-container environment |


---

## Quick Start (Docker)

```bash
# 1. Start the complete container stack (MongoDB, OpenSearch, Backend, Worker, Frontend, SSH Target)
docker compose up --build

# 2. Seed the initial admin user into MongoDB
docker compose exec backend npm run seed:admin

# 3. (Optional) Run brute-force attack simulation to generate live detection alerts
docker compose --profile attack up attacker
```

### Access Endpoints
- **SOC Dashboard UI:** http://localhost:3000
- **Backend REST API:** http://localhost:4000/api
- **OpenSearch SIEM:** http://localhost:9200
- **MongoDB Database:** localhost:27017

**Default Admin Credentials:**
- **Email:** `admin@gridsentry.local`
- **Password:** `GridSentryAdmin#2026`

---

## Comprehensive Step-by-Step Manual Testing Guide

Follow this walkthrough to test every feature of Grid Sentry end-to-end:

### 1. Authentication & RBAC (`/login`)
1. Open http://localhost:3000 in your browser.
2. Sign in using the seeded Admin credentials (`admin@gridsentry.local` / `GridSentryAdmin#2026`).
3. Verify that the 15-minute JWT access token and 7-day httpOnly refresh cookie (`gs_refresh`) are issued.
4. Test invalid login attempts to confirm generic non-enumerating error messages (`"Incorrect email or password"`).

### 2. Overview Dashboard (`/`)
1. View the **Overview** dashboard displaying 4 real-time KPI metrics: Total Logs Processed, Active Alerts, Blocked IPs, and System Status.
2. Inspect the **Alerts Time-Series Chart** rendering hourly volume grouped by severity (`critical`, `high`, `medium`, `low`).
3. Explore the **Interactive Geo-IP Threat Distribution Map** rendering source IP geographic coordinates, risk levels, and country counts.

### 3. Log Explorer & SIEM Querying (`/logs`)
1. Navigate to **Log Explorer** in the sidebar.
2. Enter keyword search queries (e.g. `Failed password`, `Invalid user`, `sshd`) or filter by outcome (`success` / `failure`).
3. Click any log entry row to open the **Raw Document Drawer** showing full OpenSearch JSON metadata.

### 4. Detection Rule Engine (`/rules`)
1. Navigate to **Rule Management**.
2. Inspect default pre-configured rules (`SSH Brute Force`, `SSH Invalid User Login`).
3. Toggle rule active states on/off using the interactive switches.
4. Click **"Create New Rule"** to build a rule with custom DSL match conditions (field, operator, value), threshold, lookback window, severity, MITRE Technique ID (`T1110`), and action (`alert_and_block_ip`).

### 5. Live Attack Simulation & Alert Generation
1. In your terminal, launch the Hydra attack simulation container:
   ```bash
   docker compose --profile attack up attacker
   ```
2. The `attacker` container will fire brute-force SSH login attempts against the `ssh-target` honeypot container.
3. The background detection worker (`worker`) will evaluate OpenSearch logs every 5 seconds, match the rule thresholds, and auto-generate **Alerts** and **IP Blocklist** entries!

### 6. Alert Feed & Report Export (`/alerts`)
1. Navigate to **Alert Feed**.
2. Filter alerts by Severity (`critical`, `high`, `medium`, `low`), Status (`new`, `investigating`, `resolved`, `false_positive`), or Source IP.
3. Click **"Export CSV"** or **"Export JSON"** toolbar action buttons to download RFC-compliant threat reports with preserved active filters.

### 7. Threat Intelligence & Incident Investigation (`/alerts/:id`)
1. Click any alert row to open the **Alert Detail Page**.
2. Inspect the **Threat Intelligence Enrichment Panel** showing the Abuse Confidence Score (0–100%), total reports, ISP, usage type, country, and risk level.
3. Review the **Raw Evidence Logs** that triggered the detection.
4. Use the **Notes Thread** to post investigation updates with timestamped analyst credit.
5. Change alert status from `new` to `investigating` or `resolved`.

### 8. IP Blocklist Response (`/blocklist`)
1. Navigate to **IP Blocklist**.
2. Verify IPs auto-blocked by the detection worker (`SSH Brute Force`) appear in the list with `rule` type badges.
3. Manually add an IP address to the blocklist with a custom reason and optional expiration date.
4. Click **"Unblock"** to remove an IP from the blocklist.

### 9. User Administration & Account Suspension (`/users`)
1. Navigate to **User Management** (Admin role required).
2. Inspect the user accounts list (`admin`, `analyst`, `viewer`).
3. Test updating a user's role or clicking **"Suspend"** to deactivate an account with a mandatory reason.
4. Verify that suspended users have all active JWT sessions immediately revoked and cannot log in.

### 10. Immutable Audit Log (`/audit`)
1. Navigate to **Audit Log**.
2. Review the chronological audit trail of all security actions (`auth.login_success`, `rule.created`, `alert.status_updated`, `blocklist.ip_added`, `user.suspended`).
3. Click any entry to inspect raw audit JSON details.

### 11. MITRE ATT&CK Matrix View (`/mitre`)
1. Navigate to **MITRE Matrix**.
2. Explore the Enterprise ATT&CK framework grid mapping tactics (*Initial Access, Execution, Persistence, Privilege Escalation, Credential Access, Discovery, Lateral Movement*).
3. View frequency-shaded technique cards (`T1110 Brute Force`, `T1078 Valid Accounts`).
4. Click any technique card to drill-down directly to matching alerts in the Alert Feed (`/alerts?mitreId=T1110`).

### 12. External Client SDK Ingestion (`grid-sentry-client`)
1. Test sending custom security events to Grid Sentry using the standalone Node.js SDK:
   ```typescript
   import { gridSentry } from 'grid-sentry-client';

   gridSentry.init({
     baseUrl: 'http://localhost:4000',
     apiKey: 'gs_live_secret_key_2026',
   });

   gridSentry.log('user_login_failed', {
     source_ip: '198.51.100.44',
     user_identifier: 'admin@corp.internal',
     raw_message: 'Failed login attempt from external service',
   });
   ```
2. Verify that events sent via the SDK arrive at `${baseUrl}/api/logs/ingest` and appear in the Log Explorer (`/logs`).

### 13. Connecting a Website or External Project (`/connected-sources`)
1. In the sidebar, navigate to **Connected Sources** or click **"+ Connect a Project"** in the Overview header.
2. Enter a project name (e.g. `web-portal`) and select your integration method:
   - **Code SDK**: Copy the instant drop-in snippet for Next.js, Node.js, Python, Go, PHP, or HTML `<script>`.
   - **Log Shipper**: Run the one-line automated PowerShell or Bash installer.
3. The wizard will automatically listen for incoming events and mark the project connected upon initial handshake!

### 14. Per-Source Scoped Operations & Dual-Mode Log Explorer
1. In the top-right of **Overview**, **Alert Feed**, or **Log Explorer**, click the **Source Selector** dropdown.
2. Select your connected project:
   - **Overview Dashboard**: Displays a dedicated Per-Source Stats Card with live connection status, total events, first seen, and last telemetry time.
   - **Alert Feed**: Scopes the alert feed to alerts generated from that specific source via detection rule resolution.
   - **Log Explorer**: Automatically activates **Mode B (Raw Website Logs)**, fetching real raw events from your private MongoDB (`/logs/tenant-source-logs`) with color-coded event type badges (`page_view`, `user_login_success`, `error`), source IP, user identifier, and expandable JSON details drawer!
3. Switch back to **"All Sources"** at any time to return to global SIEM OpenSearch queries.

---


## Automated Verification Suite

Run all component typechecks and unit tests locally:

```bash
# Backend TypeScript & API checks
cd backend && npx tsc --noEmit

# Worker Detection Engine checks
cd worker && npx tsc --noEmit

# Frontend Production Build
cd frontend && npm run build

# Client SDK Package Build & Test Suite
cd grid-sentry-client && npm run build && npm test
```

---

## Clean Project Directory Structure

```
Grid Sentry/
├── docker-compose.yml           # Root multi-container orchestration (MongoDB, OpenSearch, Backend, Worker, Frontend, SSH Target, Attacker)
├── ingestion/                   # Honeypot log ingestion environment
│   ├── ssh-target/              # Containerized SSH honeypot target
│   ├── attacker/                # Hydra brute-force simulation container
│   └── opensearch/              # OpenSearch index template & field mappings
├── backend/                     # Express + TypeScript REST API
│   └── src/
│       ├── auth/                # Central RBAC permissions matrix
│       ├── config/              # Environment validation & Mongoose schemas (mongoSchemas.ts)
│       ├── controllers/         # API endpoints (alerts, rules, users, blocklist, dashboard, audit, mitre)
│       ├── middleware/          # JWT auth, RBAC guards & error handling
│       ├── models/              # Mongoose data access models (users, refreshTokens, rules, alerts, blocklist, dashboard, audit, mitre)
│       ├── routes/              # Express API routes (including POST /api/logs/ingest)
│       ├── utils/               # Geo-IP lookup engine, Threat Intel service, Audit Logger, MITRE catalog, Notification dispatcher
│       └── scripts/             # Admin account seed script (npm run seed:admin)
├── worker/                      # Detection & Auto-Blocking Rule Engine
│   └── src/
│       ├── index.ts             # Polling loop
│       ├── ruleEvaluator.ts     # Active rule detection & alert trigger engine
│       └── ruleCompiler.ts      # Rule DSL-to-OpenSearch query compiler
├── frontend/                    # React + TypeScript + Vite + Tailwind CSS
│   └── src/
│       ├── api/                 # Typed API clients for backend endpoints
│       ├── components/          # AppShell sidebar & pagination
│       ├── context/             # AuthContext JWT token management & silent refresh
│       └── pages/               # 9 SOC Dashboard views (Overview, AlertFeed, AlertDetail, LogExplorer, RuleManagement, IPBlocklist, UserManagement, AuditLog, MitreMatrix)
├── grid-sentry-client/           # Standalone installable Node.js SDK package
│   ├── src/                     # SDK source code (gridSentryClient.ts, index.ts)
│   ├── src/__tests__/           # Vitest unit test suite (5/5 pass)
│   └── README.md                # SDK documentation & server-side usage warning
├── docs/                        # 5 Canonical Grid Sentry Specification Documents
└── BIN/                         # Archive directory containing legacy drafts, moved test cases, and relocated configs
```