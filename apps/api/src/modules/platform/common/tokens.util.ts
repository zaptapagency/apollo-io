import { randomBytes } from 'node:crypto';
import { API_KEY_PREFIX_LENGTH } from '../../../common/guards/auth.guard';

/** Opaque, cryptographically random session token (looked up verbatim by AuthGuard). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/** `psk_`-prefixed raw API key. The prefix (first `API_KEY_PREFIX_LENGTH` chars) is stored
 * in the clear for fast lookup; the full raw key is hashed (see `hashToken`) and never stored. */
export function generateApiKey(): { raw: string; prefix: string } {
  const raw = `psk_${randomBytes(24).toString('hex')}`;
  const prefix = raw.slice(0, API_KEY_PREFIX_LENGTH);
  return { raw, prefix };
}

/** Random shared secret used to HMAC-sign outbound webhook deliveries. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}
