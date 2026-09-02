import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  createApiKey,
  fetchApiKeyStatus,
  type CreatedApiKeyResponse,
  type ApiKeyStatusResponse,
} from '../api/apiKeys.js';

interface ConnectSourceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3;
type Method = 'code' | 'agent';
type Language = 'nextjs' | 'node' | 'python' | 'go' | 'php' | 'curl';

export default function ConnectSourceWizard({ isOpen, onClose, onSuccess }: ConnectSourceWizardProps) {
  const { authFetch } = useAuth();

  // Wizard Navigation
  const [step, setStep] = useState<Step>(1);

  // Step 1 State
  const [projectName, setProjectName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [keyData, setKeyData] = useState<CreatedApiKeyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 2 State
  const [method, setMethod] = useState<Method>('code');
  const [language, setLanguage] = useState<Language>('nextjs');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Step 3 State
  const [statusData, setStatusData] = useState<ApiKeyStatusResponse | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  const SERVER_URL = API_BASE.replace(/\/api\/?$/, '');
  const activeKey = keyData?.raw_key || 'gs_live_YOUR_API_KEY';
  const app = projectName.trim() || 'my-project';

  // Reset wizard on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setProjectName('');
      setKeyData(null);
      setError(null);
      setMethod('code');
      setLanguage('nextjs');
      setStatusData(null);
    }
  }, [isOpen]);

  // Polling for Step 3 - poll the real status from server
  const pollStatus = useCallback(async () => {
    if (!keyData) return;
    try {
      const res = await fetchApiKeyStatus(authFetch, keyData.id);
      setStatusData(res);
    } catch {
      // Ignore polling errors
    }
  }, [authFetch, keyData]);

  useEffect(() => {
    if (step === 3 && keyData) {
      pollStatus();
      pollTimerRef.current = window.setInterval(pollStatus, 2000);
    }
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [step, keyData, pollStatus]);

  if (!isOpen) return null;

  // Step 1: Submit Project Name & Generate Scoped Key
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    try {
      setCreatingKey(true);
      setError(null);
      const res = await createApiKey(authFetch, projectName.trim(), method);
      setKeyData(res);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project source');
    } finally {
      setCreatingKey(false);
    }
  };

  // Step 2: Code Snippets
  const getSnippet = () => {
    switch (language) {
      case 'nextjs':
        return `// ─── Next.js App Router / Pages Router (Zero Dependencies) ───
// Drop this helper directly into your Next.js project (e.g. lib/gridSentry.js or page.js):

export async function sendGridSentryLog(eventType, rawMessage, details = {}) {
  try {
    await fetch('${SERVER_URL}/api/logs/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': '${activeKey}',
      },
      body: JSON.stringify([{
        timestamp: new Date().toISOString(),
        event_type: eventType,
        source_ip: '127.0.0.1',
        raw_message: rawMessage,
        details: { project: '${app}', ...details },
      }]),
    });
  } catch (err) {
    console.error('[GridSentry] Ingestion error:', err);
  }
}

// Example: Stream an event on page load or user action:
// sendGridSentryLog('user_login_success', 'User alex@example.com signed in', { role: 'admin' });`;

      case 'node':
        return `// ─── Node.js / Express (Zero Dependencies using native fetch) ───
async function logSecurityEvent(eventType, message, details = {}) {
  await fetch('${SERVER_URL}/api/logs/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': '${activeKey}',
    },
    body: JSON.stringify([{
      timestamp: new Date().toISOString(),
      event_type: eventType,
      source_ip: '127.0.0.1',
      raw_message: message,
      details: { app: '${app}', ...details },
    }]),
  });
}

// Log auth or system event:
logSecurityEvent('api_request', 'API endpoint /users requested', { status: 200 });`;

      case 'python':
        return `# ─── Python (Standard requests) ───
import requests
from datetime import datetime, timezone

def log_event(event_type, message, details=None):
    url = "${SERVER_URL}/api/logs/ingest"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": "${activeKey}"
    }
    payload = [{
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "source_ip": "127.0.0.1",
        "raw_message": message,
        "details": details or {"app": "${app}"}
    }]
    requests.post(url, json=payload, headers=headers, timeout=5)

# Example usage:
log_event("user_login_success", "User alex@example.com signed in", {"role": "analyst"})`;

      case 'go':
        return `// ─── Go (Standard library) ───
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "time"
)

func LogEvent(eventType, message string) {
    url := "${SERVER_URL}/api/logs/ingest"
    payload := []map[string]interface{}{
        {
            "timestamp":   time.Now().UTC().Format(time.RFC3339),
            "event_type":  eventType,
            "source_ip":   "127.0.0.1",
            "raw_message": message,
        },
    }
    body, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-API-Key", "${activeKey}")
    http.DefaultClient.Do(req)
}`;

      case 'php':
        return `<?php
// ─── PHP (Zero Dependencies using curl) ───
function log_to_grid_sentry($event_type, $message) {
    $url = '${SERVER_URL}/api/logs/ingest';
    $payload = json_encode([[
        'timestamp'   => gmdate('Y-m-d\\TH:i:s\\Z'),
        'event_type'  => $event_type,
        'source_ip'   => '127.0.0.1',
        'raw_message' => $message,
    ]]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-API-Key: ${activeKey}'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_exec($ch);
    curl_close($ch);
}`;

      case 'curl':
      default:
        return `curl -X POST ${SERVER_URL}/api/logs/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${activeKey}" \\
  -d '[
    {
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "event_type": "user_login_success",
      "source_ip": "127.0.0.1",
      "user_identifier": "alex@example.com",
      "raw_message": "User alex@example.com logged in via API",
      "details": { "source": "${app}" }
    }
  ]'`;
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleDownloadAgentConfig = () => {
    const config = {
      gridsentry: {
        version: '1.0',
        api_key: activeKey,
        endpoint: `${SERVER_URL}/api/logs/ingest`,
        project_name: app,
        batch_size: 50,
        flush_interval_seconds: 5,
        watch_paths: [
          '/var/log/nginx/access.log',
          '/var/log/apache2/access.log',
          '/var/log/auth.log',
          'C:\\inetpub\\logs\\LogFiles\\*.log',
        ],
      },
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gridsentry-agent-${app}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-2xl rounded-xl border border-border-default bg-bg-surface p-6 shadow-2xl relative overflow-hidden space-y-6">
        {/* Progress Header */}
        <div className="flex items-center justify-between border-b border-border-default pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary font-bold text-sm border border-accent-primary/30">
              🔌
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Connect a New Source</h2>
              <p className="text-xs text-text-secondary">Stream live telemetry and security logs in under 1 minute.</p>
            </div>
          </div>

          {/* Stepper pills */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span
              className={`rounded-full px-2.5 py-0.5 border ${
                step === 1
                  ? 'bg-accent-primary text-bg-base border-accent-primary font-bold'
                  : 'bg-bg-surface-raised text-text-secondary border-border-default'
              }`}
            >
              1. Details
            </span>
            <span className="text-text-disabled">›</span>
            <span
              className={`rounded-full px-2.5 py-0.5 border ${
                step === 2
                  ? 'bg-accent-primary text-bg-base border-accent-primary font-bold'
                  : 'bg-bg-surface-raised text-text-secondary border-border-default'
              }`}
            >
              2. Install
            </span>
            <span className="text-text-disabled">›</span>
            <span
              className={`rounded-full px-2.5 py-0.5 border ${
                step === 3
                  ? 'bg-accent-primary text-bg-base border-accent-primary font-bold'
                  : 'bg-bg-surface-raised text-text-secondary border-border-default'
              }`}
            >
              3. Verify
            </span>
          </div>
        </div>

        {/* ── STEP 1: Name & Method Selection ───────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
                Project or Application Name <span className="text-severity-critical">*</span>
              </label>
              <p className="text-xs text-text-secondary">
                Give this source a friendly name to identify where the incoming logs are coming from.
              </p>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Acme Website, Authentication Portal, Payment Worker"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-bg-base px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
                Connection Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('code')}
                  className={`p-3.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    method === 'code'
                      ? 'border-accent-primary bg-accent-primary/10 shadow-sm'
                      : 'border-border-default bg-bg-surface-raised hover:border-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">💻</span>
                    <span className="font-semibold text-xs text-text-primary">In-Code SDK</span>
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1">
                    Direct integration in Node.js, Python, Go, PHP, or Next.js app.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('agent')}
                  className={`p-3.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    method === 'agent'
                      ? 'border-accent-primary bg-accent-primary/10 shadow-sm'
                      : 'border-border-default bg-bg-surface-raised hover:border-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📄</span>
                    <span className="font-semibold text-xs text-text-primary">Log Shipper Agent</span>
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1">
                    Tail existing log files (Nginx, Apache, Syslog) with zero code changes.
                  </p>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border-default bg-bg-base/50 p-3 text-xs text-text-secondary space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-text-primary">
                <span className="text-accent-primary">🔒</span> Private Database & Scoped Isolation
              </p>
              <p>
                An API key will be automatically created and restricted to this project. Raw telemetry event logs flow directly into your private MongoDB (BYODB) when configured, while Grid Sentry only retains connection credentials and event counters.
              </p>
            </div>

            {error && (
              <div className="rounded border border-severity-critical/40 bg-severity-critical/10 p-3 text-xs text-severity-critical">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border-default px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingKey || !projectName.trim()}
                className="rounded-lg bg-accent-primary px-5 py-2 text-xs font-semibold text-bg-base hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
              >
                {creatingKey ? 'Creating Project…' : 'Continue to Integration →'}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 2: Code Snippets & Agent Config ─────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Scoped API Key Banner */}
            <div className="rounded-lg border border-accent-primary/40 bg-accent-primary/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
              <div className="space-y-0.5">
                <div className="text-text-secondary text-[10px] uppercase font-sans font-semibold">
                  API Key Generated for: <strong className="text-text-primary font-mono">{app}</strong>
                </div>
                <div className="text-accent-primary font-bold break-all select-all">{activeKey}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(activeKey)}
                className="shrink-0 self-start sm:self-center rounded bg-accent-primary/20 border border-accent-primary px-3 py-1.5 text-xs text-accent-primary hover:bg-accent-primary hover:text-bg-base transition-colors"
              >
                {copiedSnippet ? '✓ Copied' : 'Copy Key'}
              </button>
            </div>

            {method === 'code' ? (
              <div className="space-y-2">
                {/* Language Tabs */}
                <div className="flex items-center justify-between border-b border-border-default pb-1">
                  <div className="flex flex-wrap gap-1">
                    {(['nextjs', 'node', 'python', 'go', 'php', 'curl'] as Language[]).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setLanguage(lang)}
                        className={`rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                          language === lang
                            ? 'bg-accent-primary text-bg-base font-semibold'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {lang === 'nextjs' ? 'Next.js / React' : lang === 'node' ? 'Node.js' : lang.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(getSnippet())}
                    className="text-xs text-accent-primary hover:underline font-mono"
                  >
                    {copiedSnippet ? '✓ Copied snippet' : 'Copy snippet'}
                  </button>
                </div>

                {/* Snippet Display */}
                <div className="relative rounded-lg border border-border-default bg-bg-base p-3 overflow-x-auto max-h-64">
                  <pre className="text-xs font-mono text-text-primary leading-relaxed whitespace-pre">
                    {getSnippet()}
                  </pre>
                </div>

                {/* Universal script tag option */}
                <div className="rounded border border-border-default bg-bg-surface-raised p-2.5 text-xs space-y-1">
                  <span className="font-semibold text-text-primary flex items-center gap-1.5">
                    <span>🌐</span> Or drop into any HTML / Next.js / Static Site:
                  </span>
                  <pre className="text-[11px] font-mono text-text-secondary overflow-x-auto select-all">
                    {`<script src="${SERVER_URL}/api/sdk/gridsentry.js" data-api-key="${activeKey}" data-app="${app}"></script>`}
                  </pre>
                </div>
              </div>
            ) : (
              /* Agent Log Shipper Setup */
              <div className="space-y-3">
                <div className="rounded-lg border border-border-default bg-bg-base p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-text-primary uppercase font-mono">
                        Grid Sentry Log Shipper
                      </h4>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Download pre-configured JSON configuration for your server daemon.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadAgentConfig}
                      className="rounded bg-accent-primary px-3.5 py-1.5 text-xs font-semibold text-bg-base hover:opacity-90 shadow-sm"
                    >
                      📥 Download Config
                    </button>
                  </div>

                  {/* Linux / macOS / WSL */}
                  <div className="text-[11px] font-mono bg-bg-surface-raised p-2.5 rounded border border-border-default text-text-secondary space-y-1">
                    <p className="text-text-primary font-bold font-sans flex items-center justify-between">
                      <span>🐧 Linux / macOS / WSL Terminal:</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(`curl -sSL ${SERVER_URL}/api/sdk/install-agent.sh | bash -s -- --key ${activeKey} --app ${app}`)}
                        className="text-[10px] text-accent-primary hover:underline font-mono font-normal"
                      >
                        Copy
                      </button>
                    </p>
                    <code className="text-text-primary block overflow-x-auto">curl -sSL {SERVER_URL}/api/sdk/install-agent.sh | bash -s -- --key {activeKey} --app {app}</code>
                  </div>

                  {/* Windows PowerShell */}
                  <div className="text-[11px] font-mono bg-bg-surface-raised p-2.5 rounded border border-border-default text-text-secondary space-y-1">
                    <p className="text-text-primary font-bold font-sans flex items-center justify-between">
                      <span>🪟 Windows PowerShell:</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(`irm "${SERVER_URL}/api/sdk/install-agent.ps1?key=${activeKey}&app=${app}" | iex`)}
                        className="text-[10px] text-accent-primary hover:underline font-mono font-normal"
                      >
                        Copy
                      </button>
                    </p>
                    <code className="text-text-primary block overflow-x-auto">irm "{SERVER_URL}/api/sdk/install-agent.ps1?key={activeKey}&app={app}" | iex</code>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-border-default px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg-surface-raised transition-colors"
              >
                ← Back to Rename
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-lg bg-accent-primary px-5 py-2 text-xs font-semibold text-bg-base hover:opacity-90 transition-opacity shadow-sm"
              >
                Next: Verify Connection Live →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Live Real-Time Verification ─────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6 text-center py-2">
            {statusData?.is_connected ? (
              /* Success / Live Streaming State */
              <div className="space-y-4 animate-scale-in">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-severity-resolved/20 border-2 border-severity-resolved text-severity-resolved text-2xl">
                  ✓
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Source Verified & Connected!</h3>
                  <p className="text-xs text-severity-resolved font-medium mt-0.5">
                    Live telemetry stream established from <strong className="font-mono">{app}</strong>.
                  </p>
                </div>

                <div className="mx-auto max-w-md rounded-lg border border-border-default bg-bg-base p-3.5 font-mono text-xs text-text-secondary space-y-1.5 text-left">
                  <div className="flex justify-between border-b border-border-default/50 pb-1">
                    <span>Project:</span>
                    <span className="text-text-primary font-bold">{app}</span>
                  </div>
                  <div className="flex justify-between border-b border-border-default/50 pb-1">
                    <span>Storage Target:</span>
                    <span className="text-text-primary font-semibold">
                      {statusData.has_tenant_db || statusData.storage_destination === 'tenant_db'
                        ? '🔒 Private MongoDB (BYODB)'
                        : '☁ Cloud SIEM'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border-default/50 pb-1">
                    <span>Telemetry Pipeline:</span>
                    <span className="text-severity-resolved font-semibold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-severity-resolved animate-pulse" />
                      Active (Real-Time)
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border-default/50 pb-1">
                    <span>Events Received:</span>
                    <span className="text-accent-primary font-bold text-sm">
                      {statusData.event_count ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>First Seen:</span>
                    <span className="text-text-primary">
                      {statusData.first_event_at
                        ? new Date(statusData.first_event_at).toLocaleTimeString()
                        : 'Just now'}
                    </span>
                  </div>
                </div>

                {/* Terminal cURL Test Helper */}
                <div className="mx-auto max-w-md rounded-lg border border-border-default bg-bg-surface-raised/60 p-3 text-left space-y-2">
                  <p className="text-[11px] font-semibold text-text-primary flex items-center justify-between">
                    <span>⚡ Stream additional events from your Terminal:</span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          `curl -X POST ${SERVER_URL}/api/logs/ingest -H "Content-Type: application/json" -H "X-API-Key: ${activeKey}" -d '[{"event_type":"live_cli_event","source_ip":"127.0.0.1","raw_message":"Telemetry ping from terminal for ${app}"}]'`
                        )
                      }
                      className="text-[10px] text-accent-primary hover:underline"
                    >
                      {copiedSnippet ? '✓ Copied!' : 'Copy cURL'}
                    </button>
                  </p>
                  <pre className="text-[10px] font-mono bg-bg-base p-2 rounded border border-border-default overflow-x-auto text-text-secondary">
                    {`curl -X POST ${SERVER_URL}/api/logs/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${activeKey}" \\
  -d '[{"event_type":"live_cli_event","raw_message":"Telemetry event for ${app}"}]'`}
                  </pre>
                  <p className="text-[10px] text-text-disabled">
                    Running this in your terminal will immediately increment the <strong>Events Received</strong> counter above!
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      onSuccess();
                      onClose();
                    }}
                    className="rounded-lg bg-accent-primary px-6 py-2.5 text-xs font-semibold text-bg-base hover:opacity-90 shadow transition-opacity"
                  >
                    Done & View Connected Sources
                  </button>
                </div>
              </div>
            ) : (
              /* Waiting / Listening State */
              <div className="space-y-5">
                {/* Live Radar Pulse */}
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-primary/20 opacity-75" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary/10 border border-accent-primary text-accent-primary text-2xl">
                    ⚡
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Waiting for first log event from <span className="text-accent-primary font-mono">{app}</span>…
                  </h3>
                  <p className="text-xs text-text-secondary max-w-md mx-auto mt-1">
                    Send your first event using your code, agent, or run the test command below in your terminal. This screen automatically turns green the moment your first event arrives.
                  </p>
                </div>

                {/* Real Terminal Verification Command */}
                <div className="rounded-lg border border-border-default bg-bg-base/70 p-4 max-w-md mx-auto space-y-2 text-left text-xs font-mono">
                  <div className="flex items-center justify-between font-sans">
                    <span className="text-text-primary font-semibold flex items-center gap-1.5">
                      <span>💻</span> Test Ingestion from Terminal:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          `curl -X POST ${SERVER_URL}/api/logs/ingest -H "Content-Type: application/json" -H "X-API-Key: ${activeKey}" -d '[{"event_type":"cli_test_ping","source_ip":"127.0.0.1","raw_message":"First telemetry event from ${app}"}]'`
                        )
                      }
                      className="text-[10px] text-accent-primary hover:underline font-mono"
                    >
                      {copiedSnippet ? '✓ Copied!' : 'Copy cURL'}
                    </button>
                  </div>
                  <pre className="text-[10px] bg-bg-surface-raised p-2.5 rounded border border-border-default overflow-x-auto text-text-primary">
                    {`curl -X POST ${SERVER_URL}/api/logs/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${activeKey}" \\
  -d '[{"event_type":"cli_test_ping","raw_message":"First telemetry event from ${app}"}]'`}
                  </pre>
                  <p className="text-[11px] font-sans text-text-secondary">
                    Paste and run this command in your terminal to verify end-to-end ingestion with your new API key.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border-default max-w-lg mx-auto">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    ← Back to Snippets
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSuccess();
                      onClose();
                    }}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    I'll send logs later (Close)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
