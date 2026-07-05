import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { Prisma } from '@prospect/db';
import { PrismaService } from '../../../prisma/prisma.service';

export const WEBHOOK_SIGNATURE_HEADER = 'X-Prospect-Signature';

/** Computes the HMAC-SHA256 hex signature of a webhook payload with the endpoint's secret. */
export function signWebhookPayload(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Outbound webhook fan-out. Single best-effort attempt per endpoint, no retry queue — a
 * simplification documented in GAPS.md. A future iteration would enqueue deliveries onto BullMQ
 * (already a dependency) with exponential backoff instead of awaiting `fetch` inline.
 */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async dispatch(organizationId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const endpoints = await this.prisma.client.webhookEndpoint.findMany({
      where: { organizationId, isActive: true, events: { has: event } },
    });
    if (endpoints.length === 0) return;

    const rawBody = JSON.stringify(payload);

    await Promise.all(
      endpoints.map(async (endpoint) => {
        const signature = signWebhookPayload(endpoint.secret, rawBody);
        let statusCode: number | undefined;
        let success = false;
        try {
          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              [WEBHOOK_SIGNATURE_HEADER]: signature,
            },
            body: rawBody,
          });
          statusCode = response.status;
          success = response.ok;
        } catch (error) {
          this.logger.warn(`Webhook delivery to ${endpoint.url} failed: ${String(error)}`);
        }

        await this.prisma.client.webhookDelivery.create({
          data: {
            endpointId: endpoint.id,
            event,
            payload: payload as Prisma.InputJsonValue,
            statusCode: statusCode ?? null,
            success,
            attempt: 1,
          },
        });
      }),
    );
  }
}
