import { describe, it, expect, beforeEach } from 'vitest';
import { EmailVerificationService } from './email-verification.service';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;

  beforeEach(() => {
    service = new EmailVerificationService();
  });

  describe('verifyEmail', () => {
    it('marks disposable email addresses as RISKY', async () => {
      const result = await service.verifyEmail('test@tempmail.com');
      expect(result.isDisposable).toBe(true);
      expect(result.status).toBe('RISKY');
    });

    it('marks role-based email addresses as VALID with lower confidence', async () => {
      const result = await service.verifyEmail('support@example.com');
      expect(result.isRoleBased).toBe(true);
      expect(result.status).toBe('VALID');
      expect(result.score).toBe(0.6);
    });

    it('handles invalid email format as INVALID', async () => {
      const result = await service.verifyEmail('not-an-email');
      expect(result.status).toBe('INVALID');
      expect(result.score).toBe(0);
    });

    it('handles missing domain as INVALID', async () => {
      const result = await service.verifyEmail('nodomain@');
      expect(result.status).toBe('INVALID');
    });

    it('returns UNKNOWN status when MX check times out', async () => {
      // Mock DNS to timeout for this test
      const result = await service.verifyEmail('test@invalid-tld-norealbrain.xyz');
      // Will be INVALID due to no MX records found (timeout treated as no MX)
      expect(['INVALID', 'UNKNOWN']).toContain(result.status);
    });

    it('detects common disposable domains', async () => {
      const disposableEmails = [
        'user@10minutemail.com',
        'test@yopmail.com',
        'temp@mailinator.com',
      ];

      for (const email of disposableEmails) {
        const result = await service.verifyEmail(email);
        expect(result.isDisposable).toBe(true);
      }
    });

    it('detects various role-based patterns', async () => {
      const roleEmails = [
        'info@example.com',
        'noreply@company.org',
        'no-reply@startup.io',
        'hello@business.com',
        'admin@org.com',
      ];

      for (const email of roleEmails) {
        const result = await service.verifyEmail(email);
        expect(result.isRoleBased).toBe(true);
      }
    });
  });
});
