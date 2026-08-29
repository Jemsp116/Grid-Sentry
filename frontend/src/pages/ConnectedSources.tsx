import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKeyItem,
  type CreatedApiKeyResponse,
} from '../api/apiKeys.js';

export default function ConnectedSources() {
  const { authFetch, user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Integration guide tab state
  const [activeGuideTab, setActiveGuideTab] = useState<'script' | 'nextjs' | 'express' | 'file'>('script');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Generate modal state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [appNameInput, setAppNameInput] = useState('');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // New key display modal state
  const [createdKeyData, setCreatedKeyData] = useState<CreatedApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke modal state
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Selected key for code snippets
  const activeApiKey = createdKeyData?.raw_key || 'gs_live_YOUR_API_KEY';

  const loadKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApiKeys(authFetch);
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appNameInput.trim()) return;

    try {
      setGenerating(true);
      setGenerateError(null);
      const newKey = await createApiKey(authFetch, appNameInput.trim());
      setCreatedKeyData(newKey);
      setIsGenerateOpen(false);
      setAppNameInput('');
      loadKeys();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyKey = () => {
    if (!createdKeyData) return;
    navigator.clipboard.writeText(createdKeyData.raw_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke) return;
    try {
      setRevoking(true);
      await revokeApiKey(authFetch, keyToRevoke.id);
      setKeyToRevoke(null);
      loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevoking(false);
    }
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const scriptTagSnippet = `<!-- 1. Paste this single script tag into your website <head> -->
<script 
  src="http://localhost:4000/api/sdk/gridsentry.js" 
  data-api-key="${activeApiKey}" 
  data-app="my-website">
</script>

<!-- 2. That's it! All website errors are captured automatically. -->
<!-- Optional: Call helper methods anywhere in your JavaScript: -->
<script>
  // When user logs in successfully:
  GridSentry.loginSuccess('user@example.com');

  // When login fails:
  GridSentry.loginFailure('user@example.com', 'Incorrect password');

  // Log custom security event:
  GridSentry.log('password_reset_requested', { user_identifier: 'user@example.com' });
</script>`;

  const nextjsSnippet = `// 1. Download gridsentry.js and place it in your project (e.g. src/utils/gridsentry.js)
// 2. Import and use anywhere in Next.js / React / Vercel API routes:

import GridSentry from '@/utils/gridsentry.js';

// Initialize with your API key (or set process.env.GRID_SENTRY_API_KEY)
GridSentry.init({
  apiKey: process.env.GRID_SENTRY_API_KEY || '${activeApiKey}',
  baseUrl: process.env.GRID_SENTRY_URL || 'http://localhost:4000',
  appName: 'my-nextjs-app'
});

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (password !== 'secret123') {
    // Automatically logs to Grid Sentry SOC Dashboard
    GridSentry.loginFailure(email, 'Invalid password');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  GridSentry.loginSuccess(email);
  return Response.json({ success: true });
}`;

  const expressSnippet = `// 1. Download gridsentry.js into your project directory
// 2. Import into your Express / Node.js backend:

const express = require('express');
const GridSentry = require('./gridsentry.js');

GridSentry.init({
  apiKey: process.env.GRID_SENTRY_API_KEY || '${activeApiKey}',
  baseUrl: process.env.GRID_SENTRY_URL || 'http://localhost:4000',
  appName: 'my-express-api'
});

const app = express();
app.use(express.json());

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    GridSentry.loginFailure(email || 'anonymous', 'Missing credentials');
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  GridSentry.loginSuccess(email);
  res.json({ token: 'jwt_token_here' });
});`;

  const standaloneFileCode = `/**
 * Grid Sentry Universal Client (Single Drop-in File)
 * Zero external dependencies. Works in Browsers, Node.js, Next.js, Express, and Vercel.
 */
(function (global) {
  'use strict';

  var GridSentry = {
    _apiKey: '${activeApiKey}',
    _baseUrl: 'http://localhost:4000',
    _appName: 'external-website',
    _buffer: [],
    _flushTimer: null,

    init: function (config) {
      if (!config) config = {};
      if (typeof config === 'string') config = { apiKey: config };
      this._apiKey = config.apiKey || this._apiKey || '';
      this._baseUrl = (config.baseUrl || this._baseUrl || '').replace(/\\/+$/, '');
      this._appName = config.appName || this._appName || 'external-website';

      if (typeof window !== 'undefined' && config.autoCaptureErrors !== false) {
        this._setupAutoCapture();
      }
      return this;
    },

    log: function (eventType, payload) {
      if (!payload) payload = {};
      if (typeof payload === 'string') payload = { raw_message: payload };

      var event = {
        timestamp: payload.timestamp || new Date().toISOString(),
        event_type: eventType || 'custom_event',
        source_ip: payload.source_ip || payload.ip || '127.0.0.1',
        user_identifier: payload.user_identifier || payload.user || payload.email || undefined,
        raw_message: payload.raw_message || payload.message || ('Event: ' + eventType),
        details: payload.details || payload.data || {}
      };

      this._buffer.push(event);
      this._scheduleFlush();
    },

    loginSuccess: function (userEmail, details) {
      this.log('user_login_success', {
        user_identifier: userEmail,
        raw_message: 'User ' + userEmail + ' logged in successfully',
        details: details || {}
      });
    },

    loginFailure: function (userEmail, reason, details) {
      var d = details || {};
      if (reason) d.reason = reason;
      this.log('user_login_failed', {
        user_identifier: userEmail,
        raw_message: 'Failed login attempt for ' + userEmail + (reason ? ': ' + reason : ''),
        details: d
      });
    },

    error: function (err, details) {
      var msg = (err && err.message) ? err.message : String(err);
      var stack = (err && err.stack) ? err.stack : undefined;
      var d = details || {};
      if (stack) d.stack = stack;
      this.log('client_error', {
        raw_message: 'Error: ' + msg,
        details: d
      });
    },

    _scheduleFlush: function () {
      var self = this;
      if (this._flushTimer) return;
      this._flushTimer = setTimeout(function () {
        self._flushTimer = null;
        self.flush();
      }, 300);
    },

    flush: function () {
      if (this._buffer.length === 0) return;
      var items = this._buffer.slice();
      this._buffer = [];

      var url = this._baseUrl + '/api/logs/ingest';
      var headers = {
        'Content-Type': 'application/json',
        'X-API-Key': this._apiKey
      };

      try {
        if (typeof fetch === 'function') {
          fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(items),
            mode: 'cors',
            credentials: 'omit',
            keepalive: true
          }).catch(function () {});
        }
      } catch (e) {}
    },

    _setupAutoCapture: function () {
      var self = this;
      if (typeof window !== 'undefined') {
        window.addEventListener('error', function (e) {
          self.error(e.error || e.message, { filename: e.filename, lineno: e.lineno, colno: e.colno });
        });
        window.addEventListener('unhandledrejection', function (e) {
          self.error(e.reason || 'Unhandled Promise Rejection');
        });
      }
    }
  };

  if (typeof document !== 'undefined') {
    var script = document.currentScript || document.querySelector('script[data-api-key]');
    if (script) {
      var key = script.getAttribute('data-api-key');
      var base = script.getAttribute('data-base-url') || script.src.split('/api/sdk')[0] || window.location.origin;
      var app = script.getAttribute('data-app') || 'web-app';
      if (key) {
        GridSentry.init({ apiKey: key, baseUrl: base, appName: app });
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GridSentry;
    module.exports.GridSentry = GridSentry;
    module.exports.gridSentry = GridSentry;
  }
  if (typeof global !== 'undefined') {
    global.GridSentry = GridSentry;
    global.gridSentry = GridSentry;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);`;

  const handleDownloadFile = () => {
    const blob = new Blob([standaloneFileCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gridsentry.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Connected Sources & API Keys</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Connect any website or backend to Grid Sentry using a single file or script tag.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setGenerateError(null);
              setIsGenerateOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded bg-accent-primary px-4 py-2 text-xs font-medium text-text-inverse hover:bg-accent-primary/90 transition-colors shadow-sm"
          >
            <span>+</span> Generate New API Key
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-severity-critical/30 bg-severity-critical/10 p-4 text-xs text-severity-critical">
          {error}
        </div>
      )}

      {/* ── Ultra-Simple 1-Step Integration Card ───────────────────────────── */}
      <div className="rounded-lg border border-accent-primary/30 bg-bg-surface p-6 shadow-md space-y-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-default pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent-primary/10 text-accent-primary text-[11px] font-mono font-semibold mb-2">
              <span>⚡</span> 1-Step Integration
            </div>
            <h2 className="text-lg font-bold text-text-primary">
              Connect Your Website in 10 Seconds
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Zero complicated setup. Add one file or one script tag to your website to stream live security logs into this dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadFile}
              className="flex items-center gap-2 rounded-md bg-accent-primary px-4 py-2 text-xs font-semibold text-text-inverse hover:bg-accent-primary/90 transition-all shadow"
            >
              <span>📥</span> Download gridsentry.js
            </button>
          </div>
        </div>

        {/* 3 Simple Visual Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="rounded-md border border-border-default bg-bg-surface-raised p-4 space-y-2">
            <div className="flex items-center gap-2 text-accent-primary font-bold text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary text-text-inverse text-xs">1</span>
              <span>Get the File</span>
            </div>
            <p className="text-xs font-sans text-text-secondary leading-relaxed">
              Click <strong>"Download gridsentry.js"</strong> or copy the 1-line script tag below.
            </p>
          </div>

          <div className="rounded-md border border-border-default bg-bg-surface-raised p-4 space-y-2">
            <div className="flex items-center gap-2 text-accent-primary font-bold text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary text-text-inverse text-xs">2</span>
              <span>Add to Your Website</span>
            </div>
            <p className="text-xs font-sans text-text-secondary leading-relaxed">
              Drop <code className="text-accent-primary">gridsentry.js</code> into your website (HTML, React, Next.js, Express, or Vercel).
            </p>
          </div>

          <div className="rounded-md border border-border-default bg-bg-surface-raised p-4 space-y-2">
            <div className="flex items-center gap-2 text-severity-low font-bold text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-severity-low text-white text-xs">3</span>
              <span>Done!</span>
            </div>
            <p className="text-xs font-sans text-text-secondary leading-relaxed">
              All logins, errors, and security events flow directly into <strong>Log Explorer</strong> and trigger SOC alerts!
            </p>
          </div>
        </div>

        {/* Code Snippets Tabs */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-1">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveGuideTab('script')}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeGuideTab === 'script'
                    ? 'border-accent-primary text-accent-primary font-bold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>🌐</span> 1-Line HTML Script Tag
              </button>
              <button
                onClick={() => setActiveGuideTab('nextjs')}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeGuideTab === 'nextjs'
                    ? 'border-accent-primary text-accent-primary font-bold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>⚡</span> React / Next.js / Vercel
              </button>
              <button
                onClick={() => setActiveGuideTab('express')}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeGuideTab === 'express'
                    ? 'border-accent-primary text-accent-primary font-bold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>🚀</span> Node.js / Express Backend
              </button>
              <button
                onClick={() => setActiveGuideTab('file')}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeGuideTab === 'file'
                    ? 'border-accent-primary text-accent-primary font-bold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>📄</span> View gridsentry.js Code
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const code =
                    activeGuideTab === 'script'
                      ? scriptTagSnippet
                      : activeGuideTab === 'nextjs'
                      ? nextjsSnippet
                      : activeGuideTab === 'express'
                      ? expressSnippet
                      : standaloneFileCode;
                  handleCopySnippet(code);
                }}
                className="rounded border border-border-default bg-bg-surface px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary transition-colors flex items-center gap-1"
              >
                <span>📋</span> {copiedSnippet ? 'Copied!' : 'Copy Snippet'}
              </button>
            </div>
          </div>

          <div className="relative rounded-md border border-border-default bg-bg-surface-raised p-4 font-mono text-xs overflow-x-auto text-text-primary">
            <pre className="whitespace-pre">
              {activeGuideTab === 'script' && scriptTagSnippet}
              {activeGuideTab === 'nextjs' && nextjsSnippet}
              {activeGuideTab === 'express' && expressSnippet}
              {activeGuideTab === 'file' && standaloneFileCode}
            </pre>
          </div>
        </div>
      </div>

      {/* Active API Keys Table Card */}
      <div className="rounded-lg border border-border-default bg-bg-surface overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border-default bg-bg-surface-raised/40 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
            Active Connected API Keys ({keys.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-secondary">
            No API keys generated yet. Click "Generate New API Key" above to create an API key for your website.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-default bg-bg-surface-raised font-mono text-text-secondary uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">App Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last Used</th>
                  <th className="px-5 py-3">Created At</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default font-mono">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-bg-surface-raised/50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-text-primary">{k.app_name}</td>
                    <td className="px-5 py-3">
                      {k.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-severity-low/10 px-2.5 py-0.5 text-[11px] font-medium text-severity-low">
                          <span className="h-1.5 w-1.5 rounded-full bg-severity-low" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-text-secondary/10 px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
                          <span className="h-1.5 w-1.5 rounded-full bg-text-secondary" />
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {new Date(k.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right font-sans">
                      {isAdmin && k.is_active && (
                        <button
                          onClick={() => setKeyToRevoke(k)}
                          className="rounded border border-severity-critical/30 bg-severity-critical/10 px-2.5 py-1 text-xs text-severity-critical hover:bg-severity-critical/20 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Generate Key Form */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-border-default bg-bg-surface p-6 shadow-xl">
            <h2 className="text-base font-semibold text-text-primary">Generate API Key</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Enter the name of your website or service connecting to Grid Sentry.
            </p>

            <form onSubmit={handleGenerateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Website / App Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. my-vercel-site, auth-portal"
                  value={appNameInput}
                  onChange={(e) => setAppNameInput(e.target.value)}
                  className="w-full rounded border border-border-default bg-bg-surface-raised px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-accent-primary focus:outline-none font-mono"
                />
              </div>

              {generateError && (
                <div className="rounded border border-severity-critical/30 bg-severity-critical/10 p-3 text-xs text-severity-critical">
                  {generateError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGenerateOpen(false)}
                  className="rounded border border-border-default px-3.5 py-1.5 text-xs text-text-secondary hover:bg-bg-surface-raised transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating || !appNameInput.trim()}
                  className="rounded bg-accent-primary px-3.5 py-1.5 text-xs font-medium text-text-inverse hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
                >
                  {generating ? 'Generating...' : 'Generate Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Raw Key Display (Shown ONCE) */}
      {createdKeyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-accent-primary/40 bg-bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-accent-primary">
              <span className="text-xl">🔑</span>
              <h2 className="text-base font-semibold">API Key Generated</h2>
            </div>

            <div className="rounded border border-severity-high/40 bg-severity-high/10 p-3 text-xs text-severity-high">
              <strong>IMPORTANT:</strong> Copy your API key now. It is pre-filled in your integration snippets and will not be displayed again.
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                App Name: <span className="text-text-primary font-mono">{createdKeyData.app_name}</span>
              </label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  readOnly
                  value={createdKeyData.raw_key}
                  className="flex-1 rounded border border-border-default bg-bg-surface-raised px-3 py-2 font-mono text-xs text-accent-primary select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="rounded bg-accent-primary px-3.5 py-2 text-xs font-medium text-text-inverse hover:bg-accent-primary/90 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setCreatedKeyData(null)}
                className="rounded border border-border-default px-4 py-2 text-xs font-medium text-text-primary hover:bg-bg-surface-raised transition-colors"
              >
                I have saved this key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Revoke */}
      {keyToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-border-default bg-bg-surface p-6 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-text-primary">Revoke API Key</h2>
            <p className="text-xs text-text-secondary">
              Are you sure you want to revoke the API key for{' '}
              <strong className="text-text-primary font-mono">{keyToRevoke.app_name}</strong>? Any external application using this key will immediately be blocked from sending logs.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setKeyToRevoke(null)}
                className="rounded border border-border-default px-3.5 py-1.5 text-xs text-text-secondary hover:bg-bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={revoking}
                className="rounded bg-severity-critical px-3.5 py-1.5 text-xs font-medium text-white hover:bg-severity-critical/90 disabled:opacity-50 transition-colors"
              >
                {revoking ? 'Revoking...' : 'Revoke Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
