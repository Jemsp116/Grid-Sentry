-- 001_init.sql
-- Initial schema for Grid Sentry (TICKET-000)
--
-- Raw log CONTENT is not stored here — it lives in OpenSearch. Postgres holds
-- only structured metadata that needs relationships and transactions.
--
-- The seed admin account is intentionally NOT created here (a committed SQL file
-- must never contain a password hash). It is created by the backend seed script,
-- which hashes ADMIN_PASSWORD from the environment:  npm run seed:admin

-- ── Enums ────────────────────────────────────────────────
CREATE TYPE user_role      AS ENUM ('viewer', 'analyst', 'admin');
CREATE TYPE alert_status   AS ENUM ('new', 'investigating', 'resolved', 'false_positive');
CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE rule_action    AS ENUM ('alert_only', 'alert_and_block_ip');

-- ── Users ────────────────────────────────────────────────
CREATE TABLE users (
    id               SERIAL PRIMARY KEY,
    email            TEXT UNIQUE NOT NULL,
    password_hash    TEXT NOT NULL,
    role             user_role NOT NULL DEFAULT 'viewer',
    is_active        BOOLEAN NOT NULL DEFAULT true,
    suspended_reason TEXT,
    suspended_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Refresh tokens (for instant session revocation) ─────
CREATE TABLE refresh_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- ── Detection rules ──────────────────────────────────────
CREATE TABLE rules (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    description         TEXT,
    log_source          TEXT NOT NULL,
    match_conditions    JSONB NOT NULL,
    threshold           INTEGER NOT NULL DEFAULT 1,
    time_window_seconds INTEGER NOT NULL DEFAULT 60,
    severity            severity_level NOT NULL,
    mitre_technique_id  TEXT,
    action_on_trigger   rule_action NOT NULL DEFAULT 'alert_only',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Alerts ───────────────────────────────────────────────
CREATE TABLE alerts (
    id                 SERIAL PRIMARY KEY,
    rule_id            INTEGER NOT NULL REFERENCES rules(id),
    source_ip          TEXT NOT NULL,
    target_host        TEXT,
    severity           severity_level NOT NULL,   -- copied from rule at trigger time
    status             alert_status NOT NULL DEFAULT 'new',
    opensearch_log_ids JSONB NOT NULL DEFAULT '[]',
    assigned_to        INTEGER REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_rule_id   ON alerts(rule_id);
CREATE INDEX idx_alerts_status    ON alerts(status);
CREATE INDEX idx_alerts_source_ip ON alerts(source_ip);

-- ── Alert notes (append-only) ────────────────────────────
CREATE TABLE alert_notes (
    id         SERIAL PRIMARY KEY,
    alert_id   INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    note       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_notes_alert_id ON alert_notes(alert_id);

-- ── IP blocklist ─────────────────────────────────────────
CREATE TABLE ip_blocklist (
    id                   SERIAL PRIMARY KEY,
    ip_address           TEXT UNIQUE NOT NULL,
    reason               TEXT,
    triggered_by_rule_id INTEGER REFERENCES rules(id),
    added_by             INTEGER REFERENCES users(id),
    expires_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Audit log ────────────────────────────────────────────
-- No FK on user_id/target_id BY DESIGN: audit entries must survive even if the
-- referenced row is later modified or removed (see Technical Architecture §3).
CREATE TABLE audit_log (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER,          -- nullable: null = system-triggered action
    action      TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id   INTEGER,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_user_id    ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_action     ON audit_log(action);
