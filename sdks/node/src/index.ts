/**
 * Grid Sentry Client SDK for Node.js / TypeScript
 *
 * Server-side client for streaming security, authentication, and application
 * telemetry into the Grid Sentry SOC & SIEM platform.
 *
 * @warning Server-side only. Do NOT use in client-side browser bundles where
 * secret API keys could be leaked.
 */

export interface GridSentryConfig {
  apiKey: string;
  baseUrl?: string;
  appName?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  disabled?: boolean;
}

export interface LogPayload {
  timestamp?: string;
  source_ip?: string;
  user_identifier?: string;
  raw_message?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface IngestEvent {
  timestamp: string;
  event_type: string;
  source_ip: string;
  user_identifier?: string;
  raw_message: string;
  details: Record<string, unknown>;
}

export class GridSentry {
  private static defaultInstance: GridSentry | null = null;

  private apiKey: string;
  private baseUrl: string;
  private appName: string;
  private batchSize: number;
  private flushIntervalMs: number;
  private disabled: boolean;

  private buffer: IngestEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;

  constructor(config: GridSentryConfig) {
    if (!config || !config.apiKey) {
      throw new Error('[GridSentry] Missing required "apiKey" configuration.');
    }

    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || 'http://localhost:4000').replace(/\/+$/, '');
    this.appName = config.appName || 'node-service';
    this.batchSize = config.batchSize && config.batchSize > 0 ? config.batchSize : 25;
    this.flushIntervalMs = config.flushIntervalMs && config.flushIntervalMs > 0 ? config.flushIntervalMs : 300;
    this.disabled = Boolean(config.disabled);
  }

  /**
   * Static singleton initializer for convenience.
   */
  public static init(config: GridSentryConfig): GridSentry {
    const instance = new GridSentry(config);
    GridSentry.defaultInstance = instance;
    return instance;
  }

  /**
   * Get current initialized singleton instance.
   */
  public static get instance(): GridSentry {
    if (!GridSentry.defaultInstance) {
      throw new Error(
        '[GridSentry] GridSentry is not initialized. Please call GridSentry.init({ apiKey: "..." }) before calling static methods.',
      );
    }
    return GridSentry.defaultInstance;
  }

  /**
   * Log an event using the singleton instance.
   */
  public static log(eventType: string, payload?: LogPayload | string): void {
    GridSentry.instance.log(eventType, payload);
  }

  /**
   * Log a general telemetry, security, or audit event.
   */
  public log(eventType: string, payload?: LogPayload | string): void {
    if (this.disabled) return;

    if (!eventType || typeof eventType !== 'string') {
      eventType = 'custom_event';
    }

    let parsedPayload: LogPayload = {};
    if (typeof payload === 'string') {
      parsedPayload = { raw_message: payload };
    } else if (payload && typeof payload === 'object') {
      parsedPayload = payload;
    }

    const event: IngestEvent = {
      timestamp: parsedPayload.timestamp || new Date().toISOString(),
      event_type: eventType,
      source_ip: parsedPayload.source_ip || '127.0.0.1',
      user_identifier: parsedPayload.user_identifier || undefined,
      raw_message: parsedPayload.raw_message || `[${this.appName}] ${eventType}`,
      details: parsedPayload.details || {},
    };

    this.buffer.push(event);

    if (this.buffer.length >= this.batchSize) {
      this.flush().catch(() => {});
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Convenience helper for successful user logins.
   */
  public loginSuccess(userEmail: string, details?: Record<string, unknown>): void {
    this.log('user_login_success', {
      user_identifier: userEmail,
      raw_message: `User ${userEmail} signed in successfully`,
      details: details || {},
    });
  }

  /**
   * Convenience helper for failed login attempts.
   */
  public loginFailure(userEmail: string, reason?: string, details?: Record<string, unknown>): void {
    const d = { ...(details || {}) };
    if (reason) d.reason = reason;
    this.log('user_login_failed', {
      user_identifier: userEmail,
      raw_message: `Authentication failed for ${userEmail}${reason ? `: ${reason}` : ''}`,
      details: d,
    });
  }

  /**
   * Convenience helper for error reporting.
   */
  public error(err: Error | string, details?: Record<string, unknown>): void {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const d = { ...(details || {}) };
    if (stack) d.stack = stack;

    this.log('application_error', {
      raw_message: `Application exception: ${msg}`,
      details: d,
    });
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch(() => {});
    }, this.flushIntervalMs);
  }

  /**
   * Immediately flush all buffered log events over HTTP.
   * Resilient: Errors will NEVER throw into the calling application.
   */
  public async flush(): Promise<number> {
    if (this.buffer.length === 0 || this.isFlushing || this.disabled) {
      return 0;
    }

    this.isFlushing = true;
    const batch = this.buffer.slice();
    this.buffer = [];

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const url = `${this.baseUrl}/api/logs/ingest`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        // Silently log or suppress to guarantee caller stability
        return 0;
      }

      return batch.length;
    } catch {
      // Guaranteed safe: Network failure never crashes caller application
      return 0;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Close client and flush any pending events.
   */
  public async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

export default GridSentry;
