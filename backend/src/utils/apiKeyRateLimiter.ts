/**
 * Simple in-memory sliding window rate limiter for API key ingestion requests.
 * Default limit: 100 requests per 60 seconds per API key.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const keyRateLimits = new Map<string, RateLimitRecord>();
const WINDOW_MS = 60 * 1000; // 1 minute window
const DEFAULT_MAX_REQUESTS = 100;

export function checkApiKeyRateLimit(keyId: string | number, maxRequests: number = DEFAULT_MAX_REQUESTS): { allowed: boolean; current: number; limit: number } {
  const now = Date.now();
  const idStr = String(keyId);

  let record = keyRateLimits.get(idStr);
  if (!record) {
    record = { timestamps: [] };
    keyRateLimits.set(idStr, record);
  }

  // Filter out timestamps older than WINDOW_MS
  record.timestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (record.timestamps.length >= maxRequests) {
    return { allowed: false, current: record.timestamps.length, limit: maxRequests };
  }

  record.timestamps.push(now);
  return { allowed: true, current: record.timestamps.length, limit: maxRequests };
}

export function clearRateLimitRecords(): void {
  keyRateLimits.clear();
}
