/**
 * Grid Sentry Client SDK (TICKET-015).
 * Server-side log ingestion client library for external Node.js applications.
 *
 * WARNING: This library MUST ONLY be executed server-side in Node.js environments.
 * DO NOT bundle or execute this library in browser code as it holds sensitive API keys.
 */

export interface GridSentryConfig {
  /** Base URL of the Grid Sentry API server (e.g. 'http://localhost:4000') */
  baseUrl: string;
  /** Secret API Key for log ingestion authentication (X-API-Key header) */
  apiKey: string;
  /** Enable memory queue request batching (default: false) */
  batching?: boolean;
  /** Flush interval in milliseconds when batching is enabled (default: 3000ms) */
  flushIntervalMs?: number;
  /** Optional error callback for observing swallowed delivery failures */
  onError?: (error: Error) => void;
}

export interface LogDetails {
  /** Optional ISO timestamp (auto-generated if omitted) */
  timestamp?: string;
  /** Source IP address of the client/requester */
  source_ip?: string;
  /** User account identifier (email, username, user ID) */
  user_identifier?: string;
  /** Raw log message text */
  raw_message?: string;
  /** Additional structured event metadata */
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LogEventPayload {
  timestamp: string;
  event_type: string;
  source_ip?: string;
  user_identifier?: string;
  raw_message?: string;
  details?: Record<string, unknown>;
}

export class GridSentryClient {
  private config: GridSentryConfig | null = null;
  private queue: LogEventPayload[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize Grid Sentry Client SDK configuration.
   * Must be called once before log() is invoked.
   */
  public init(config: GridSentryConfig): void {
    if (typeof window !== 'undefined') {
      throw new Error(
        '[Grid Sentry SDK Warning] grid-sentry-client is designed for server-side Node.js usage only and must never be bundled into browser code.',
      );
    }

    if (!config || typeof config !== 'object') {
      throw new Error('gridSentry.init() requires a valid configuration object.');
    }

    const baseUrl = (config.baseUrl ?? '').trim().replace(/\/+$/, '');
    const apiKey = (config.apiKey ?? '').trim();

    if (!baseUrl || !apiKey) {
      throw new Error(
        'gridSentry.init() requires a non-empty baseUrl (e.g. "http://localhost:4000") and apiKey.',
      );
    }

    this.config = {
      baseUrl,
      apiKey,
      batching: Boolean(config.batching),
      flushIntervalMs: config.flushIntervalMs && config.flushIntervalMs > 0 ? config.flushIntervalMs : 3000,
      onError: config.onError,
    };

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.config.batching) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(() => {});
      }, this.config.flushIntervalMs);
    }
  }

  /**
   * Ingest a security event.
   * Client-side param validation throws during development.
   * Network & server errors are caught internally and never crash calling code.
   */
  public log(eventType: string, details: LogDetails = {}): void {
    if (!this.config) {
      throw new Error(
        'gridSentry.log() called before gridSentry.init(). Call init({ baseUrl, apiKey }) first.',
      );
    }

    if (!eventType || typeof eventType !== 'string' || !eventType.trim()) {
      throw new Error('gridSentry.log() requires a non-empty string eventType parameter.');
    }

    const payload: LogEventPayload = {
      timestamp: details.timestamp || new Date().toISOString(),
      event_type: eventType.trim(),
      source_ip: details.source_ip || '127.0.0.1',
      user_identifier: details.user_identifier,
      raw_message: details.raw_message || `[SDK] ${eventType.trim()} event logged`,
      details: details.details || {},
    };

    if (this.config.batching) {
      this.queue.push(payload);
    } else {
      // Fire-and-forget immediate send
      this.sendPayloads([payload]).catch(() => {});
    }
  }

  /**
   * Manually flush queued batched log events immediately.
   */
  public async flush(): Promise<void> {
    if (!this.config || this.queue.length === 0) return;

    const itemsToSend = [...this.queue];
    this.queue = [];

    await this.sendPayloads(itemsToSend);
  }

  /**
   * Internal helper: sends payloads with 1 automatic retry and fire-and-forget error safety.
   */
  private async sendPayloads(payloads: LogEventPayload[]): Promise<void> {
    if (!this.config || payloads.length === 0) return;

    const targetUrl = `${this.config.baseUrl}/api/logs/ingest`;

    const attemptSend = async (): Promise<boolean> => {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config!.apiKey,
        },
        body: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads),
      });

      return res.ok;
    };

    try {
      const success = await attemptSend();
      if (!success) {
        // 1 automatic retry after 200ms
        await new Promise((resolve) => setTimeout(resolve, 200));
        const retrySuccess = await attemptSend();
        if (!retrySuccess && this.config.onError) {
          this.config.onError(new Error(`Grid Sentry API returned non-2xx response for ${payloads.length} events.`));
        }
      }
    } catch (err) {
      // Catch and swallow network errors — never throw into calling app
      try {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await attemptSend();
      } catch (retryErr) {
        if (this.config.onError) {
          const finalErr = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
          this.config.onError(finalErr);
        }
      }
    }
  }

  /**
   * Reset client instance state (utility for unit tests).
   */
  public reset(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.config = null;
    this.queue = [];
  }
}
