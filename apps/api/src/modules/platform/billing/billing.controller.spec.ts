import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { BillingController } from './billing.controller';
import type { BillingService } from './billing.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'OWNER',
  authMethod: 'session',
};

function makeController() {
  const service = {
    createCheckoutSession: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    handleWebhookEvent: vi.fn().mockResolvedValue(undefined),
    getSubscription: vi.fn(),
  };
  const controller = new BillingController(service as unknown as BillingService);
  return { controller, service };
}

describe('BillingController', () => {
  it('checkout() forwards organizationId, actor userId, and the validated body', () => {
    const { controller, service } = makeController();
    controller.checkout(auth, { plan: 'starter', seats: 5 });
    expect(service.createCheckoutSession).toHaveBeenCalledWith('org_A', 'user_1', {
      plan: 'starter',
      seats: 5,
    });
  });

  it('checkout() requires the OWNER role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, BillingController.prototype.checkout)).toEqual(['OWNER']);
  });

  it('getSubscription() scopes to the caller organization only', () => {
    const { controller, service } = makeController();
    controller.getSubscription(auth);
    expect(service.getSubscription).toHaveBeenCalledWith('org_A');
  });

  describe('webhook()', () => {
    it('is marked @Public — no session/API-key auth required (Stripe cannot present one)', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, BillingController.prototype.webhook)).toBe(true);
    });

    it('rejects a request with no stripe-signature header', async () => {
      const { controller } = makeController();
      const req = { body: {} } as unknown as Request;

      await expect(controller.webhook(req, undefined)).rejects.toThrow(BadRequestException);
    });

    it('rejects a request whose signature fails verification', async () => {
      const { controller, service } = makeController();
      service.verifyWebhookSignature.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const req = { body: { type: 'checkout.session.completed' } } as unknown as Request;

      await expect(controller.webhook(req, 'bad-sig')).rejects.toThrow(BadRequestException);
      expect(service.handleWebhookEvent).not.toHaveBeenCalled();
    });

    it('handles the verified event and acknowledges receipt', async () => {
      const { controller, service } = makeController();
      const fakeEvent = { id: 'evt_1', type: 'checkout.session.completed' };
      service.verifyWebhookSignature.mockReturnValue(fakeEvent);
      const req = { body: fakeEvent } as unknown as Request;

      const result = await controller.webhook(req, 'good-sig');

      expect(service.handleWebhookEvent).toHaveBeenCalledWith(fakeEvent);
      expect(result).toEqual({ received: true });
    });
  });
});
