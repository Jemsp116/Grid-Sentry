# Connect Your Project to Grid Sentry

Grid Sentry provides official, lightweight client SDKs and a pre-configured log-shipping agent so you can stream telemetry, user authentication logs, and security events into your SOC dashboard in under one minute.

---

## 🔒 Security Notice
All SDKs and agents use **project-scoped API keys** restricted to your organization. **Never embed API keys into client-side web bundles or public mobile apps.**

---

## Language SDK Matrix

| Language | Package Name | Install Command | Status |
| :--- | :--- | :--- | :--- |
| **Node.js / TS** | `grid-sentry-client` | `npm install grid-sentry-client` | ✅ Official Stable |
| **Python** | `grid-sentry-client` | `pip install grid-sentry-client` | ✅ Official Stable |
| **Go** | `github.com/gridsentry/gridsentry-go` | `go get github.com/gridsentry/gridsentry-go` | ✅ Official Stable |
| **PHP** | `grid-sentry/client` | `composer require grid-sentry/client` | ✅ Official Stable |
| **No-Code Agent** | `@gridsentry/agent` | Download Pre-filled `.json` | ✅ Ready to Run |

---

## Quick Start Snippets

### 1. Node.js & TypeScript
```typescript
import { GridSentry } from 'grid-sentry-client';

const sentry = new GridSentry({
  apiKey: process.env.GRID_SENTRY_API_KEY!,
  baseUrl: 'http://localhost:4000',
  appName: 'my-service',
});

sentry.log('user_login_success', {
  user_identifier: 'user@example.com',
  raw_message: 'User logged in',
  details: { ip: '192.168.1.10' },
});
```

### 2. Python
```python
from grid_sentry import GridSentry

sentry = GridSentry(
    api_key="gs_live_YOUR_API_KEY",
    base_url="http://localhost:4000",
    app_name="my-service",
)

sentry.log(
    event_type="user_login_success",
    user_identifier="user@example.com",
    raw_message="User logged in",
    details={"ip": "192.168.1.10"},
)
```

### 3. Go
```go
package main

import (
    "github.com/gridsentry/gridsentry-go"
)

func main() {
    client, _ := gridsentry.NewClient(gridsentry.Config{
        ApiKey:  "gs_live_YOUR_API_KEY",
        BaseURL: "http://localhost:4000",
        AppName: "my-service",
    })
    defer client.Close()

    client.Log("user_login_success", gridsentry.Payload{
        UserIdentifier: "user@example.com",
        RawMessage:     "User logged in",
    })
}
```

### 4. PHP
```php
use GridSentry\Client as GridSentry;

$sentry = new GridSentry([
    'apiKey'  => 'gs_live_YOUR_API_KEY',
    'baseUrl' => 'http://localhost:4000',
    'appName' => 'my-service',
]);

$sentry->log('user_login_success', [
    'user_identifier' => 'user@example.com',
    'raw_message'     => 'User logged in',
]);
```

### 5. No-Code Log Shipper Agent
Download the pre-filled configuration from the **"Connect a Project"** wizard in your dashboard, then run:
```bash
npx @gridsentry/agent --config gridsentry-agent.json
```
