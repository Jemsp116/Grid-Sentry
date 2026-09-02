import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  createApiKey,
  fetchApiKeyStatus,
  sendSampleLogEvent,
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
type Language = 'node' | 'python' | 'go' | 'php' | 'curl';

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
  const [language, setLanguage] = useState<Language>('node');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Step 3 State
  const [statusData, setStatusData] = useState<ApiKeyStatusResponse | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
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
      setLanguage('node');
      setStatusData(null);
      setTestSent(false);
    }
  }, [isOpen]);

  // Polling for Step 3
  const pollStatus = useCallback(async () => {
    if (!keyData) return;
    try {
      const res = await fetchApiKeyStatus(authFetch, keyData.id);
      setStatusData(res);
      if (res.is_connected) {
        if (pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    } catch {
      // Ignore polling errors
    }
  }, [authFetch, keyData]);

  useEffect(() => {
    if (step === 3 && keyData && !statusData?.is_connected) {
      pollStatus();
      pollTimerRef.current = window.setInterval(pollStatus, 2000);
    }
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [step, keyData, statusData?.is_connected, pollStatus]);

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
      case 'node':
        return `// 1. Install official Grid Sentry Node.js SDK:
// npm install grid-sentry-client

import { GridSentry } from 'grid-sentry-client';

// 2. Initialize with your project-scoped API key:
const sentry = new GridSentry({
  apiKey: '${activeKey}',
  baseUrl: '${SERVER_URL}',
  appName: '${app}',
});

// 3. Log security, auth, and system events anywhere in your app:
sentry.log('user_login_success', {
  user_identifier: 'alex@example.com',
  raw_message: 'User alex@example.com signed in',
  details: { role: 'operator', ip: '192.168.1.5' },
});`;

      case 'python':
        return `# 1. Install official Grid Sentry Python SDK:
# pip install grid-sentry-client

from grid_sentry import GridSentry

# 2. Initialize with your project-scoped API key:
sentry = GridSentry(
    api_key="${activeKey}",
    base_url="${SERVER_URL}",
    app_name="${app}",
)

# 3. Stream telemetry directly to your SOC dashboard:
sentry.log(
    event_type="user_login_success",
    user_identifier="alex@example.com",
    raw_message="User logged in from web portal",
    details={"mfa_used": True},
)`;

      case 'go':
        return `// 1. Add official Grid Sentry Go module:
// go get github.com/gridsentry/gridsentry-go

package main

import (
    "github.com/gridsentry/gridsentry-go"
)

func main() {
    // 2. Initialize with your project-scoped API key:
    sentry := gridsentry.NewClient(gridsentry.Config{
        ApiKey:  "${activeKey}",
        BaseURL: "${SERVER_URL}",
        AppName: "${app}",
    })
    defer sentry.Close()

    // 3. Fire-and-forget security events:
    sentry.Log("user_login_success", gridsentry.Payload{
        UserIdentifier: "alex@example.com",
        RawMessage:     "User signed in via API",
    })
}`;

      case 'php':
        return `<?php
// 1. Install via Composer:
// composer require grid-sentry/client

use GridSentry\\Client as GridSentry;

// 2. Initialize with your project-scoped API key:
$sentry = new GridSentry([
    'apiKey'  => '${activeKey}',
    'baseUrl' => '${SERVER_URL}',
    'appName' => '${app}',
]);

// 3. Log events:
$sentry->log('user_login_success', [
    'user_identifier' => 'alex@example.com',
    'raw_message'     => 'User signed in',
]);`;

      case 'curl':
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

  const handleSendTestProbe = async () => {
    if (!keyData) return;
    setSendingTest(true);
    try {
      await sendSampleLogEvent(keyData.raw_key, app);
      setTestSent(true);
      await pollStatus();
    } catch {
      // Handled
    } finally {
      setSendingTest(false);
    }
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
              className={`px-2.5 py-1 rounded-full border ${
                step === 1
                  ? 'bg-accent-primary text-bg-base font-bold border-accent-primary'
                  : 'bg-bg-surface-raised text-text-secondary border-border-default'
              }`}
            >
              1. Name
            </span>
            <span className="text-border-default">──</span>
            <span
              className={`px-2.5 py-1 rounded-full border ${
                step === 2
                  ? 'bg-accent-primary text-bg-base font-bold border-accent-primary'
                  : 'bg-bg-surface-raised text-text-secondary border-border-default'
              }`}
            >
              2. Setup
            </span>
            <span className="text-border-default">──</span>
            <span
              className={`px-2.5 py-1 rounded-full border ${
                step === 3
                  ? 'bg-accent-primary text-bg-base font-bold border-accent-primary'
                  : 'bg-bg-surface-raised text-text-secondary border-border-default'
              }`}
            >
              3. Verify
            </span>
          </div>
        </div>

        {/* ── STEP 1: Project Name ────────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Project / Application Name *
              </label>
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

            <div className="rounded-lg border border-border-default bg-bg-base/50 p-3 text-xs text-text-secondary">
              <p className="flex items-center gap-1.5 font-medium text-text-primary mb-0.5">
                <span className="text-accent-primary">🔒</span> Scoped Multi-Tenant Isolation
              </p>
              An API key will be automatically created and restricted to this project and your organization. One project's credentials can never access or modify another project's telemetry.
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

        {/* ── STEP 2: Plain-Language Branching ────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Plain language question card */}
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-2">
                How would you like to connect <span className="text-accent-primary font-mono">{app}</span>?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('code')}
                  className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
                    method === 'code'
                      ? 'border-accent-primary bg-accent-primary/10 shadow-sm'
                      : 'border-border-default bg-bg-base/60 hover:bg-bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                      <span>💻</span> Developer Code
                    </span>
                    {method === 'code' && (
                      <span className="h-2 w-2 rounded-full bg-accent-primary" />
                    )}
                  </div>
                  <p className="text-xs text-text-secondary">
                    Add 3 lines of code in Node.js, Python, Go, PHP, or cURL.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('agent')}
                  className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
                    method === 'agent'
                      ? 'border-accent-primary bg-accent-primary/10 shadow-sm'
                      : 'border-border-default bg-bg-base/60 hover:bg-bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                      <span>📄</span> Point at Log Files
                    </span>
                    {method === 'agent' && (
                      <span className="h-2 w-2 rounded-full bg-accent-primary" />
                    )}
                  </div>
                  <p className="text-xs text-text-secondary">
                    No code required. Download our pre-configured log-shipping agent.
                  </p>
                </button>
              </div>
            </div>

            {/* Branch A: Developer Code Snippets */}
            {method === 'code' ? (
              <div className="space-y-3">
                {/* Language Picker */}
                <div className="flex items-center justify-between border-b border-border-default pb-1">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {(['node', 'python', 'go', 'php', 'curl'] as Language[]).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={`px-3 py-1.5 text-xs font-mono font-medium rounded-t-lg transition-colors ${
                          language === lang
                            ? 'bg-bg-surface-raised text-accent-primary border-t-2 border-accent-primary font-bold'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {lang === 'node'
                          ? 'Node.js'
                          : lang === 'python'
                          ? 'Python'
                          : lang === 'go'
                          ? 'Go'
                          : lang === 'php'
                          ? 'PHP'
                          : 'cURL / Other'}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleCopy(getSnippet())}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent-primary px-2.5 py-1 rounded border border-border-default bg-bg-surface"
                  >
                    <span>📋</span>
                    <span>{copiedSnippet ? 'Copied!' : 'Copy Snippet'}</span>
                  </button>
                </div>

                {/* Pre-filled Code Snippet */}
                <div className="relative rounded-lg border border-border-default bg-bg-base p-4 font-mono text-xs overflow-x-auto text-text-primary max-h-56">
                  <pre className="whitespace-pre">{getSnippet()}</pre>
                </div>
              </div>
            ) : (
              /* Branch B: No-Code Agent Download */
              <div className="rounded-lg border border-border-default bg-bg-base/70 p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono mb-1">
                    Pre-Configured Log-Shipping Agent
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Your credentials and endpoint are already embedded. Simply download the config file and point the agent at your log folders:
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadAgentConfig}
                    className="flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2.5 text-xs font-semibold text-bg-base hover:opacity-90 shadow"
                  >
                    <span>📥</span>
                    <span>Download gridsentry-agent-{app}.json</span>
                  </button>
                </div>

                <div className="rounded border border-border-default bg-bg-surface p-3 text-xs font-mono text-text-secondary space-y-1">
                  <p className="text-text-primary font-semibold">Run on your server / container:</p>
                  <code className="block text-accent-primary">
                    npx @gridsentry/agent --config gridsentry-agent-{app}.json
                  </code>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border-default">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-text-secondary hover:text-text-primary"
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
          <div className="space-y-6 text-center py-4">
            {statusData?.is_connected ? (
              /* Success State */
              <div className="space-y-4 animate-scale-in">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-severity-resolved/20 border-2 border-severity-resolved text-severity-resolved text-3xl">
                  ✓
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Connected Successfully!</h3>
                  <p className="text-xs text-severity-resolved font-medium mt-1">
                    First log event received from <strong>{app}</strong>. Telemetry is streaming live.
                  </p>
                </div>

                <div className="mx-auto max-w-sm rounded-lg border border-border-default bg-bg-base p-3 font-mono text-xs text-text-secondary space-y-1">
                  <div className="flex justify-between">
                    <span>Project:</span>
                    <span className="text-text-primary font-bold">{app}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Events Received:</span>
                    <span className="text-accent-primary font-bold">{statusData.event_count || 1}</span>
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

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      onSuccess();
                      onClose();
                    }}
                    className="rounded-lg bg-accent-primary px-6 py-2.5 text-xs font-semibold text-bg-base hover:opacity-90 shadow"
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
                    Send your first event using the code snippet or agent config from Step 2. This screen updates the moment an event arrives.
                  </p>
                </div>

                {/* Instant In-Browser Test Probe */}
                <div className="rounded-lg border border-border-default bg-bg-base/70 p-4 max-w-md mx-auto space-y-2 text-left text-xs">
                  <p className="text-text-primary font-semibold flex items-center gap-1.5">
                    <span>🧪</span> Don't have your app open right now?
                  </p>
                  <p className="text-text-secondary">
                    Send a 1-click verification probe using your new API key to test the ingestion pipeline instantly:
                  </p>
                  <button
                    onClick={handleSendTestProbe}
                    disabled={sendingTest}
                    className="w-full rounded-md bg-bg-surface-raised border border-border-default py-2 text-xs font-semibold text-accent-primary hover:border-accent-primary transition-colors disabled:opacity-50"
                  >
                    {sendingTest
                      ? 'Sending Test Event…'
                      : testSent
                      ? '✓ Test Event Sent! Checking…'
                      : '⚡ Send 1-Click Test Event Now'}
                  </button>
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
                    I'll connect later (Close)
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
