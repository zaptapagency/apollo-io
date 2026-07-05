import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { BillingService } from './billing.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditLogService } from '../audit-log/audit-log.service';

function makePrismaMock() {
  return {
    client: {
      subscription: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
  };
}

function makeConfigMock(values: Record<string, string>) {
  return { get: vi.fn((key: string) => values[key]) };
}

function makeAuditLogMock() {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

describe('BillingService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let auditLog: ReturnType<typeof makeAuditLogMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    auditLog = makeAuditLogMock();
  });

  describe('isStripeConfigured', () => {
    it('is false when STRIPE_SECRET_KEY is the .env.example placeholder', () => {
      const config = makeConfigMock({ 'stripe.secretKey': 'sk_test_placeholder' });
      const service = new BillingService(
        prisma as unknown as PrismaService,
        config as never,
        auditLog as unknown as AuditLogService,
      );
      expect(service.isStripeConfigured()).toBe(false);
    });

    it('is false when STRIPE_SECRET_KEY is unset', () => {
      const config = makeConfigMock({});
      const service = new BillingService(
        prisma as unknown as PrismaService,
        config as never,
        auditLog as unknown as AuditLogService,
      );
      expect(service.isStripeConfigured()).toBe(false);
    });

    it('is true for a real-looking test-mode secret key', () => {
      const config = makeConfigMock({ 'stripe.secretKey': 'sk_test_51AbCdEf' });
      const service = new BillingService(
        prisma as unknown as PrismaService,
        config as never,
        auditLog as unknown as AuditLogService,
      );
      expect(service.isStripeConfigured()).toBe(true);
    });
  });

  describe('createCheckoutSession', () => {
    it('short-circuits with a 4xx and never touches Stripe when unconfigured', async () => {
      const config = makeConfigMock({ 'stripe.secretKey': 'sk_test_placeholder' });
      const service = new BillingService(
        prisma as unknown as PrismaService,
        config as never,
        auditLog as unknown as AuditLogService,
      );

      await expect(
        service.createCheckoutSession('org_A', 'user_1', { plan: 'starter', seats: 5 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.client.subscription.upsert).not.toHaveBeenCalled();
    });

    it('downgrades to the free plan locally without ever calling Stripe', async () => {
      const config = makeConfigMock({ 'stripe.secretKey': 'sk_test_placeholder' });
      const service = new BillingService(
        prisma as unknown as PrismaService,
        config as never,
        auditLog as unknown as AuditLogService,
      );
      prisma.client.subscription.upsert.mockResolvedValue({});

      const result = await service.createCheckoutSession('org_A', 'user_1', {
        plan: 'free',
        seats: 1,
      });

      expect(result.url).toBeNull();
      expect(prisma.client.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_A' } }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        'org_A',
        { userId: 'user_1' },
        'subscription.changed',
        'Subscription',
        undefined,
        expect.any(Object),
      );
    });

    it('rejects the enterprise plan (no self-serve Stripe price exists for it)', async () => {
      const config = makeConfigMock({ 'stripe.secretKey': 'sk_test_51AbCdEf' });
      const service = new BillingService(
        prisma as unknown as PrismaService,
        config as never,
        auditLog as unknown as AuditLogService,
      );

      await expect(
        service.createCheckoutSession('org_A', 'user_1', { plan: 'enterprise', seats: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a plan whose Stripe price env var is unset/placeholder', async () => {
      const config = makeConfigMock({ 'stripe.secretKey': 'sk_test_51AbCdEf' });
      const service = new BillingService(
        prisma as unknown as PrismaService,
        config as never,
        auditLog as unknown as AuditLogService,
      );
      const originalPrice = process.env.STRIPE_PRICE_STARTER;
      process.env.STRIPE_PRICE_STARTER = 'price_placeholder_starter';

      await expect(
        service.createCheckoutSession('org_A', 'user_1', { plan: 'starter', seats: 5 }),
      ).rejects.toThrow(BadRequestException);

      process.env.STRIPE_PRICE_STARTER = originalPrice;
    });
  });

  describe('verifyWebhookSignature', () => {
    const secretKey = 'sk_test_51AbCdEf';
    const webhookSecret = 'whsec_test_secret';

    function makeService(): BillingService {
      const config = makeConfigMock({
        'stripe.secretKey': secretKey,
        'stripe.webhookSecret': webhookSecret,
      });
      return new BillingService(
        prisma as unknown as PrismaService,
        config as never,
        auditLog as unknown as AuditLogService,
      );
    }

    it('rejects a payload with an invalid/forged signature', () => {
      const service = makeService();
      const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });

      expect(() => service.verifyWebhookSignature(payload, 'not-a-real-signature')).toThrow();
    });

    it('accepts a payload whose signature was correctly generated with the shared secret', () => {
      const service = makeService();
      const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
      const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });

      const event = service.verifyWebhookSignature(payload, header);

      expect(event.id).toEqual('evt_1');
    });
  });

  describe('handleWebhookEvent', () => {
    function makeService(): BillingService {
      const config = makeConfigMock({ 'stripe.secretKey': 'sk_test_51AbCdEf' });
      return new BillingService(
        prisma as unknown as PrismaService,
        config as never,
        auditLog as unknown as AuditLogService,
      );
    }

    it('upserts a Subscription keyed by the organizationId from checkout session metadata', async () => {
      const service = makeService();
      prisma.client.subscription.upsert.mockResolvedValue({});

      await service.handleWebhookEvent({
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { organizationId: 'org_A', plan: 'starter' },
            customer: 'cus_123',
            subscription: 'sub_123',
          },
        },
      } as unknown as Stripe.Event);

      expect(prisma.client.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_A' } }),
      );
    });

    it('ignores checkout.session.completed events with no resolvable organizationId', async () => {
      const service = makeService();

      await service.handleWebhookEvent({
        type: 'checkout.session.completed',
        data: { object: { metadata: {}, customer: null, subscription: null } },
      } as unknown as Stripe.Event);

      expect(prisma.client.subscription.upsert).not.toHaveBeenCalled();
    });

    it('marks the subscription CANCELED on customer.subscription.deleted', async () => {
      const service = makeService();
      prisma.client.subscription.findFirst.mockResolvedValue({
        organizationId: 'org_A',
        seats: 3,
      });
      prisma.client.subscription.update.mockResolvedValue({});

      await service.handleWebhookEvent({
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_123',
            status: 'active',
            current_period_end: 1_700_000_000,
            items: { data: [{ quantity: 3 }] },
          },
        },
      } as unknown as Stripe.Event);

      expect(prisma.client.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org_A' },
          data: expect.objectContaining({ status: 'CANCELED' }),
        }),
      );
    });

    it('ignores subscription events for a customer with no known organization', async () => {
      const service = makeService();
      prisma.client.subscription.findFirst.mockResolvedValue(null);

      await service.handleWebhookEvent({
        type: 'customer.subscription.updated',
        data: {
          object: { customer: 'cus_unknown', status: 'active', items: { data: [] } },
        },
      } as unknown as Stripe.Event);

      expect(prisma.client.subscription.update).not.toHaveBeenCalled();
    });
  });
});
