# grid-sentry-client

Installable Node.js Client SDK for Grid Sentry log ingestion.

> ⚠️ **SERVER-SIDE ONLY WARNING**
> This package holds sensitive API keys and **MUST ONLY** be executed in server-side Node.js environments (Next.js server actions / API routes, Express, Fastify, microservices).
> **DO NOT** import or bundle this library in client-side browser JavaScript.

---

## Installation

### Local file dependency
In your consuming Node.js application's `package.json`:

```json
{
  "dependencies": {
    "grid-sentry-client": "file:../path/to/grid-sentry-client"
  }
}
```

Then run `npm install`.

---

## Quickstart Usage

```typescript
import { gridSentry } from 'grid-sentry-client';

// 1. Initialize once at app startup
gridSentry.init({
  baseUrl: 'http://localhost:4000',
  apiKey: 'gs_live_secret_key_2026',
});

// 2. Log security events throughout your server code
gridSentry.log('user_login_failed', {
  source_ip: req.ip,
  user_identifier: 'john.doe@example.com',
  raw_message: 'Failed login attempt for user john.doe@example.com',
  details: {
    auth_method: 'password',
    attempts_remaining: 2,
  },
});
```

---

## Features

- **Fire-and-Forget Safety:** Runtime network failures, server timeouts, and HTTP errors are caught internally and never crash consuming application processes.
- **Automatic 1-Retry:** Retries failed requests once before dropping.
- **Request Batching:** Optionally queue events in memory and flush periodically to reduce HTTP request volume.
- **TypeScript Autocomplete:** Fully typed interfaces for configuration and log parameters.

---

## Request Batching Configuration

```typescript
gridSentry.init({
  baseUrl: 'http://localhost:4000',
  apiKey: 'gs_live_secret_key_2026',
  batching: true,
  flushIntervalMs: 5000, // Flush queued events every 5 seconds
});

// Force an immediate flush before process shutdown
await gridSentry.flush();
```
