import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateWebhookInput } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { generateWebhookSecret } from '../common/tokens.util';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, input: CreateWebhookInput) {
    const secret = generateWebhookSecret();
    return this.prisma.client.webhookEndpoint.create({
      data: {
        organizationId,
        url: input.url,
        events: input.events,
        secret,
        isActive: true,
      },
    });
  }

  /** Masks the shared secret in list responses — only shown in full at creation time. */
  async list(organizationId: string) {
    const endpoints = await this.prisma.client.webhookEndpoint.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return endpoints.map((endpoint) => ({
      ...endpoint,
      secret: maskSecret(endpoint.secret),
    }));
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const endpoint = await this.prisma.client.webhookEndpoint.findFirst({
      where: { id, organizationId },
    });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    await this.prisma.client.webhookEndpoint.delete({ where: { id } });
  }
}

function maskSecret(secret: string): string {
  return `${'*'.repeat(Math.max(secret.length - 4, 0))}${secret.slice(-4)}`;
}
