# Grid Sentry Client (Go)

Official Go client SDK for streaming security, authentication, and application telemetry into the **Grid Sentry SOC & SIEM platform**.

> [!WARNING]
> **Server-Side Only**: Never use this package in client-distributed binaries where API keys could be reverse-engineered. API keys must remain strictly confidential on your backend servers.

---

## Installation

```bash
go get github.com/gridsentry/gridsentry-go
```

---

## Quick Start

```go
package main

import (
	"os"
	"github.com/gridsentry/gridsentry-go"
)

func main() {
	// 1. Initialize client once
	client, err := gridsentry.NewClient(gridsentry.Config{
		ApiKey:  os.Getenv("GRID_SENTRY_API_KEY"),
		BaseURL: "http://localhost:4000",
		AppName: "auth-service",
	})
	if err != nil {
		panic(err)
	}
	defer client.Close()

	// 2. Stream security & audit telemetry
	client.Log("user_login_success", gridsentry.Payload{
		UserIdentifier: "dev@example.com",
		RawMessage:     "User signed in via WebAuthn",
		Details: map[string]interface{}{
			"auth_type": "fido2",
		},
	})

	// Convenience helpers
	client.LoginSuccess("dev@example.com", nil)
	client.LoginFailure("dev@example.com", "Bad credentials", nil)
}
```

---

## Features

- **Goroutine Channel Worker**: Asynchronous queueing ensures `Log()` calls take `< 0.01ms` without blocking HTTP requests.
- **Fail-Safe Resilience**: Network or SIEM outages are swallowed silently so your Go microservices never panic or degrade.
- **Graceful Shutdown**: `Close()` drains and flushes any queued telemetry before service shutdown.

---

## Specification

For full ingestion schema details, see [SDK_SPEC.md](../../docs/SDK_SPEC.md).
