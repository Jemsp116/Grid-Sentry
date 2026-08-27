# Feature Ticket List
## Project: Grid Sentry

**Version:** 1.0 (Draft)
**Author:** Jems
**Status:** Ready for build

Each ticket below is self-contained and written to be pasted directly into an AI coding tool as a task prompt. Tickets are ordered by dependency, not just by number.

---

### TICKET-000: Project Foundation & Infrastructure

**Priority:** Must-have for launch

**Description:**
Set up the base project skeleton: a Docker Compose stack with Postgres, OpenSearch, a Node/Express backend, a React frontend, and a Node worker service. Create the initial Postgres schema migration for `users` and `refresh_tokens` tables. Set up environment variable loading via `.env` files for each service.

**Acceptance Criteria:**
- `docker-compose up` starts Postgres, OpenSearch, backend, worker, and frontend containers successfully with no errors.
- Backend has a working health-check endpoint (`GET /api/health`) returning `200 OK`.
- Frontend loads a placeholder page and can successfully call the backend health-check endpoint.
- Postgres has `users` and `refresh_tokens` tables created via a migration script (not manually).
- `.env.example` files exist for backend, worker, and frontend with all required variables documented.

**Dependencies:** None — this is the first ticket.

---

### TICKET-001: User Authentication (JWT + Refresh Tokens)

**Priority:** Must-have for launch

**Description:**
Build email/password login using JWT access tokens (15-minute expiry) and refresh tokens (7-day expiry, stored hashed in the `refresh_tokens` table). Access tokens are returned to the client; refresh tokens are stored in an httpOnly cookie. Implement a refresh endpoint that issues a new access token if the refresh token is valid and not revoked. Implement logout, which revokes the refresh token.

**Acceptance Criteria:**
- `POST /api/auth/login` accepts email/password, returns an access token, and sets an httpOnly refresh token cookie on success.
- Incorrect credentials return a generic "Incorrect email or password" error — never reveal whether the email exists.
- `POST /api/auth/refresh` returns a new access token when given a valid, non-revoked refresh token cookie.
- `POST /api/auth/logout` revokes the refresh token in the database.
- Passwords are hashed with bcrypt (or equivalent) before storage — never stored in plain text.
- A suspended user (`is_active = false`) cannot log in and receives a clear "account suspended" message.

**Dependencies:** TICKET-000

---

### TICKET-002: Role-Based Access Control (RBAC) Middleware

**Priority:** Must-have for launch

**Description:**
Implement server-side middleware that checks a user's role (`viewer`, `analyst`, `admin`) against the permissions required for each route, before any route handler logic runs. Roles and their allowed actions should be defined in one central place (not scattered per-route) so permission logic stays auditable.

**Acceptance Criteria:**
- A shared permissions map exists defining which roles can access which route groups.
- Requests from a role without permission return `403 Forbidden` with a clear message, before any database query runs.
- Unit tests confirm: a Viewer cannot hit any rule-management, user-management, or audit-log route; an Analyst cannot hit rule-management or user-management routes; an Admin can hit everything.
- JWT payload includes the user's role and ID, verified on every authenticated request.

**Dependencies:** TICKET-001

---

### TICKET-003: Log Ingestion Pipeline (Vector → OpenSearch)

**Priority:** Must-have for launch

**Description:**
Configure a Vector (or Filebeat) log shipper to tail at least one real log source (start with SSH auth logs) and forward structured log events into OpenSearch. Create an OpenSearch index with a defined mapping for log fields (timestamp, source IP, event type, raw message, log source).

**Acceptance Criteria:**
- Vector config file successfully tails a log file and ships parsed events into OpenSearch.
- Log events appear in OpenSearch within a few seconds of being written to the source log file.
- Each log document has, at minimum: `timestamp`, `source_ip`, `log_source`, `raw_message`, and `event_type` fields.
- Ingestion can be verified via a direct OpenSearch query (no UI needed yet for this ticket).

**Dependencies:** TICKET-000

---

### TICKET-004: Log Search / Explorer (Feature 6)

**Priority:** Must-have for launch

**Description:**
Build a backend endpoint that proxies filtered search queries to OpenSearch (so the frontend never talks to OpenSearch directly), and a frontend screen where a user can search logs by keyword, time range, log source, and source IP, with a detail view for a single raw log entry.

**Acceptance Criteria:**
- `GET /api/logs/search` accepts query parameters (keyword, time range, log source, source IP) and returns matching log documents from OpenSearch, capped at 500 results per request with pagination.
- Frontend Log Explorer page renders a filterable, paginated results table.
- Clicking a log entry shows its full raw content in a detail panel.
- Viewer, Analyst, and Admin roles can all access this screen (per RBAC rules).
- Empty search results show a clear "no logs match these filters" state, not a blank screen.

**Dependencies:** TICKET-002, TICKET-003

---

### TICKET-005: Detection Rule Engine + Rule Management (Feature 5)

**Priority:** Must-have for launch

**Description:**
Create the `rules` table and a rule builder UI (Admin-only) that lets an Admin define a rule using a constrained set of fields, operators, and values (no free-text code or regex execution). Build a worker process that periodically evaluates active rules against new log events in OpenSearch and writes matches. Include a "dry run" mode that shows how many historical log entries would have matched a rule before it's activated.

**Acceptance Criteria:**
- `rules` table stores: name, description, log_source, match_conditions (JSON), threshold, time_window_seconds, severity, mitre_technique_id, action_on_trigger, is_active, created_by.
- Rule builder UI only allows selecting from a fixed list of fields/operators — no free-text query input.
- Server-side validation re-checks every submitted rule against the same fixed field/operator list, independent of frontend validation.
- Worker process evaluates active rules against new log events at a configurable poll interval and produces a match result when a rule's threshold/time-window condition is met.
- Dry-run mode runs a rule against the last N days of historical logs and returns a match count without creating any alerts.
- At least 2 working example rules exist and correctly fire against simulated attack traffic (e.g., repeated failed SSH logins).
- Only Admin role can access rule management screens (enforced server-side, per TICKET-002).

**Dependencies:** TICKET-002, TICKET-003, TICKET-004

---

### TICKET-006: Alert Feed + Alert Status Workflow (Features 1 & 3)

**Priority:** Must-have for launch

**Description:**
Create the `alerts` and `alert_notes` tables. When the rule engine (TICKET-005) finds a match, it writes a new row to `alerts`. Build the Alert Feed UI with severity/source/technique filters, an alert detail view showing the matched rule and underlying raw logs, and a status workflow (New → Investigating → Resolved / False Positive) with the ability to add notes.

**Acceptance Criteria:**
- `alerts` table stores rule_id, source_ip, target_host, severity (copied at trigger time), status, opensearch_log_ids, assigned_to, created_at.
- `alert_notes` table stores alert_id, user_id, note text, created_at — notes are append-only (no edit/delete).
- Alert Feed UI lists alerts with filters for severity, status, source IP, and MITRE technique.
- Clicking an alert shows full detail: matched rule, raw log content (fetched via TICKET-004's search endpoint using stored `opensearch_log_ids`), and its notes thread.
- Analyst and Admin roles can change alert status and add notes; Viewer role can only view.
- Status changes and new notes are reflected immediately in the UI without a full page reload.

**Dependencies:** TICKET-002, TICKET-005

---

### TICKET-007: Access Control — User Suspension & IP Blocklisting (Feature 8)

**Priority:** Must-have for launch

**Description:**
Build two related but distinct capabilities: (A) Admin-only ability to suspend/reactivate a user account, which immediately revokes all of that user's refresh tokens; (B) Analyst/Admin ability to add an IP to a blocklist, either manually or automatically as a rule action, stored in a new `ip_blocklist` table.

**Acceptance Criteria:**
- `PATCH /api/users/:id/suspend` (Admin only) sets `is_active = false`, records `suspended_reason` and `suspended_at`, and revokes all of that user's rows in `refresh_tokens`.
- A suspended user's next authenticated request fails immediately, even if their access token hasn't expired yet (checked via revocation status).
- System blocks suspending the last remaining active Admin account, and blocks an Admin from suspending their own account without an explicit confirmation step.
- `ip_blocklist` table stores ip_address, reason, triggered_by_rule_id (nullable), added_by (nullable), expires_at (nullable), created_at.
- Analyst/Admin can manually add an IP via the UI; rules with `action_on_trigger = alert_and_block_ip` automatically insert a blocklist entry when they fire.
- Blocklist UI shows all entries with a clear indicator of whether each was manually added or auto-triggered by a rule.
- Attempting to add an IP that's already blocked shows a friendly "already blocked" message, not an error.

**Dependencies:** TICKET-002, TICKET-005, TICKET-006

---

### TICKET-008: Overview Dashboard + Geo-IP Visualization (Features 2 & 9)

**Priority:** Must-have for launch

**Description:**
Build the landing dashboard summarizing system state: total events processed, alert counts by severity, a timeline chart of alert volume, and a top-10 attacker IP list. Add Geo-IP lookups (via a local MaxMind GeoLite2 database) to alert source IPs and render them on a map or list view, flagging high-risk regions.

**Acceptance Criteria:**
- `GET /api/dashboard/summary` returns event count, severity breakdown, alert volume time series, and top attacker IPs for a selectable time range.
- Overview page renders these as charts/counters, loading within a reasonable time even with a large alert history.
- GeoIP lookup resolves an IP to country/city using the local `.mmdb` file (no external API call per lookup).
- Geo-IP view shows alert source locations on a map or grouped list, with a visual flag for a configurable list of high-risk countries.
- All Overview dashboard content is visible to Viewer, Analyst, and Admin roles.

**Dependencies:** TICKET-006

---

### TICKET-009: Audit Log (Feature 7)

**Priority:** Must-have for launch

**Description:**
Create the `audit_log` table and a logging mechanism that records every meaningful state-changing action across the app (rule created/edited/disabled, user suspended/reactivated, alert status changed, IP blocked/unblocked). Build an Admin-only Audit Log viewer screen.

**Acceptance Criteria:**
- `audit_log` table stores user_id (nullable, for system actions), action, target_type, target_id, details (JSON), created_at.
- Every mutating action from TICKET-005, 006, and 007 writes a corresponding audit_log entry automatically (via shared middleware/utility, not duplicated per-route).
- Audit log entries persist even if the referenced rule/user/alert is later modified or deactivated.
- Audit Log viewer UI is Admin-only (enforced server-side) and supports filtering by action type, user, and date range.

**Dependencies:** TICKET-002, TICKET-005, TICKET-006, TICKET-007

---

### TICKET-010: MITRE ATT&CK Matrix View

**Priority:** Should-have

**Description:**
Add a dashboard view showing a heatmap of MITRE ATT&CK techniques detected across historical alerts, based on the `mitre_technique_id` field already stored on rules/alerts.

**Acceptance Criteria:**
- A new page renders a grid/matrix of MITRE tactics and techniques.
- Cells are shaded by frequency of matching alerts in a selectable time range.
- Clicking a technique cell filters the Alert Feed to alerts matching that technique.

**Dependencies:** TICKET-006, TICKET-008

---

### TICKET-011: Threat Intelligence Enrichment (AbuseIPDB / OTX)

**Priority:** Should-have

**Description:**
On viewing an alert's detail page, enrich the source IP with data from AbuseIPDB and/or AlienVault OTX (abuse confidence score, report count, known threat campaign associations). Cache results per IP to respect API rate limits.

**Acceptance Criteria:**
- Alert detail view shows an enrichment panel with abuse score and report history, fetched on demand (not pre-fetched for every alert).
- Results are cached (e.g., in Postgres or Redis) for a configurable period so the same IP isn't re-queried excessively.
- If the third-party service is unreachable or rate-limited, the alert detail page still loads fully, with the enrichment panel showing "Enrichment unavailable" rather than blocking the page.
- API keys are read from environment variables, never hardcoded.

**Dependencies:** TICKET-006

---

### TICKET-012: Email & Slack Critical Alert Notifications

**Priority:** Should-have

**Description:**
When a rule with `severity = critical` fires, send a notification via Slack (incoming webhook) and email (via a transactional email provider) to configured recipients, containing the alert summary and a link back to the dashboard.

**Acceptance Criteria:**
- Slack webhook receives a message within a few seconds of a critical alert being created, containing severity, source IP, rule name, and a link to the alert.
- Email is sent to configured recipient(s) with the same information.
- A failure in either notification channel is logged but does not prevent the alert itself from being created or displayed on the dashboard.
- Notification recipients and webhook URL are configurable via environment variables or an admin settings screen.

**Dependencies:** TICKET-006

---

### TICKET-013: Report Export & Dark-Mode Theming Polish

**Priority:** Nice-to-have

**Description:**
Add the ability to export a filtered set of alerts as PDF or CSV for a given date range, and finalize the dark-mode SOC theme (per the Frontend Specification Document's design system) across every screen.

**Acceptance Criteria:**
- Export button on the Alert Feed generates a CSV and/or PDF containing the currently filtered alert list.
- Exported file includes alert ID, severity, status, source IP, rule name, and timestamps.
- Every screen in the app (Overview, Alert Feed, Log Explorer, Rule Management, Blocklist, Audit Log) consistently uses the color palette, typography, and component styles defined in the Frontend Specification Document — no screen left on default/unstyled components.

**Dependencies:** TICKET-006, TICKET-008
