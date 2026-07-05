import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('hashes a password to a non-plaintext argon2 digest', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toEqual('correct horse battery staple');
    expect(hash.startsWith('$argon2')).toBe(true);
  });

  it('verifies the correct password against its hash', async () => {
    const hash = await hashPassword('s3cr3t-password');
    await expect(verifyPassword(hash, 's3cr3t-password')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cr3t-password');
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toEqual(b);
  });
});
