# Frontend Specification Document
## Project: Grid Sentry

**Version:** 1.0 (Draft)
**Author:** Jems
**Status:** Pre-development

---

## Part 1: Design System

### Design rationale

A SOC dashboard is used for extended monitoring sessions, often in low-light environments, where the operator needs to instantly distinguish "this is normal" from "this needs attention" without reading every word. Two decisions follow directly from that:

1. **A dark, low-glare interface** — not a stylistic default, but the actual working condition of a security operations room.
2. **Color is a functional signal (severity), not decoration.** The palette below is built around a consistent severity scale first, with a neutral UI layer around it — so accent color is earned by meaning, not applied for branding.

The signature element of this design is the **severity rail**: every alert-related surface (alert cards, table rows, detail headers) carries a thin colored left-edge border in the severity color. It's the one recurring visual device that lets an analyst scan a full page and read severity peripherally, without reading text.

### Color Palette

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0B0F14` | App background — deep blue-black, not pure black, to keep long-session eye strain low |
| `bg-surface` | `#131A22` | Cards, panels, table rows |
| `bg-surface-raised` | `#1A2330` | Modals, dropdowns, anything "above" the surface layer |
| `border-default` | `#232E3B` | Dividers, card borders, table gridlines |
| `text-primary` | `#E7ECF1` | Main text |
| `text-secondary` | `#8C9AAB` | Secondary/meta text (timestamps, labels) |
| `text-disabled` | `#54606E` | Disabled states, placeholder text |
| `accent-primary` | `#3DA9FC` | Primary buttons, links, active nav state, focus rings |
| `severity-critical` | `#E5484D` | Critical alerts |
| `severity-high` | `#F2994A` | High alerts |
| `severity-medium` | `#F2C94C` | Medium alerts |
| `severity-low` | `#5B8DEF` | Low alerts |
| `severity-resolved` | `#27AE60` | Resolved status, success states, "system healthy" indicators |

**Contrast note:** all text colors above meet WCAG AA contrast against `bg-base` and `bg-surface`. `severity-medium` (`#F2C94C`) is a yellow used only for small elements (badges, rail borders) — never as a large text-on-dark block, since yellow-on-dark-blue can vibrate at large sizes.

### Typography

Two type families, each doing a distinct job:

- **UI/Interface face — IBM Plex Sans.** Used for all navigation, labels, buttons, body copy. Chosen because it's a technical, engineered-feeling typeface (originally designed for IBM's own technical products) without being cold or purely geometric — it reads as "built for professionals," not "startup marketing site."
- **Data/Evidence face — IBM Plex Mono.** Used specifically and *only* for raw data: log lines, IP addresses, hashes, timestamps, rule condition values, and anything the analyst might need to copy exactly or treat as verified evidence. This creates a consistent visual rule the analyst learns quickly: *if it's monospace, it's raw data — copy it exactly; if it's sans-serif, it's the interface talking to you.*

**Type scale:**

| Role | Font | Size | Weight |
|---|---|---|---|
| Page title | Plex Sans | 24px | 600 |
| Section heading | Plex Sans | 18px | 600 |
| Body text | Plex Sans | 14px | 400 |
| Secondary/meta text | Plex Sans | 12px | 400 |
| Log/data text | Plex Mono | 13px | 400 |
| Data emphasis (e.g. matched field in a log line) | Plex Mono | 13px | 600 |

### Spacing & Layout

- **Base unit: 4px.** All spacing values are multiples of 4 (4, 8, 12, 16, 24, 32, 48) — keeps every gap, padding, and margin visually related instead of arbitrary.
- **Page layout:** fixed left sidebar (240px) for navigation, main content area with a max content width of 1440px on large screens, single-column and collapsible sidebar below 900px.
- **Card padding:** 16px standard, 24px for larger summary cards on the Overview dashboard.
- **Table row height:** 44px minimum — dense enough to see many alerts at once, tall enough to stay tappable/clickable comfortably.

### Component Styles

**Buttons**
- Primary: `accent-primary` background, `bg-base` text, 6px border-radius, 14px/600 weight label, 10px vertical / 16px horizontal padding.
- Secondary: transparent background, 1px `border-default` border, `text-primary` label.
- Destructive (e.g. "Suspend User," "Delete Rule"): `severity-critical` background, white text — reserved only for genuinely destructive/high-consequence actions so it stays meaningful.
- Disabled: `bg-surface-raised` background, `text-disabled` label, no hover state.

**Inputs**
- `bg-surface` background, 1px `border-default` border, 6px border-radius, `text-primary` value text.
- Focus state: border changes to `accent-primary`, plus a 2px outer glow ring in `accent-primary` at 30% opacity — needed for keyboard accessibility, not just aesthetics.
- Error state: border changes to `severity-critical`, with an inline error message below in `severity-critical` text at 12px.

**Cards**
- `bg-surface` background, 1px `border-default` border, 8px border-radius.
- Alert-related cards additionally carry the **severity rail**: a 3px solid left border in the relevant severity color, flush with the card's rounded corner.

**Modals**
- `bg-surface-raised` background, 12px border-radius, centered with a semi-transparent `bg-base` overlay at 70% opacity behind it.
- Always include a visible close (X) affordance and support closing via the Escape key.
- Destructive-action modals (suspend, delete, block) require the user to type a short confirmation word or click a secondary "Yes, suspend this user" button — never a single accidental click for irreversible actions.

**Accessibility baseline (non-negotiable for launch)**
- All interactive elements reachable and operable via keyboard alone.
- Visible focus outlines on every focusable element (never `outline: none` without a replacement).
- Color is never the *only* signal — every severity badge also includes the text label ("Critical," "High," etc.), so the app remains usable for colorblind users.

---

## Part 1.5: Operations & Source-Aware Interface Specifications

### 1. SourceSelector Component

The **SourceSelector** is the global scoping controller for the OPERATIONS section (Overview Dashboard, Alert Feed, and Log Explorer).

- **Visual structure**: A compact pill button (`border-border-default`, `bg-bg-surface`, `text-text-secondary`) featuring:
  - An icon/status dot: 🌐 for "All Sources", or a color-coded status dot for specific projects (Green: Active streaming in past 24h, Yellow: Idle/No data past 24h, Blue pulse: Waiting for initial event).
  - Selected project name label (truncated with `max-w-[160px]`).
  - Total source count badge (when "All Sources" is active).
  - Animated chevron indicator (`transition-transform rotate-180`).
- **Dropdown List**:
  - Dismisses automatically on outside click (`mousedown` listener) or Escape key.
  - Features smooth entry animation (`fadeSlideIn 0.12s ease-out`).
  - Lists "All Sources" option followed by all registered active projects.
  - Each item displays project name, connection method (📄 Log Shipper Agent vs 💻 Code SDK), and total ingested event count.
- **State Management**:
  - Wrapped in `SourceProvider` in `AppShell.tsx` and consumed via `useSource()` hook.
  - Selected source ID is persisted in `sessionStorage` (`gs_selected_source`) so navigation between Overview, Alerts, and Log Explorer preserves the analyst's investigation context.

### 2. Dual-Mode Log Explorer (`/logs`)

The Log Explorer dynamically adapts based on the active source selection:

- **Mode A: All Sources (SIEM OpenSearch Engine)**:
  - Queries the central OpenSearch cluster (`/api/logs/search`).
  - Controls: Keyword text input, Source IP input, Outcome dropdown (`success` / `failure`), Log Source filter, and time presets (Last 1h, 6h, 24h, 7d, All time).
  - Results Table: Formatted in IBM Plex Mono with timestamp, source IP, user, outcome (color-coded), and raw syslog message.
  - Detail Panel: Slide-in drawer on row click displaying OpenSearch index, document ID, parsed fields, and collapsible full JSON document.
- **Mode B: Specific Source Selected (Direct Raw Website/App Telemetry)**:
  - Reads directly from the tenant's private BYODB MongoDB (`/api/logs/tenant-source-logs`) with OpenSearch fallback.
  - Mode indicator banner: Highlights the active connected project with a live indicator and data privacy status (🔒 Private MongoDB vs ☁ SIEM Engine).
  - Controls: Keyword filter, Event Type filter, and Source IP filter.
  - Results Table: Columns optimized for web applications: Timestamp, Event Type badge, Source IP, User / Identifier, and Raw Message.
  - Event Type Badges:
    - `user_login_failed` / `error` / `client_error`: Red badge (`severity-critical`).
    - `suspicious` / `rate_limit`: Orange badge (`severity-high`).
    - `user_login_success` / `auth`: Green badge (`severity-resolved`).
    - `page_view` / `api_request`: Neutral surface badge (`bg-bg-surface-raised`).
  - Event Detail Drawer: Displays timestamp, event type, caller IP, authenticated user identity, full formatted message, and interactive JSON payload inspector.

### 3. Connected Sources & Connect Source Wizard (`/connected-sources`)

- **Connected Sources Management View**:
  - Displays all registered projects, storage destinations (🔒 Private MongoDB vs ☁ Cloud SIEM), live ingestion statuses, method tags, and event volume meters.
  - Admin actions: Revoke credentials modal with confirmation safeguard.
- **Connect Source Wizard (`ConnectSourceWizard.tsx`)**:
  - 3-Step Guided Modal:
    - Step 1: Project naming and integration method selection (Developer Code SDK vs No-Code Log Shipper Agent).
    - Step 2: Instant API key generation with single-show copy modal, drop-in instructions for Next.js, Node.js, Python, Go, PHP, and curl, plus downloadable configuration JSON.
    - Step 3: Real-time telemetry connection verification with animated radar and polling feedback (`/api/keys/:id/status`).

### 4. Database Settings (BYODB Management — `/settings/database`)

- Admin console allowing organizations to connect their own MongoDB instance (Atlas or self-hosted).
- Features connection string input with masking, instant TLS handshake and write-test verification, status badge (`verified`, `failed`, `pending`), and disconnect confirmation modal.

---

## Part 2: Third-Party API & Integration Spec

### 1. MaxMind GeoLite2 (Geo-IP lookup)

**What it does:** Converts an IP address into a country/city location, used to power the Geo-IP visualization and to flag alerts originating from unusual regions.

**Integration type:** Not a live API call per request — this is a downloadable database file (`.mmdb`) that gets queried locally on your own server. This matters for a security tool: you don't want to send every attacker's IP address to a third party over the network for every single log event.

- **What's sent:** Nothing leaves your server — the lookup happens against the local database file.
- **What's received:** For a given IP, the local library returns country, city (approximate), and coordinates.
- **Setup requirement:** Requires a free MaxMind account to download the `.mmdb` file; the file should be refreshed periodically (MaxMind updates it regularly) via a scheduled download, not fetched live.

### 2. AbuseIPDB (Threat Intelligence — Version 2 feature)

**What it does:** Given a suspicious IP address, returns a community-reported "abuse confidence score" and history of reports — used to enrich an alert with outside context ("has this IP been reported elsewhere?").

- **Endpoint called:** `GET https://api.abuseipdb.com/api/v2/check`
- **Data sent:** The IP address as a query parameter (`ipAddress`), plus your API key in the request header (`Key`).
- **Expected response:** JSON containing `abuseConfidenceScore` (0–100), `totalReports`, `countryCode`, and `lastReportedAt`.
- **Rate limits to plan for:** the free tier has a daily request cap — enrichment lookups should be cached (e.g., don't re-check the same IP more than once every few hours) rather than called on every single alert.

### 3. AlienVault OTX (Threat Intelligence — Version 2 feature, alternative/addition to AbuseIPDB)

**What it does:** Checks an IP or domain against community threat-intel "pulses" (reports of known malicious infrastructure).

- **Endpoint called:** `GET https://otx.alienvault.com/api/v1/indicators/IPv4/{ip}/general`
- **Data sent:** The IP address in the URL path, plus your API key in the request header (`X-OTX-API-KEY`).
- **Expected response:** JSON including `pulse_info.count` (how many threat reports reference this IP) and associated `pulse_info.pulses` details (names/descriptions of the threat campaigns, if any).

### 4. Slack (Critical Alert Notifications — Version 2 feature)

**What it does:** Posts a message into a Slack channel when a critical-severity alert fires, so the team doesn't have to be staring at the dashboard to notice.

- **Integration type:** Incoming Webhook (simplest option — no OAuth needed for a single-channel notification).
- **Endpoint called:** `POST` to the unique webhook URL Slack generates when you create the integration (e.g., `https://hooks.slack.com/services/…`).
- **Data sent:** A JSON body with a `text` field containing the alert summary (severity, source IP, rule name, link back to the dashboard).
- **Expected response:** Slack returns a plain `200 OK` with body text `ok` on success; a non-200 response means the message failed to post and should be retried or logged.

### 5. Email / SMTP (Critical Alert Notifications — Version 2 feature)

**What it does:** Sends an email to designated recipients for critical alerts, as a channel independent of Slack (so a Slack outage doesn't mean total silence).

- **Integration type:** Standard SMTP relay (e.g., via a transactional email provider such as SendGrid or Postmark, rather than self-hosting a mail server).
- **Endpoint called (if using SendGrid as an example):** `POST https://api.sendgrid.com/v3/mail/send`
- **Data sent:** JSON body containing sender/recipient addresses, subject line, and the alert details as the email body; your API key sent in the `Authorization` header.
- **Expected response:** A `202 Accepted` status means the email was queued successfully; SendGrid does not return the delivered email content back, only a status.

### General integration notes

- **All third-party API keys must be stored as environment variables** (see the Technical Architecture Document's environment variable section) — never hardcoded, never committed to the repository.
- **Every external call should have a timeout and a failure fallback.** None of these services being down should ever prevent the core dashboard (alerts, logs, rules) from working — enrichment and notifications are additive, not load-bearing.
- **Outbound calls to threat-intel services reveal the IPs you're investigating to a third party.** This is an accepted tradeoff for the value they provide, but it's worth being aware of if you ever handle a dataset with strict confidentiality requirements — in that case, these lookups should be optional/toggleable per organization rather than always-on.
