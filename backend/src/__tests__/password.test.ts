import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../utils/password.js';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('Correct-Horse-Battery-Staple-9');
    expect(await verifyPassword('Correct-Horse-Battery-Staple-9', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces distinct hashes for the same input (salted)', async () => {
    const a = await hashPassword('same-password-123');
    const b = await hashPassword('same-password-123');
    expect(a).not.toBe(b);
  });
});
