import { GridSentryClient } from './gridSentryClient.js';

export type {
  GridSentryConfig,
  LogDetails,
  LogEventPayload,
} from './gridSentryClient.js';
export { GridSentryClient } from './gridSentryClient.js';

/**
 * Default singleton instance of GridSentryClient.
 *
 * Usage Example:
 * ```ts
 * import { gridSentry } from 'grid-sentry-client';
 *
 * gridSentry.init({
 *   baseUrl: 'http://localhost:4000',
 *   apiKey: 'your_secret_ingest_api_key',
 * });
 *
 * gridSentry.log('user_login_failed', {
 *   source_ip: '198.51.100.44',
 *   user_identifier: 'admin@corp.internal',
 * });
 * ```
 */
export const gridSentry = new GridSentryClient();
export default gridSentry;
