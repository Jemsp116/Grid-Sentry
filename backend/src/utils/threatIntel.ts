import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { lookupIp } from './geoip.js';

export interface ThreatIntelData {
  ip: string;
  abuseConfidenceScore: number; // 0 - 100
  totalReports: number;
  isp: string;
  usageType: string;
  domain: string;
  countryCode: string;
  countryName: string;
  isWhitelisted: boolean;
  lastReportedAt: string | null;
  cachedAt: string;
  source: 'abuseipdb' | 'otx' | 'heuristic_demo';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface CacheEntry {
  data: ThreatIntelData;
  expiresAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, CacheEntry>();

export function calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

/**
 * Deterministic threat intel fallback generator for offline / demo mode.
 * Uses Geo-IP metadata and IP string hashing so demo IPs consistently show realistic scores.
 */
export function generateHeuristicIntel(ipAddress: string): ThreatIntelData {
  const geo = lookupIp(ipAddress);

  if (geo.isPrivate) {
    return {
      ip: ipAddress,
      abuseConfidenceScore: 0,
      totalReports: 0,
      isp: 'Internal Lab Network',
      usageType: 'Private Subnet',
      domain: 'local',
      countryCode: 'LOCAL',
      countryName: 'Internal / Private Network',
      isWhitelisted: true,
      lastReportedAt: null,
      cachedAt: new Date().toISOString(),
      source: 'heuristic_demo',
      riskLevel: 'low',
    };
  }

  // Simple string hash for deterministic fallback scoring
  let hash = 0;
  for (let i = 0; i < ipAddress.length; i++) {
    hash = (hash << 5) - hash + ipAddress.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  // High-risk regions get higher baseline score
  const baseScore = geo.isHighRisk ? 75 : 25;
  const abuseConfidenceScore = Math.min(100, Math.max(5, (baseScore + (positiveHash % 25))));
  const totalReports = abuseConfidenceScore * 4 + (positiveHash % 50);

  const sampleIsps = [
    'DigitalOcean LLC',
    'OVH SAS',
    'Linode LLC',
    'Amazon Technologies Inc.',
    'Chinanet ISP',
    'Rostelecom AS',
  ];
  const isp = sampleIsps[positiveHash % sampleIsps.length]!;

  return {
    ip: ipAddress,
    abuseConfidenceScore,
    totalReports,
    isp,
    usageType: 'Data Center / Web Host / Transit',
    domain: isp.toLowerCase().split(' ')[0] + '.com',
    countryCode: geo.countryCode,
    countryName: geo.countryName,
    isWhitelisted: false,
    lastReportedAt: new Date(Date.now() - (positiveHash % 86400000)).toISOString(),
    cachedAt: new Date().toISOString(),
    source: 'heuristic_demo',
    riskLevel: calculateRiskLevel(abuseConfidenceScore),
  };
}

/**
 * Fetch IP threat intelligence with AbuseIPDB integration and 24h TTL cache.
 */
export async function getThreatIntel(ipAddress: string): Promise<ThreatIntelData> {
  const cleanIp = (ipAddress ?? '').trim();
  const now = Date.now();

  // 1. Check TTL Cache
  const cached = cache.get(cleanIp);
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  // 2. Query AbuseIPDB API if key is available
  if (env.ABUSEIPDB_API_KEY) {
    try {
      const response = await fetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(cleanIp)}&maxAgeInDays=90`,
        {
          headers: {
            Key: env.ABUSEIPDB_API_KEY,
            Accept: 'application/json',
          },
        },
      );

      if (response.ok) {
        const body = (await response.json()) as any;
        const d = body.data ?? {};
        const score = typeof d.abuseConfidenceScore === 'number' ? d.abuseConfidenceScore : 0;

        const result: ThreatIntelData = {
          ip: cleanIp,
          abuseConfidenceScore: score,
          totalReports: d.totalReports ?? 0,
          isp: d.isp ?? 'Unknown ISP',
          usageType: d.usageType ?? 'Unknown',
          domain: d.domain ?? 'Unknown',
          countryCode: d.countryCode ?? 'UNKNOWN',
          countryName: d.countryName ?? 'Unknown',
          isWhitelisted: Boolean(d.isWhitelisted),
          lastReportedAt: d.lastReportedAt ?? null,
          cachedAt: new Date().toISOString(),
          source: 'abuseipdb',
          riskLevel: calculateRiskLevel(score),
        };

        cache.set(cleanIp, { data: result, expiresAt: now + CACHE_TTL_MS });
        return result;
      }
    } catch (err) {
      logger.warn('AbuseIPDB API request failed, falling back to heuristic intel', {
        ip: cleanIp,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Fallback to heuristic threat intel
  const fallbackResult = generateHeuristicIntel(cleanIp);
  cache.set(cleanIp, { data: fallbackResult, expiresAt: now + CACHE_TTL_MS });
  return fallbackResult;
}

/** Clear cache (utility for unit testing) */
export function clearThreatIntelCache(): void {
  cache.clear();
}
