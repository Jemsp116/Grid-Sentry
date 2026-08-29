/**
 * Grid Sentry Logger Helper for External Applications (Next.js, Vercel, Express).
 * Copy this file directly into your application (e.g., src/utils/gridSentryLogger.ts).
 */
import { gridSentry } from 'grid-sentry-client';

// Initialize Grid Sentry Client (reads env vars)
gridSentry.init({
  baseUrl: process.env.GRID_SENTRY_URL || 'http://localhost:4000',
  apiKey: process.env.GRID_SENTRY_API_KEY || 'gs_live_your_key_here',
  onError: (err) => console.error('[Grid Sentry Logger Error]', err.message),
});

export const logger = {
  /** Log failed user authentication attempt */
  authFailure: (userEmail: string, ipAddress: string = '127.0.0.1', reason?: string) => {
    gridSentry.log('user_login_failed', {
      source_ip: ipAddress,
      user_identifier: userEmail,
      raw_message: `Failed login attempt for ${userEmail}${reason ? `: ${reason}` : ''}`,
      details: { reason, timestamp: new Date().toISOString() },
    });
  },

  /** Log successful user authentication */
  authSuccess: (userEmail: string, ipAddress: string = '127.0.0.1') => {
    gridSentry.log('user_login_success', {
      source_ip: ipAddress,
      user_identifier: userEmail,
      raw_message: `User ${userEmail} logged in successfully`,
    });
  },

  /** Log server or API exception */
  error: (errorMessage: string, ipAddress: string = '127.0.0.1', details?: Record<string, unknown>) => {
    gridSentry.log('server_error', {
      source_ip: ipAddress,
      raw_message: `Server Error: ${errorMessage}`,
      details: details || {},
    });
  },

  /** Log custom security event */
  event: (eventType: string, message: string, ipAddress: string = '127.0.0.1', userIdentifier?: string) => {
    gridSentry.log(eventType, {
      source_ip: ipAddress,
      user_identifier: userIdentifier,
      raw_message: message,
    });
  },
};
