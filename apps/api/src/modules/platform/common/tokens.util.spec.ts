import { describe, expect, it } from 'vitest';
import { generateApiKey, generateSessionToken, generateWebhookSecret } from './tokens.util';
import { hashToken, API_KEY_PREFIX_LENGTH } from '../../../common/guards/auth.guard';

describe('tokens.util', () => {
  it('generates unique, sufficiently long session tokens', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(64); // 32 bytes hex-encoded
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates psk_-prefixed API keys whose prefix matches AuthGuard expectations', () => {
    const { raw, prefix } = generateApiKey();
    expect(raw.startsWith('psk_')).toBe(true);
    expect(prefix).toHaveLength(API_KEY_PREFIX_LENGTH);
    expect(raw.slice(0, API_KEY_PREFIX_LENGTH)).toEqual(prefix);
  });

  it('produces a keyHash via hashToken that is reproducible from the raw key alone', () => {
    const { raw } = generateApiKey();
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);
    expect(hash1).toEqual(hash2);
    expect(hash1).toHaveLength(64); // sha256 hex digest
  });

  it('generates whsec_-prefixed webhook secrets', () => {
    const secret = generateWebhookSecret();
    expect(secret.startsWith('whsec_')).toBe(true);
    expect(secret.length).toBeGreaterThan('whsec_'.length);
  });
});
