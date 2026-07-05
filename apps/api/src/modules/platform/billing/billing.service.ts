import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { CheckoutSessionInput } from '@prospect/shared';
import type { SubscriptionStatus } from '@prospect/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

/** The literal placeholder value shipped in `.env.example` — signals "no real key configured". */
const STRIPE_PLACEHOLDER_PREFIX = 'sk_test_placeholder';
const STRIPE_PRICE_PLACEHOLDER_PREFIX = 'price_placeholder';

const PRICE_ENV_BY_PLAN: Record<string, string> = {
  starter: 'STRIPE_PRICE_STARTER',
  growth: 'STRIPE_PRICE_GROWTH',
};

export interface CheckoutResult {
  url: string | null;
  message?: string;
}

/**
 * Stripe test-mode billing. Falls back to a clear 4xx (never calls the Stripe SDK) when
 * `STRIPE_SECRET_KEY` is still the `.env.example` placeholder, so local/CI environments without a
 * real Stripe test account get a predictable error instead of an SDK network failure.
 */
@Injectable()
export class BillingService {
  private stripeClient: Stripe | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  isStripeConfigured(): boolean {
    const key = this.config.get<string>('stripe.secretKey') ?? '';
    return key.length > 0 && !key.startsWith(STRIPE_PLACEHOLDER_PREFIX);
  }

  private getStripe(): Stripe {
    if (!this.stripeClient) {
      const key = this.config.get<string>('stripe.secretKey') ?? '';
      this.stripeClient = new Stripe(key);
    }
    return this.stripeClient;
  }

  async createCheckoutSession(
    organizationId: string,
    actorUserId: string,
    input: CheckoutSessionInput,
  ): Promise<CheckoutResult> {
    if (input.plan === 'free') {
      await this.prisma.client.subscription.upsert({
        where: { organizationId },
        create: { organizationId, plan: 'free', seats: input.seats, status: 'ACTIVE' },
        update: { plan: 'free', seats: input.seats, status: 'ACTIVE' },
      });
      await this.auditLog.record(
        organizationId,
        { userId: actorUserId },
        'subscription.changed',
        'Subscription',
        undefined,
        { plan: 'free', seats: input.seats },
      );
      return { url: null, message: 'Downgraded to the free plan; no payment required.' };
    }

    if (!this.isStripeConfigured()) {
      throw new BadRequestException(
        'Stripe is not configured for this environment (STRIPE_SECRET_KEY is unset or a ' +
          'placeholder). Set a real Stripe test-mode secret key to enable checkout.',
      );
    }

    if (input.plan === 'enterprise') {
      throw new BadRequestException(
        'Enterprise plans do not have a self-serve Stripe price; contact sales.',
      );
    }

    const priceEnvVar = PRICE_ENV_BY_PLAN[input.plan];
    const priceId = priceEnvVar ? process.env[priceEnvVar] : undefined;
    if (!priceId || priceId.startsWith(STRIPE_PRICE_PLACEHOLDER_PREFIX)) {
      throw new BadRequestException(
        `No Stripe price is configured for the "${input.plan}" plan (${priceEnvVar} is unset or a placeholder).`,
      );
    }

    const webBaseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    const session = await this.getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: input.seats }],
      success_url: `${webBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${webBaseUrl}/billing/cancel`,
      client_reference_id: organizationId,
      metadata: { organizationId, plan: input.plan },
    });

    await this.auditLog.record(
      organizationId,
      { userId: actorUserId },
      'subscription.checkout_started',
      'Subscription',
      undefined,
      { plan: input.plan, seats: input.seats },
    );

    return { url: session.url };
  }

  async getSubscription(organizationId: string) {
    return this.prisma.client.subscription.findUnique({ where: { organizationId } });
  }

  /** Throws if the signature is invalid — callers should map this to a 400 response. */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.get<string>('stripe.webhookSecret') ?? '';
    return this.getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionEvent(event.data.object as Stripe.Subscription, event.type);
        break;
      default:
        break;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId = session.metadata?.organizationId ?? session.client_reference_id ?? undefined;
    if (!organizationId) return;

    const plan = session.metadata?.plan ?? 'starter';
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : undefined;
    const stripeSubscriptionId =
      typeof session.subscription === 'string' ? session.subscription : undefined;

    await this.prisma.client.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        stripeCustomerId,
        stripeSubscriptionId,
        plan,
        status: 'ACTIVE',
      },
      update: { stripeCustomerId, stripeSubscriptionId, plan, status: 'ACTIVE' },
    });

    await this.auditLog.record(organizationId, {}, 'subscription.changed', 'Subscription', undefined, {
      event: 'checkout.session.completed',
      plan,
    });
  }

  private async handleSubscriptionEvent(
    subscription: Stripe.Subscription,
    eventType: 'customer.subscription.updated' | 'customer.subscription.deleted',
  ): Promise<void> {
    const stripeCustomerId =
      typeof subscription.customer === 'string' ? subscription.customer : undefined;
    if (!stripeCustomerId) return;

    const existing = await this.prisma.client.subscription.findFirst({ where: { stripeCustomerId } });
    if (!existing) return;

    const status = mapStripeStatus(subscription.status, eventType);
    const seats = subscription.items.data[0]?.quantity ?? existing.seats;

    await this.prisma.client.subscription.update({
      where: { organizationId: existing.organizationId },
      data: {
        status,
        seats,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    await this.auditLog.record(
      existing.organizationId,
      {},
      'subscription.changed',
      'Subscription',
      undefined,
      { event: eventType, status },
    );
  }
}

function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
  eventType: 'customer.subscription.updated' | 'customer.subscription.deleted',
): SubscriptionStatus {
  if (eventType === 'customer.subscription.deleted') return 'CANCELED';
  switch (stripeStatus) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    default:
      return 'ACTIVE';
  }
}
