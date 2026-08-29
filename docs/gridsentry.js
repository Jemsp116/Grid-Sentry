/**
 * Grid Sentry Universal Client (Single Drop-in File)
 * Zero external dependencies. Works in Browsers, Node.js, Next.js, Express, and Vercel.
 *
 * Usage in HTML / Browser:
 *   <script src="http://localhost:4000/api/sdk/gridsentry.js" data-api-key="YOUR_API_KEY" data-app="my-site"></script>
 *
 * Usage in Node.js / Express / Next.js:
 *   const GridSentry = require('./gridsentry.js');
 *   GridSentry.init({ apiKey: process.env.GRID_SENTRY_API_KEY, baseUrl: 'http://localhost:4000' });
 *   GridSentry.loginFailure('user@example.com', 'Incorrect password');
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
     * Initialize Grid Sentry tracker
     * @param {Object|string} config - Configuration options or API key
     */
    init: function (config) {
      if (!config) config = {};
      if (typeof config === 'string') config = { apiKey: config };
      this._apiKey = config.apiKey || this._apiKey || '';
      this._baseUrl = (config.baseUrl || this._baseUrl || '').replace(/\/+$/, '');
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
     * Flush buffered events to Grid Sentry over HTTP
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
