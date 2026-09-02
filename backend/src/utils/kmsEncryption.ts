import crypto from 'node:crypto';
import { env } from '../config/env.js';

const DEFAULT_KMS_KEY_ID = 'kms-key-v1';

/**
 * Derives a 32-byte AES key from the validated KMS master key.
 */
function getMasterKey(): Buffer {
  return crypto.createHash('sha256').update(env.KMS_MASTER_KEY).digest();
}

/**
 * Encrypts a sensitive string (e.g. MongoDB connection string) using AES-256-GCM authenticated encryption.
 */
export function encryptConnectionString(plainText: string): { encryptedString: string; keyId: string } {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(12); // 12-byte IV for GCM mode
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);

  let encrypted = cipher.update(plainText.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const encryptedString = `${iv.toString('hex')}:${authTag}:${encrypted}`;
  return { encryptedString, keyId: DEFAULT_KMS_KEY_ID };
}

/**
 * Decrypts an AES-256-GCM encrypted payload back to original plain text.
 */
export function decryptConnectionString(encryptedString: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted connection string payload format.');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const masterKey = getMasterKey();
  const iv = Buffer.from(ivHex!, 'hex');
  const authTag = Buffer.from(authTagHex!, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex!, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
