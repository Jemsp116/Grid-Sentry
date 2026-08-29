import { describe, it, expect, beforeEach } from 'vitest';
import { generateRawApiKey, hashApiKey } from '../models/apiKeys.model.js';
import { encryptConnectionString, decryptConnectionString } from '../utils/kmsEncryption.js';
import { extractHostsFromConnectionString, isPrivateIP, validateConnectionStringSSRF } from '../utils/ssrfGuard.js';
import { checkApiKeyRateLimit, clearRateLimitRecords } from '../utils/apiKeyRateLimiter.js';

describe('External Data Connections Unit Tests', () => {
  beforeEach(() => {
    clearRateLimitRecords();
  });

  describe('Part 1: API Key Cryptographic Hashing', () => {
    it('generates a raw API key starting with gs_live_', () => {
      const rawKey = generateRawApiKey();
      expect(rawKey).toMatch(/^gs_live_[a-f0-9]{48}$/);
    });

    it('hashes API key deterministically using SHA-256', () => {
      const rawKey = 'gs_live_test_key_12345';
      const hash1 = hashApiKey(rawKey);
      const hash2 = hashApiKey(rawKey);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // 64 hex characters for SHA-256
      expect(hash1).not.toBe(rawKey);
    });

    it('enforces rate limiting per API key ID', () => {
      const keyId = 'test_key_id_1';
      for (let i = 0; i < 100; i++) {
        const check = checkApiKeyRateLimit(keyId, 100);
        expect(check.allowed).toBe(true);
      }
      // 101st request within window should be blocked
      const blockedCheck = checkApiKeyRateLimit(keyId, 100);
      expect(blockedCheck.allowed).toBe(false);
      expect(blockedCheck.limit).toBe(100);
    });
  });

  describe('Part 3: KMS Encryption & SSRF Guard', () => {
    it('encrypts and decrypts connection strings cleanly via AES-256-GCM', () => {
      const connString = 'mongodb+srv://admin_user:SuperSecretPass123@cluster0.example.com/grid_sentry_tenant';
      const { encryptedString, keyId } = encryptConnectionString(connString);

      expect(keyId).toBe('kms-key-v1');
      expect(encryptedString).not.toContain('SuperSecretPass123');
      expect(encryptedString.split(':').length).toBe(3); // iv:authTag:ciphertext

      const decrypted = decryptConnectionString(encryptedString);
      expect(decrypted).toBe(connString);
    });

    it('extracts hostnames correctly from mongodb:// and mongodb+srv:// URIs', () => {
      const singleHost = extractHostsFromConnectionString('mongodb+srv://user:pass@mycluster.mongodb.net/testdb');
      expect(singleHost).toEqual(['mycluster.mongodb.net']);

      const multiHost = extractHostsFromConnectionString('mongodb://user:pass@db1.example.com:27017,db2.example.com:27017/testdb');
      expect(multiHost).toEqual(['db1.example.com', 'db2.example.com']);
    });

    it('detects private and loopback IP addresses', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('10.0.1.50')).toBe(true);
      expect(isPrivateIP('172.16.5.1')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('::1')).toBe(true);

      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
    });

    it('rejects connection strings targeting internal/private network addresses (SSRF Protection)', async () => {
      await expect(validateConnectionStringSSRF('mongodb://127.0.0.1:27017/internal_db')).rejects.toThrow(/SSRF Blocked/);
      await expect(validateConnectionStringSSRF('mongodb://localhost:27017/internal_db')).rejects.toThrow(/SSRF Blocked/);
      await expect(validateConnectionStringSSRF('mongodb://10.0.0.5:27017/internal_db')).rejects.toThrow(/SSRF Blocked/);
    });
  });
});
