import dns from 'node:dns';
import net from 'node:net';

/**
 * Converts an IPv4 string to an unsigned 32-bit integer.
 */
function ipToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

/**
 * Checks if an IPv4 integer falls within a CIDR range.
 */
function inCidrIPv4(ipInt: number, cidrIp: string, maskBits: number): boolean {
  const cidrInt = ipToInt(cidrIp);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (cidrInt & mask);
}

/**
 * Checks if an IP address is a private, loopback, or link-local address.
 */
export function isPrivateIP(ip: string): boolean {
  const cleanIp = ip.trim();

  // IPv4 Checks
  if (net.isIPv4(cleanIp)) {
    const ipInt = ipToInt(cleanIp);
    if (inCidrIPv4(ipInt, '127.0.0.0', 8)) return true; // Loopback
    if (inCidrIPv4(ipInt, '10.0.0.0', 8)) return true; // Private 10.x
    if (inCidrIPv4(ipInt, '172.16.0.0', 12)) return true; // Private 172.16-31.x
    if (inCidrIPv4(ipInt, '192.168.0.0', 16)) return true; // Private 192.168.x
    if (inCidrIPv4(ipInt, '169.254.0.0', 16)) return true; // Link-local
    if (inCidrIPv4(ipInt, '0.0.0.0', 8)) return true; // Current network
    return false;
  }

  // IPv6 Checks
  if (net.isIPv6(cleanIp)) {
    const lower = cleanIp.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // Unique local fc00::/7
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // Link-local fe80::/10
    return false;
  }

  return true; // Treat invalid IP strings as unsafe
}

/**
 * Extracts hostnames from a MongoDB connection string.
 * Supports mongodb:// user:pass@host1:27017,host2:27017/db and mongodb+srv://
 */
export function extractHostsFromConnectionString(connectionString: string): string[] {
  const trimmed = connectionString.trim();
  if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
    throw new Error('Connection string must begin with mongodb:// or mongodb+srv://');
  }

  // Strip scheme
  const withoutScheme = trimmed.replace(/^mongodb(\+srv)?:\/\//, '');

  // Extract authority part before path or query params
  const authority = withoutScheme.split('/')[0]?.split('?')[0] ?? '';

  // Strip credentials if present (user:pass@)
  const hostListStr = authority.includes('@') ? authority.split('@')[1] : authority;
  if (!hostListStr) return [];

  // Split multiple hosts (host1:port,host2:port)
  const hostEntries = hostListStr.split(',');
  const hosts: string[] = [];

  for (const entry of hostEntries) {
    const cleanEntry = entry.trim();
    if (!cleanEntry) continue;
    // Extract hostname portion before port (host:port or [ipv6]:port)
    let host = cleanEntry;
    if (host.startsWith('[')) {
      // IPv6 host enclosed in brackets
      host = host.split(']')[0]?.replace('[', '') ?? host;
    } else if (host.includes(':')) {
      host = host.split(':')[0] ?? host;
    }
    if (host) hosts.push(host);
  }

  return hosts;
}

/**
 * Performs SSRF validation on a submitted MongoDB connection string.
 * Resolves hostnames via DNS lookup and throws if any IP is private/internal.
 */
export async function validateConnectionStringSSRF(connectionString: string): Promise<void> {
  const hosts = extractHostsFromConnectionString(connectionString);
  if (hosts.length === 0) {
    throw new Error('No valid hostnames found in submitted MongoDB connection string');
  }

  for (const host of hosts) {
    const cleanHost = host.toLowerCase().trim();

    if (cleanHost === 'localhost' || cleanHost === 'host.docker.internal' || cleanHost === '127.0.0.1' || cleanHost === '::1') {
      throw new Error(`SSRF Blocked: Destination host "${host}" targets a local/internal address.`);
    }

    if (net.isIP(cleanHost)) {
      if (isPrivateIP(cleanHost)) {
        throw new Error(`SSRF Blocked: IP address "${cleanHost}" belongs to a private/internal network.`);
      }
    } else {
      // Resolve hostname via DNS
      try {
        const addresses = await dns.promises.lookup(cleanHost, { all: true });
        for (const addr of addresses) {
          if (isPrivateIP(addr.address)) {
            throw new Error(`SSRF Blocked: Host "${cleanHost}" resolves to private IP "${addr.address}".`);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('SSRF Blocked')) {
          throw err;
        }
        throw new Error(`Unable to resolve host "${cleanHost}" for security validation.`);
      }
    }
  }
}
