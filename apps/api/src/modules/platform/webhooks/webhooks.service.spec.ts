import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import type { PrismaService } from '../../../prisma/prisma.service';

function makePrismaMock() {
  return {
    client: {
      webhookEndpoint: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

describe('WebhooksService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: WebhooksService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new WebhooksService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('generates a whsec_-prefixed secret and scopes the endpoint to the caller organization', async () => {
      prisma.client.webhookEndpoint.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'wh_1', ...data }),
      );

      const created = await service.create('org_A', {
        url: 'https://example.com/hook',
        events: ['contact.created'],
      });

      expect(created.organizationId).toEqual('org_A');
      expect((created.secret as string).startsWith('whsec_')).toBe(true);
    });
  });

  describe('tenant isolation', () => {
    it('list() only queries endpoints scoped to the caller organization', async () => {
      prisma.client.webhookEndpoint.findMany.mockResolvedValue([]);

      await service.list('org_A');

      expect(prisma.client.webhookEndpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_A' } }),
      );
    });

    it('list() masks the secret, revealing only the last 4 characters', async () => {
      prisma.client.webhookEndpoint.findMany.mockResolvedValue([
        { id: 'wh_1', secret: 'whsec_abcdefgh1234', url: 'https://example.com', events: [] },
      ]);

      const [endpoint] = await service.list('org_A');

      expect(endpoint?.secret).toEqual('**************1234');
      expect(endpoint?.secret.length).toEqual('whsec_abcdefgh1234'.length);
    });

    it('remove() throws NotFoundException for an endpoint owned by another organization', async () => {
      prisma.client.webhookEndpoint.findFirst.mockResolvedValue(null);

      await expect(service.remove('org_A', 'wh_owned_by_org_B')).rejects.toThrow(NotFoundException);
      expect(prisma.client.webhookEndpoint.delete).not.toHaveBeenCalled();
    });

    it('remove() deletes only after confirming organization ownership', async () => {
      prisma.client.webhookEndpoint.findFirst.mockResolvedValue({ id: 'wh_1' });
      prisma.client.webhookEndpoint.delete.mockResolvedValue({});

      await service.remove('org_A', 'wh_1');

      expect(prisma.client.webhookEndpoint.findFirst).toHaveBeenCalledWith({
        where: { id: 'wh_1', organizationId: 'org_A' },
      });
      expect(prisma.client.webhookEndpoint.delete).toHaveBeenCalledWith({ where: { id: 'wh_1' } });
    });
  });
});
