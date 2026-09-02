# Grid Sentry Client (Python)

Official Python client SDK for streaming security, authentication, and application telemetry into the **Grid Sentry SOC & SIEM platform**.

> [!WARNING]
> **Server-Side Only**: Never use this package in client-facing applications where API keys can be reverse-engineered. API keys must remain strictly confidential on your backend servers.

---

## Installation

```bash
pip install grid-sentry-client
```

---

## Quick Start

```python
from grid_sentry import GridSentry

# 1. Initialize once in your application setup
sentry = GridSentry(
    api_key="gs_live_YOUR_PROJECT_API_KEY",
    base_url="http://localhost:4000",
    app_name="auth-api",
)

# 2. Stream events
sentry.log(
    event_type="user_login_success",
    user_identifier="maria@example.com",
    raw_message="User logged in via 2FA",
    details={"device": "macos", "mfa_method": "totp"},
)

# Convenience helpers
sentry.login_success("maria@example.com")
sentry.login_failure("maria@example.com", reason="Invalid password")
sentry.error(Exception("Redis connection refused"))
```

### Async / FastAPI Usage

```python
from grid_sentry import AsyncGridSentry

async_sentry = AsyncGridSentry(
    api_key="gs_live_YOUR_PROJECT_API_KEY",
    base_url="http://localhost:4000",
    app_name="fastapi-app",
)

@app.post("/login")
async def login(req: Request):
    ...
    await async_sentry.log("user_login_success", user_identifier=user.email)
```

---

## Features

- **Non-Blocking Background Worker**: Automatically buffers and flushes events on a background daemon thread.
- **Fail-Safe Resilience**: Network or SIEM outages never raise into calling Python code.
- **Zero Heavy Dependencies**: Built entirely on standard Python libraries.
- **Full Type Hints**: Compatible with `mypy` and IDE type inspection.

---

## Specification

For full ingestion schema details, see [SDK_SPEC.md](../../docs/SDK_SPEC.md).
