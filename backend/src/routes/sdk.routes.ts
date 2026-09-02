import { Router } from 'express';

const router = Router();

const GRIDSENTRY_JS_BUNDLE = `/**
 * Grid Sentry Universal Client (Single Drop-in File)
 * Zero dependencies. Works in Browsers, Node.js, Next.js, Express, and Vercel.
 */
(function (global) {
  'use strict';

  var GridSentry = {
    _apiKey: '',
    _baseUrl: 'http://localhost:4000',
    _appName: 'external-website',
    _buffer: [],
    _flushTimer: null,

    /**
     * Initialize the Grid Sentry tracker
     * @param {Object|string} config - Configuration object or API key string
     */
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

    /**
     * Send a raw security or audit log event
     */
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

    /**
     * Log a successful user login
     */
    loginSuccess: function (userEmail, details) {
      this.log('user_login_success', {
        user_identifier: userEmail,
        raw_message: 'User ' + userEmail + ' logged in successfully',
        details: details || {}
      });
    },

    /**
     * Log a failed user login attempt
     */
    loginFailure: function (userEmail, reason, details) {
      var d = details || {};
      if (reason) d.reason = reason;
      this.log('user_login_failed', {
        user_identifier: userEmail,
        raw_message: 'Failed login attempt for ' + userEmail + (reason ? ': ' + reason : ''),
        details: d
      });
    },

    /**
     * Log an error or uncaught exception
     */
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

    /**
     * Immediately flush buffered events to Grid Sentry over HTTP
     */
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

  // Auto-init from script tag attributes if loaded in browser
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

  // Export for CommonJS / ES Modules / Browser Window
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GridSentry;
    module.exports.GridSentry = GridSentry;
    module.exports.gridSentry = GridSentry;
  }
  if (typeof global !== 'undefined') {
    global.GridSentry = GridSentry;
    global.gridSentry = GridSentry;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
`;

const GRIDSENTRY_ESM_BUNDLE = `/**
 * Grid Sentry ES Module Client
 * Zero dependencies. Drop-in for Next.js, Vite, Node ESM, Remix, SvelteKit.
 */
class GridSentryClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = (config.baseUrl || 'http://localhost:4000').replace(/\\/+$/, '');
    this.appName = config.appName || 'my-app';
  }

  async log(eventType, payload = {}) {
    const raw_message = typeof payload === 'string' ? payload : (payload.raw_message || payload.message || ('Event: ' + eventType));
    const event = {
      timestamp: payload.timestamp || new Date().toISOString(),
      event_type: eventType || 'custom_event',
      source_ip: payload.source_ip || payload.ip || '127.0.0.1',
      user_identifier: payload.user_identifier || payload.user || payload.email || undefined,
      raw_message: raw_message,
      details: payload.details || payload.data || {},
    };

    try {
      const res = await fetch(\`\${this.baseUrl}/api/logs/ingest\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify([event]),
      });
      return res.ok;
    } catch (err) {
      console.warn('[GridSentry] Ingest warning:', err);
      return false;
    }
  }
}

export const GridSentry = GridSentryClient;
export default GridSentryClient;
`;

/**
 * GET /api/sdk/gridsentry.js
 * Returns the universal JavaScript file ready for script tags or drop-in import.
 */
router.get('/gridsentry.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(GRIDSENTRY_JS_BUNDLE);
});

/**
 * GET /api/sdk/gridsentry.mjs
 * Returns the ES Module for Next.js / Vite.
 */
router.get('/gridsentry.mjs', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(GRIDSENTRY_ESM_BUNDLE);
});

/**
 * GET /api/sdk/install-agent.sh
 * Serves the Linux/macOS/WSL bash installer script.
 */
router.get('/install-agent.sh', (req, res) => {
  const host = req.get('host') || 'localhost:4000';
  const protocol = req.protocol || 'http';
  const defaultBaseUrl = `${protocol}://${host}`;

  const bashScript = `#!/usr/bin/env bash
set -e

KEY=""
APP="linux-server"
URL="${defaultBaseUrl}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --key)
      KEY="$2"
      shift 2
      ;;
    --app)
      APP="$2"
      shift 2
      ;;
    --url)
      URL="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [ -z "$KEY" ]; then
  echo "[!] Error: Missing required --key argument."
  echo "Usage: curl -sSL ${defaultBaseUrl}/api/sdk/install-agent.sh | bash -s -- --key gs_live_YOUR_KEY [--app my-app]"
  exit 1
fi

echo "========================================================"
echo "          Grid Sentry Log Shipper Installer"
echo "========================================================"
echo "[+] Configuring Grid Sentry Shipper for app: $APP"
echo "[+] Destination: $URL/api/logs/ingest"

CONFIG_DIR="$HOME/.gridsentry"
mkdir -p "$CONFIG_DIR"
CONFIG_FILE="$CONFIG_DIR/agent-$APP.json"

cat <<EOF > "$CONFIG_FILE"
{
  "gridsentry": {
    "version": "1.0",
    "api_key": "$KEY",
    "endpoint": "$URL/api/logs/ingest",
    "project_name": "$APP",
    "batch_size": 50,
    "flush_interval_seconds": 5,
    "watch_paths": [
      "/var/log/nginx/access.log",
      "/var/log/apache2/access.log",
      "/var/log/auth.log",
      "/var/log/syslog"
    ]
  }
}
EOF

echo "[+] Saved configuration to: $CONFIG_FILE"
echo "[+] Testing connection to Grid Sentry endpoint..."

STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL/api/logs/ingest" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: $KEY" \\
  -d '[{"event_type":"agent_connected","source_ip":"127.0.0.1","raw_message":"Grid Sentry Log Shipper connected on host '$(hostname)'"}]')

if [ "$STATUS_CODE" -eq 200 ]; then
  echo ""
  echo "========================================================"
  echo " [✓] SUCCESS! Agent verified & connected successfully."
  echo " [✓] Initial telemetry event received by Grid Sentry."
  echo "========================================================"
else
  echo ""
  echo "[!] Warning: Ingestion returned HTTP status $STATUS_CODE. Check your network connection to $URL."
fi
`;

  res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(bashScript);
});

/**
 * GET /api/sdk/install-agent.ps1
 * Serves the native Windows PowerShell installer script.
 */
router.get('/install-agent.ps1', (req, res) => {
  const host = req.get('host') || 'localhost:4000';
  const protocol = req.protocol || 'http';
  const defaultBaseUrl = `${protocol}://${host}`;
  const queryKey = (req.query.key as string) || '';
  const queryApp = (req.query.app as string) || 'windows-server';

  const psScript = `param(
    [string]$Key = "${queryKey}",
    [string]$App = "${queryApp}",
    [string]$Url = "${defaultBaseUrl}"
)

if (-not $Key) {
    Write-Host "[!] Error: Missing required -Key parameter." -ForegroundColor Red
    Write-Host "Usage: irm '${defaultBaseUrl}/api/sdk/install-agent.ps1?key=gs_live_YOUR_KEY&app=my-app' | iex" -ForegroundColor Yellow
    Exit 1
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          Grid Sentry Log Shipper Installer" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "[+] Configuring Grid Sentry Shipper for app: $App" -ForegroundColor Green
Write-Host "[+] Destination: $Url/api/logs/ingest" -ForegroundColor Gray

$configDir = "$HOME\\.gridsentry"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$configFile = "$configDir\\agent-$App.json"
$config = @{
    gridsentry = @{
        version = "1.0"
        api_key = $Key
        endpoint = "$Url/api/logs/ingest"
        project_name = $App
        batch_size = 50
        flush_interval_seconds = 5
        watch_paths = @("C:\\inetpub\\logs\\LogFiles\\*.log", "C:\\Windows\\System32\\winevt\\Logs\\Security.evtx")
    }
} | ConvertTo-Json -Depth 5

Set-Content -Path $configFile -Value $config -Encoding UTF8
Write-Host "[+] Saved configuration to: $configFile" -ForegroundColor Green
Write-Host "[+] Testing connection to Grid Sentry endpoint..." -ForegroundColor Gray

$body = @(
    @{
        event_type = "agent_connected"
        source_ip = "127.0.0.1"
        raw_message = "Grid Sentry Log Shipper connected on host $env:COMPUTERNAME"
    }
) | ConvertTo-Json -Compress

try {
    $res = Invoke-RestMethod -Uri "$Url/api/logs/ingest" -Method Post -Headers @{ "X-API-Key" = $Key; "Content-Type" = "application/json" } -Body $body
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host " [✓] SUCCESS! Agent verified & connected successfully." -ForegroundColor Green
    Write-Host " [✓] Initial telemetry event received by Grid Sentry." -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "[!] Warning: Ingestion test failed: $_" -ForegroundColor Red
}
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(psScript);
});

/**
 * GET /api/sdk/agent-config
 * Generates a pre-filled log-shipping agent configuration file for download.
 */
router.get('/agent-config', (req, res) => {
  const apiKey = (req.query.key as string) || 'gs_live_YOUR_API_KEY';
  const appName = (req.query.app as string) || 'my-project';
  const baseUrl = (req.query.url as string) || 'http://localhost:4000';

  const config = {
    gridsentry: {
      version: '1.0',
      api_key: apiKey,
      endpoint: `${baseUrl.replace(/\/+$/, '')}/api/logs/ingest`,
      project_name: appName,
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

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="gridsentry-agent-${appName}.json"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(JSON.stringify(config, null, 2));
});

export default router;
