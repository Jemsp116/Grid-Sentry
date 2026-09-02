# Grid Sentry Client (Node.js & TypeScript)

Official Node.js and TypeScript client SDK for streaming security, authentication, and application telemetry directly into the **Grid Sentry SOC & SIEM platform**.

> [!WARNING]
> **Server-Side Only**: Never use this package in browser-facing bundles. API keys must remain strictly confidential on your backend servers.

---

## Installation

```bash
npm install grid-sentry-client
```

---

## Quick Start

```typescript
import { GridSentry } from 'grid-sentry-client';

// 1. Initialize once in your app entrypoint
const sentry = new GridSentry({
  apiKey: process.env.GRID_SENTRY_API_KEY!,
  baseUrl: process.env.GRID_SENTRY_URL || 'http://localhost:4000',
  appName: 'payment-service',
});

// 2. Stream security & audit events
sentry.log('user_login_success', {
  user_identifier: 'sarah@example.com',
  raw_message: 'User logged in via OAuth',
  details: { provider: 'google', ip: '192.168.1.50' },
});

// Or use built-in convenience helpers:
sentry.loginSuccess('sarah@example.com');
sentry.loginFailure('sarah@example.com', 'Invalid password');
sentry.error(new Error('Database timeout'));
```

---

## Features

- **Non-Blocking Auto-Batching**: Buffers events in memory and flushes in batches without delaying HTTP requests.
- **Fail-Safe Resilience**: Network or API errors are suppressed silently so telemetry outages will never crash your application.
- **Zero Heavy Dependencies**: Uses standard native `fetch`.
- **Full TypeScript Types**: Complete autocomplete for configuration and payload objects.

---

## Specification

For full ingestion schema and protocol details, see [SDK_SPEC.md](../../docs/SDK_SPEC.md).
