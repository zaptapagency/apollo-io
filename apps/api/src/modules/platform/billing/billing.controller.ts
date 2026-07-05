import { BadRequestException, Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { checkoutSessionSchema } from '@prospect/shared';
import type { CheckoutSessionInput } from '@prospect/shared';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { BillingService } from './billing.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@ApiTags('platform/billing')
@Controller('platform/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  @Roles('OWNER')
  checkout(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(checkoutSessionSchema)) body: CheckoutSessionInput,
  ) {
    return this.billingService.createCheckoutSession(auth.organizationId, auth.userId, body);
  }

  /**
   * Stripe test-mode webhook receiver. Signature verification needs the *exact* raw request
   * bytes; that requires `NestFactory.create(AppModule, { rawBody: true })` in `main.ts`, which
   * is out of scope for this workstream (see GAPS.md). We prefer `req.rawBody` when the app has
   * been bootstrapped with that option and fall back to re-serializing the parsed JSON body
   * otherwise — the fallback will NOT verify against a real Stripe signature, but keeps the
   * verify → dispatch code path exercised end to end (and the invalid-signature path is unit
   * tested directly against `BillingService`).
   */
  @Public()
  @Post('webhook')
  async webhook(
    @Req() req: RequestWithRawBody,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: boolean }> {
    if (!signature) throw new BadRequestException('Missing stripe-signature header');

    const payload: string | Buffer = req.rawBody ?? JSON.stringify(req.body ?? {});

    let event: Stripe.Event;
    try {
      event = this.billingService.verifyWebhookSignature(payload, signature);
    } catch (error) {
      throw new BadRequestException(`Webhook signature verification failed: ${String(error)}`);
    }

    await this.billingService.handleWebhookEvent(event);
    return { received: true };
  }

  @Get('subscription')
  getSubscription(@CurrentAuth() auth: AuthContext) {
    return this.billingService.getSubscription(auth.organizationId);
  }
}
