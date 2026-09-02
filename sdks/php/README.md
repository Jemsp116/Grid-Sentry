# Grid Sentry Client (PHP)

Official PHP client SDK for streaming security, authentication, and application telemetry into the **Grid Sentry SOC & SIEM platform**.

> [!WARNING]
> **Server-Side Only**: Never expose API keys in client-side templates or web assets. API keys must remain strictly confidential on your backend servers.

---

## Installation

```bash
composer require grid-sentry/client
```

---

## Quick Start

```php
<?php

use GridSentry\Client as GridSentry;

// 1. Initialize once in your app bootstrap
$sentry = new GridSentry([
    'apiKey'  => getenv('GRID_SENTRY_API_KEY'),
    'baseUrl' => 'http://localhost:4000',
    'appName' => 'laravel-api',
]);

// 2. Stream security & audit telemetry
$sentry->log('user_login_success', [
    'user_identifier' => 'dev@example.com',
    'raw_message'     => 'User authenticated via password',
    'details'         => ['session_id' => 'sess_123'],
]);

// Convenience helpers
$sentry->loginSuccess('dev@example.com');
$sentry->loginFailure('dev@example.com', 'Invalid password');
$sentry->error(new Exception('Payment gateway timeout'));
```

---

## Features

- **Auto-Shutdown Flush**: Automatically registers PHP shutdown handler to flush any buffered logs before request termination.
- **Fail-Safe Resilience**: Network or SIEM outages never throw exceptions into your PHP application.
- **PSR-4 & PSR-12 Compliant**: Clean, modern architecture compatible with Laravel, Symfony, WordPress, and raw PHP.

---

## Specification

For full ingestion schema details, see [SDK_SPEC.md](../../docs/SDK_SPEC.md).
