import { getLogCount } from '../utils/opensearch.queries.js';
import { lookupIp, type GeoIpResult } from '../utils/geoip.js';
import { AlertModel, IPBlocklistModel } from '../config/mongoSchemas.js';

export interface SeverityCount {
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
}

export interface StatusCount {
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
  count: number;
}

export interface TopAttackerIp {
  source_ip: string;
  alert_count: number;
  max_severity: string;
  geo: GeoIpResult;
}

export interface TimeSeriesBucket {
  timestamp: string;
  new_count: number;
  investigating_count: number;
  resolved_count: number;
  critical_count: number;
  total_count: number;
}

export interface DashboardSummaryData {
  lookbackHours: number;
  totalLogsProcessed: number;
  totalAlertsCount: number;
  activeBlockedIpsCount: number;
  severityBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  topAttackerIps: TopAttackerIp[];
  timeSeries: TimeSeriesBucket[];
}

export interface GeoLocationMetric {
  countryCode: string;
  countryName: string;
  alertCount: number;
  isHighRisk: boolean;
  isPrivate: boolean;
  sampleIps: string[];
  coordinates: [number, number];
}

export async function getDashboardSummary(lookbackHours = 24): Promise<DashboardSummaryData> {
  let totalLogsProcessed = 0;
  try {
    totalLogsProcessed = await getLogCount();
  } catch {
    totalLogsProcessed = 0;
  }

  const activeBlockedIpsCount = await IPBlocklistModel.countDocuments();

  const sinceDate = new Date(Date.now() - lookbackHours * 3600 * 1000);
  const totalAlertsCount = await AlertModel.countDocuments({ created_at: { $gte: sinceDate } });

  // Severity breakdown
  const sevAgg = await AlertModel.aggregate([
    { $match: { created_at: { $gte: sinceDate } } },
    { $group: { _id: '$severity', count: { $sum: 1 } } },
  ]);

  const severityBreakdown: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const item of sevAgg) {
    if (item._id) severityBreakdown[item._id] = item.count;
  }

  // Status breakdown
  const statusAgg = await AlertModel.aggregate([
    { $match: { created_at: { $gte: sinceDate } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const statusBreakdown: Record<string, number> = { new: 0, investigating: 0, resolved: 0, false_positive: 0 };
  for (const item of statusAgg) {
    if (item._id) statusBreakdown[item._id] = item.count;
  }

  // Top 10 Attacker IPs
  const topIpsAgg = await AlertModel.aggregate([
    { $match: { created_at: { $gte: sinceDate } } },
    {
      $group: {
        _id: '$source_ip',
        count: { $sum: 1 },
        severities: { $push: '$severity' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const topAttackerIps: TopAttackerIp[] = topIpsAgg.map((item) => {
    const severities: string[] = item.severities || [];
    const maxSeverity = severities.includes('critical')
      ? 'critical'
      : severities.includes('high')
        ? 'high'
        : severities.includes('medium')
          ? 'medium'
          : 'low';

    return {
      source_ip: item._id,
      alert_count: item.count,
      max_severity: maxSeverity,
      geo: lookupIp(item._id),
    };
  });

  // Time series hourly buckets
  const timeSeriesAgg = await AlertModel.aggregate([
    { $match: { created_at: { $gte: sinceDate } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d %H:00', date: '$created_at' },
        },
        total_count: { $sum: 1 },
        critical_count: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] },
        },
        resolved_count: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const timeSeries: TimeSeriesBucket[] = timeSeriesAgg.map((r) => ({
    timestamp: r._id,
    new_count: Math.max(0, r.total_count - r.resolved_count),
    investigating_count: 0,
    resolved_count: r.resolved_count,
    critical_count: r.critical_count,
    total_count: r.total_count,
  }));

  return {
    lookbackHours,
    totalLogsProcessed,
    totalAlertsCount,
    activeBlockedIpsCount,
    severityBreakdown,
    statusBreakdown,
    topAttackerIps,
    timeSeries,
  };
}

export async function getGeoMetrics(lookbackHours = 24): Promise<GeoLocationMetric[]> {
  const sinceDate = new Date(Date.now() - lookbackHours * 3600 * 1000);
  const ipAgg = await AlertModel.aggregate([
    { $match: { created_at: { $gte: sinceDate } } },
    { $group: { _id: '$source_ip', count: { $sum: 1 } } },
  ]);

  const countryMap = new Map<string, GeoLocationMetric>();

  for (const row of ipAgg) {
    const geo = lookupIp(row._id);
    const count = row.count;

    const existing = countryMap.get(geo.countryCode);
    if (existing) {
      existing.alertCount += count;
      if (!existing.sampleIps.includes(geo.ip) && existing.sampleIps.length < 5) {
        existing.sampleIps.push(geo.ip);
      }
    } else {
      countryMap.set(geo.countryCode, {
        countryCode: geo.countryCode,
        countryName: geo.countryName,
        alertCount: count,
        isHighRisk: geo.isHighRisk,
        isPrivate: geo.isPrivate,
        sampleIps: [geo.ip],
        coordinates: geo.ll,
      });
    }
  }

  return Array.from(countryMap.values()).sort((a, b) => b.alertCount - a.alertCount);
}
