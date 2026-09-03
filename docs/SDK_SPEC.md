# Grid Sentry Client SDK Specification (v1.0)

This document defines the formal protocol contract, payload schemas, buffering expectations, and error resilience rules for all Grid Sentry Client SDKs.

---

## 1. Authentication

Every log ingestion request must include the project's API key via the `X-API-Key` HTTP header:

```http
POST /api/logs/ingest HTTP/1.1
Host: localhost:4000
Content-Type: application/json
X-API-Key: gs_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 2. Ingestion Request Schema

The payload must be an array of JSON event objects (single objects are also accepted by the API for convenience):

```json
[
  {
    "timestamp": "2026-09-02T12:00:00.000Z",
    "event_type": "user_login_success",
    "source_ip": "203.0.113.195",
    "user_identifier": "alex@company.com",
    "raw_message": "User alex@company.com logged in successfully",
    "details": {
      "mfa_used": true,
      "auth_method": "fido2",
      "user_agent": "Mozilla/5.0..."
    }
  }
]
```

### Field Definitions

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `timestamp` | `string` (ISO-8601) | Optional | Event occurrence timestamp. Defaults to server receipt time if omitted. |
| `event_type` | `string` | Required | Standard event category (e.g. `user_login_success`, `user_login_failed`, `application_error`, `api_access`). |
| `source_ip` | `string` | Optional | Client IP address. Defaults to caller IP. |
| `user_identifier` | `string` | Optional | Username, email, or account ID associated with event. |
| `raw_message` | `string` | Required | Human-readable log summary string. |
| `details` | `object` | Optional | Arbitrary key-value metadata object for rich SIEM queries and SOC rules. |

---

## 3. Core SDK Design Principles

1. **Server-Side Exclusivity**: SDKs must clearly state in documentation that they are strictly for server-side environments.
2. **Fail-Safe Resilience**: Under no circumstances should a telemetry failure (DNS error, timeout, HTTP 500) throw an uncaught exception or crash the host application.
3. **Auto-Batching & Flushing**:
   - SDKs buffer events in memory and flush periodically (e.g. every 300ms–500ms) or when buffer reaches the batch threshold (e.g. 25 events).
   - A manual `flush()` method must be exposed.
   - SDKs should hook process shutdown (e.g. `process.on('beforeExit')` in Node, `register_shutdown_function` in PHP, `defer client.Close()` in Go) to drain pending events.
4. **Descriptive Initialization Checks**:
   - Calling `log()` before `init()` must raise a clear error indicating that initialization is required.

---

## 4. Built-in SDK Distribution Endpoints

The Grid Sentry backend directly serves zero-dependency client bundles and automated setup scripts:

| Endpoint | Content-Type | Target Runtime | Description |
| :--- | :--- | :--- | :--- |
| `GET /api/sdk/gridsentry.js` | `application/javascript` | Browser / HTML / Next.js | Universal drop-in bundle. Self-initializes via `data-api-key` and auto-captures browser runtime errors and promise rejections. |
| `GET /api/sdk/gridsentry.mjs` | `application/javascript` | Next.js / Vite / Node ESM | Standard ES Module export of `GridSentryClient`. |
| `GET /api/sdk/install-agent.ps1` | `text/plain` | Windows PowerShell | Native PowerShell installer: generates config at `$HOME\.gridsentry\agent-[app].json` and fires verification test. |
| `GET /api/sdk/install-agent.sh` | `text/x-shellscript` | Linux / macOS / WSL | Bash installer: generates config at `~/.gridsentry/agent-[app].json` and executes connection handshake. |
| `GET /api/sdk/agent-config` | `application/json` | File Download | Dynamically generated configuration file ready for custom log shippers. |

### Browser Drop-in & Auto-Capture Behavior (`gridsentry.js`)
When included via a `<script>` or Next.js `<Script>` tag, `gridsentry.js` reads attributes from the script tag itself:
```html
<script 
  src="http://localhost:4000/api/sdk/gridsentry.js"
  data-api-key="gs_live_YOUR_KEY"
  data-app="web-portal"
  data-base-url="http://localhost:4000"
></script>
```
- **Error Listening**: Automatically attaches to `window.addEventListener('error')` and `window.addEventListener('unhandledrejection')` to stream front-end exceptions directly into the SOC log explorer.
- **Global Helper**: Exposes `window.GridSentry` with helper methods:
  - `GridSentry.log(eventType, payload)`
  - `GridSentry.loginSuccess(userEmail, details)`
  - `GridSentry.loginFailure(userEmail, reason, details)`
  - `GridSentry.error(err, details)`
  - `GridSentry.flush()`

