# Product Requirements Document
## Project: SOC Log Analysis & Detection Dashboard

**Version:** 1.0 (Draft)
**Author:** Jems
**Status:** Pre-development

---

## 1. Overview

### 1.1 What the app does
A self-hosted Security Operations Center (SOC) dashboard that ingests logs from servers, applications, and network devices, detects malicious activity using configurable detection rules, and gives analysts a single place to search logs, triage alerts, and respond to threats — including suspending compromised/malicious accounts and blocking attacking IPs.

In short: it turns raw, scattered log files into an actionable security monitoring workflow.

### 1.2 Who it's for
- **Primary:** Small security teams or solo SOC analysts at organizations too small to afford Splunk/Sentinel licensing, who need real detection and triage capability without enterprise pricing.
- **Secondary (for this project specifically):** Used as a portfolio/demo product to demonstrate SOC analyst and security engineering capability to employers — built to mirror how real SOC tooling works, not a simplified toy.

### 1.3 What problem it solves
- Logs are scattered across many systems and formats — nobody manually reads them all.
- Off-the-shelf enterprise SIEM tools (Splunk, Microsoft Sentinel) are expensive and often overkill for small teams.
- Open-source stacks (raw ELK) give you search, but not a ready analyst workflow — no alert triage, no RBAC-gated rule management, no built-in blocking actions. Teams end up bolting these together themselves.
- This app packages ingestion, detection, triage, and response into one coherent, permission-controlled tool.

---

## 2. Core Features

### 2.1 Must-have (MVP — Version 1)

| # | Feature | Description |
|---|---------|-------------|
| 1 | Alert feed / triage view | Live table of alerts with filters (severity, source IP, log source, MITRE technique); click-through to raw log and matched rule |
| 2 | Overview / summary dashboard | Key metrics: events processed, alerts by severity, top attacker IPs, alert volume timeline |
| 3 | Alert status workflow | Analyst moves alerts New → Investigating → Resolved / False Positive, with notes |
| 4 | User auth + roles (RBAC) | Login system with Viewer / Analyst / Admin roles, enforced server-side on every route |
| 5 | Rule management (custom detection rules) | Admins build detection rules via a constrained rule builder (field/operator/value/threshold/time window) — no raw code execution. Rules can be enabled/disabled |
| 6 | Log search / explorer | Full-text and filtered search across ingested logs, with raw log detail view |
| 7 | Audit log | Records every admin action — rule changes, account suspensions, status changes — with who/when |
| 8 | Access control / blocking | Two distinct actions: (a) suspend an internal user account showing malicious/anomalous behavior, killing active sessions; (b) blocklist an external IP identified by a rule, shown in its own dashboard tab |
| 9 | Geo-IP visualization | Map or list view of source IP countries, with high-risk-region flagging |

### 2.2 Nice-to-have (Version 2 — post-MVP)

| # | Feature | Description |
|---|---------|-------------|
| 10 | MITRE ATT&CK matrix view | Heatmap showing which techniques have been detected most frequently |
| 11 | Threat intel enrichment | Auto-lookup of source IPs against AbuseIPDB / AlienVault OTX, shown on alert detail |
| 12 | Email / Slack alerting | Push notifications for critical-severity alerts |
| 13 | Export reports | PDF/CSV export of alerts for a given date range; dark-mode SOC-style theming |

**Explicitly out of scope for V1:** anything in section 2.2, plus automated firewall/WAF integration (blocking stays internal to the app, not pushed to network infrastructure), multi-tenant support (single organization/instance only), mobile app, and natural-language/AI-assisted alert summarization.

---

## 3. User Flow (Start to Finish)

1. **Login** — user authenticates; role (Viewer/Analyst/Admin) determines what they see next.
2. **Land on Overview Dashboard** — sees current alert volume, severity breakdown, and any critical alerts needing attention.
3. **Open Alert Feed** — filters to, say, "Critical" + "last 24h," sees a live-updating list.
4. **Click an alert** — sees the raw log line(s), which rule matched, source IP, Geo-IP location, and MITRE technique tag.
5. **Investigate** — analyst may pivot to Log Explorer to search for related activity from the same IP/user across a wider time window.
6. **Take action:**
   - If external attacker → add IP to blocklist (logged to audit trail).
   - If internal account compromised/misused → suspend the account (kills sessions, logged to audit trail).
   - If not a real threat → mark alert as False Positive with a note.
7. **(Admin only) Rule management** — an Admin periodically reviews rule performance (false positive rate) and adds/adjusts detection rules via the rule builder, dry-running against historical data before activating.
8. **Audit review** — Admin can review the audit log to see all actions taken by the team over a period.

---

## 4. MVP Definition

The MVP is the full Version 1 feature set (9 features above) — deliberately larger than a typical "minimal" MVP because the core value proposition (a *working, permission-gated detection-to-response loop*) only exists once auth, rules, alerts, search, and blocking are all present together. A subset (e.g., alerts without RBAC, or search without detection) would not demonstrate the actual product concept.

**MVP is considered done when:**
- A real log source (e.g., SSH auth logs) is ingested continuously.
- At least 2–3 detection rules are active and correctly fire on simulated attacks (e.g., brute-force via Hydra).
- An Admin can create a new rule through the UI (not by editing code) and see it take effect.
- An analyst can triage an alert end-to-end: view → investigate via log search → resolve or block.
- Suspending a user account and blocklisting an IP both work and appear in the audit log.

---

## 5. Success Metrics

Since this is a demo/portfolio product rather than a live commercial product, success is measured differently than typical user-growth metrics:

**Functional correctness metrics:**
- Detection accuracy: % of simulated attacks correctly flagged (target: 100% for the rules explicitly built to catch them)
- False positive rate on normal/benign traffic during testing
- End-to-end latency: time from log generation to alert appearing on dashboard (target: under a few seconds for near-real-time feel)

**Product completeness metrics:**
- All 9 MVP features functional and demoable without manual workarounds
- A new rule can be created and activated by an Admin without a code deploy

**Portfolio/career-outcome metrics** (since this project targets SOC analyst roles):
- Project is demoable in an interview in under 5 minutes end-to-end
- Clear, recorded demo video showing an attack simulation flowing through ingestion → detection → alert → blocking
- README/architecture docs clear enough that a technical interviewer can understand design decisions (schema choices, RBAC model, detection engine design) without a live walkthrough

---

## 6. Explicitly NOT Building in Version 1

- Any of the 4 Version 2 features (MITRE matrix, threat intel enrichment, email/Slack alerts, report export/dark mode)
- Automated network-level blocking (pushing blocks to a real firewall/WAF) — V1 blocking is application-level only
- Multi-tenancy / multiple organizations on one instance
- Mobile app or mobile-optimized UI
- AI/LLM-based alert summarization or natural-language querying of logs
- Custom/raw script execution in the rule builder (security risk — rules stay a constrained, safe DSL)
- High-availability/clustering concerns (single-node deployment is acceptable for V1)
