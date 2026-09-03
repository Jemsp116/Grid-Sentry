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

---

## 🚀 One-Click Installers (PowerShell & Bash)

Grid Sentry serves automated installer scripts directly from its API for rapid onboarding:

### Windows PowerShell (One-Liner)
```powershell
irm 'http://localhost:4000/api/sdk/install-agent.ps1?key=gs_live_YOUR_KEY&app=my-project' | iex
```
- Creates `$HOME\.gridsentry\agent-my-project.json`
- Tests the endpoint and sends an immediate initial handshake event (`agent_connected`)

### Linux / macOS / WSL Bash (One-Liner)
```bash
curl -sSL http://localhost:4000/api/sdk/install-agent.sh | bash -s -- --key gs_live_YOUR_KEY --app my-project
```
- Creates `~/.gridsentry/agent-my-project.json`
- Verifies connection and streams initial connection telemetry

---

## 🌐 Web & Next.js Drop-in Client

For web apps, websites, and Next.js (React), Grid Sentry serves universal, zero-dependency client bundles directly from the server:

### A. Next.js Root Layout (`layout.js` or `layout.tsx`)
Drop this directly into your `src/app/layout.js`:

```javascript
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="http://localhost:4000/api/sdk/gridsentry.js"
          data-api-key="gs_live_YOUR_API_KEY"
          data-app="my-website"
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```
*Automatically captures unhandled window errors, promise rejections, and exposes `window.GridSentry` globally.*

### B. Next.js Middleware Request Logger (`middleware.ts`)
To stream every HTTP route visit and API request from your website:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  fetch('http://localhost:4000/api/logs/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'gs_live_YOUR_API_KEY',
    },
    body: JSON.stringify([{
      timestamp: new Date().toISOString(),
      event_type: 'page_view',
      source_ip: request.ip || '127.0.0.1',
      raw_message: `${request.method} ${request.nextUrl.pathname}`,
      details: {
        path: request.nextUrl.pathname,
        method: request.method,
      }
    }]),
  }).catch(() => {});

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 🔍 Viewing Your Website Logs in Grid Sentry

Once your project is connected:
1. Open the **OPERATIONS** section on your dashboard.
2. In the top-right **Source Selector** dropdown, pick your project name (e.g. `my-website`).
3. Click **Log Explorer**:
   - You will see the **Raw Website Logs** stream directly from your private database.
   - Each event displays its event type badge, source IP, user identifier, and message.
   - Click any log row to inspect its full JSON payload details.

