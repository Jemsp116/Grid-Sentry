import geoip from 'geoip-lite';

export const HIGH_RISK_COUNTRIES = new Set([
  'CN', // China
  'RU', // Russia
  'KP', // North Korea
  'IR', // Iran
  'SY', // Syria
  'BY', // Belarus
]);

export interface GeoIpResult {
  ip: string;
  countryCode: string;
  countryName: string;
  city: string;
  ll: [number, number]; // [latitude, longitude]
  isHighRisk: boolean;
  isPrivate: boolean;
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CN: 'China',
  RU: 'Russia',
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
  KR: 'South Korea',
  IN: 'India',
  BR: 'Brazil',
  CA: 'Canada',
  AU: 'Australia',
  NL: 'Netherlands',
  IR: 'Iran',
  KP: 'North Korea',
  SY: 'Syria',
  BY: 'Belarus',
  UA: 'Ukraine',
};

export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    const second = parseInt(parts[1] ?? '0', 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function lookupIp(ipAddress: string): GeoIpResult {
  const cleanIp = (ipAddress ?? '').trim();

  if (isPrivateIp(cleanIp)) {
    return {
      ip: cleanIp,
      countryCode: 'LOCAL',
      countryName: 'Internal / Private Network',
      city: 'Local Lab',
      ll: [0, 0],
      isHighRisk: false,
      isPrivate: true,
    };
  }

  const geo = geoip.lookup(cleanIp);
  if (!geo) {
    return {
      ip: cleanIp,
      countryCode: 'UNKNOWN',
      countryName: 'Unknown Origin',
      city: 'Unknown City',
      ll: [0, 0],
      isHighRisk: false,
      isPrivate: false,
    };
  }

  const countryCode = geo.country || 'UNKNOWN';
  const countryName = COUNTRY_NAMES[countryCode] ?? countryCode;

  return {
    ip: cleanIp,
    countryCode,
    countryName,
    city: geo.city || 'Unknown City',
    ll: geo.ll || [0, 0],
    isHighRisk: HIGH_RISK_COUNTRIES.has(countryCode),
    isPrivate: false,
  };
}
