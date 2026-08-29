# Architectural Decision Record (ADR): Raw SIEM Log Search for BYODB Tenants

**Status:** Approved  
**Date:** 2026-08-28  
**Context:** Grid Sentry external data connections feature (Part 3: Bring Your Own MongoDB - BYODB).

---

## 1. Problem Statement

Grid Sentry allows individual tenants/users to bring their own MongoDB database (BYODB) to store application data (alert feeds, detection rule definitions, analyst notes, and immutable audit logs).

However, high-volume SIEM log ingestion generates millions of raw security log events per day. A key question arises: **Should raw SIEM log events be stored in the tenant's MongoDB instance or remain in Grid Sentry's OpenSearch cluster?**

---

## 2. Decision

**Raw SIEM log events will continue to be indexed and searched exclusively in OpenSearch**, while structured SOC application metadata (alerts, rules, audit trail) is stored in the tenant's dedicated MongoDB instance.

---

## 3. Rationale & Key Considerations

| Factor | OpenSearch (SIEM Log Engine) | MongoDB (App Data Engine) |
|---|---|---|
| **Query Engine** | Inverted index optimized for full-text regex, keyword searches, and aggregations across unstructured syslog text. | B-tree indexed document store optimized for transactional CRUD operations and structured queries. |
| **Ingestion Scale** | Built for continuous bulk streaming (Vector -> OpenSearch bulk API) with automatic index lifecycle management (`soc-logs-YYYY-MM`). | High write overhead for unstructured text at scale without dedicated search indexing pipelines. |
| **Log Explorer UI** | Log Explorer requires sub-second response times for full-text keyword searches across raw message fields. | Full-text text indexes in MongoDB lack the scoring, tokenizer control, and term aggregations needed for SOC threat hunting. |
| **Security & Privacy** | Log entries contain non-sensitive system telemetry (`source_ip`, `ssh_user`, `event_type`). Sensitive application metadata (who changed rules, analyst investigation notes, alert triage decisions) resides in the tenant's BYODB. | Storing company-specific alert feeds and analyst notes in the tenant's MongoDB guarantees data ownership where it matters most. |

---

## 4. Architecture Summary

```
                  ┌──────────────────────────────────────────────┐
                  │              External Log Source             │
                  └──────────────────────┬───────────────────────┘
                                         │ POST /api/logs/ingest
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │              Grid Sentry Engine              │
                  └──────────────┬────────────────┬──────────────┘
                                 │                │
          Raw Log Events         │                │ Structured Alerts/Rules
          (Full-text indexing)   │                │ (Tenant-isolated storage)
                                 ▼                ▼
                  ┌──────────────────────┐ ┌──────────────────────┐
                  │  OpenSearch Cluster  │ │  Tenant MongoDB DB   │
                  │   (`soc-logs-*`)     │ │       (BYODB)        │
                  └──────────────────────┘ └──────────────────────┘
```

1. **Telemetry Ingestion**: Incoming raw log events (`ssh_auth`, SDK logs, webhooks) flow into OpenSearch for high-performance indexing and detection rule evaluation.
2. **Rule Detection Engine**: Worker continuously evaluates active detection rules against OpenSearch.
3. **Alert Creation & Triage**: When a rule fires, the alert record, evidence references, and subsequent analyst notes are written to the tenant's BYODB MongoDB via the unified Data Access Abstraction Layer (`tenantDataAccess.ts`).
4. **Data Isolation**: If a tenant revokes BYODB, their MongoDB connection pool is closed immediately and further writes fallback to the shared primary cluster.

---

## 5. Security & SSRF Safeguards

- **KMS Encryption**: Tenant connection URIs are encrypted using AES-256-GCM authenticated encryption (`kmsEncryption.ts`).
- **SSRF Validation**: Submitted URIs undergo strict DNS resolution and CIDR validation (`ssrfGuard.ts`) to block connections to loopback or private network ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1/128`).
- **Zero Log Leakage**: Raw connection credentials are never printed in server logs or API error outputs.
