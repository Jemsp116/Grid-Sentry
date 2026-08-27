import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  durationToMs,
} from '../utils/tokens.js';

describe('access tokens', () => {
  it('signs and verifies a payload round-trip', () => {
    const token = signAccessToken({ sub: 42, role: 'analyst', sid: 7 });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(42);
    expect(decoded.role).toBe('analyst');
    expect(decoded.sid).toBe(7);
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken({ sub: 1, role: 'viewer', sid: 1 });
    expect(() => verifyAccessToken(token + 'x')).toThrow();
  });
});

describe('refresh tokens', () => {
  it('generates an opaque token whose hash is deterministic', () => {
    const { token, hash } = generateRefreshToken();
    expect(token).toMatch(/^[0-9a-f]+$/);
    expect(hash).toHaveLength(64); // sha-256 hex
    expect(hashRefreshToken(token)).toBe(hash);
  });

  it('produces unique tokens each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
  });
});

describe('durationToMs', () => {
  it('parses each unit', () => {
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('12h')).toBe(43_200_000);
    expect(durationToMs('7d')).toBe(604_800_000);
  });
  it('throws on malformed input', () => {
    expect(() => durationToMs('soon')).toThrow();
  });
});
