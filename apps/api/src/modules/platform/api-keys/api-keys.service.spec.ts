import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import { hashToken, API_KEY_PREFIX_LENGTH } from '../../../common/guards/auth.guard';

function makePrismaMock() {
  return {
    client: {
      apiKey: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
  };
}

function makeAuditLogMock() {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

describe('ApiKeysService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let auditLog: ReturnType<typeof makeAuditLogMock>;
  let service: ApiKeysService;

  beforeEach(() => {
    prisma = makePrismaMock();
    auditLog = makeAuditLogMock();
    service = new ApiKeysService(prisma as unknown as PrismaService, auditLog as unknown as AuditLogService);
  });

  describe('create', () => {
    it('generates a psk_-prefixed raw key whose hash matches what AuthGuard computes', async () => {
      prisma.client.apiKey.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'key_1',
          name: data.name,
          keyPrefix: data.keyPrefix,
          keyHash: data.keyHash,
          scopes: data.scopes,
          rateLimitPerMinute: data.rateLimitPerMinute,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        }),
      );

      const created = await service.create('org_A', 'actor_1', {
        name: 'CI key',
        scopes: [],
        rateLimitPerMinute: 120,
      });

      expect(created.key.startsWith('psk_')).toBe(true);
      expect(created.keyPrefix).toEqual(created.key.slice(0, API_KEY_PREFIX_LENGTH));

      // The exact round trip AuthGuard performs when a caller presents this raw key later.
      const persistedCall = prisma.client.apiKey.create.mock.calls[0] as unknown as [
        { data: { keyHash: string; keyPrefix: string; organizationId: string } },
      ];
      const persistedData = persistedCall[0].data;
      expect(persistedData.keyHash).toEqual(hashToken(created.key));
      expect(persistedData.organizationId).toEqual('org_A');

      // Raw key is never itself persisted — only its hash and its prefix.
      expect(JSON.stringify(persistedData)).not.toContain(created.key);
    });

    it('records an audit log entry scoped to the caller organization', async () => {
      prisma.client.apiKey.create.mockResolvedValue({
        id: 'key_1',
        name: 'CI key',
        keyPrefix: 'psk_abcdefgh',
        scopes: [],
        rateLimitPerMinute: 120,
        createdAt: new Date(),
      });

      await service.create('org_A', 'actor_1', { name: 'CI key', scopes: [], rateLimitPerMinute: 120 });

      expect(auditLog.record).toHaveBeenCalledWith(
        'org_A',
        { userId: 'actor_1' },
        'api_key.created',
        'ApiKey',
        'key_1',
        expect.any(Object),
      );
    });
  });

  describe('tenant isolation', () => {
    it('list() only queries API keys scoped to the caller organization', async () => {
      prisma.client.apiKey.findMany.mockResolvedValue([]);

      await service.list('org_A');

      expect(prisma.client.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_A' } }),
      );
      expect(prisma.client.apiKey.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_B' } }),
      );
    });

    it('list() never selects keyHash', async () => {
      prisma.client.apiKey.findMany.mockResolvedValue([]);

      await service.list('org_A');

      const call = prisma.client.apiKey.findMany.mock.calls[0] as unknown as [
        { select: Record<string, boolean> },
      ];
      expect(call[0].select.keyHash).toBeUndefined();
    });

    it('revoke() scopes the lookup by (id, organizationId) before mutating', async () => {
      prisma.client.apiKey.findFirst.mockResolvedValue({ id: 'key_1', name: 'CI key' });
      prisma.client.apiKey.update.mockResolvedValue({});

      await service.revoke('org_A', 'actor_1', 'key_1');

      expect(prisma.client.apiKey.findFirst).toHaveBeenCalledWith({
        where: { id: 'key_1', organizationId: 'org_A' },
      });
      expect(prisma.client.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key_1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
    });

    it('revoke() throws NotFoundException for a key belonging to another organization', async () => {
      prisma.client.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revoke('org_A', 'actor_1', 'key_owned_by_org_B')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.client.apiKey.update).not.toHaveBeenCalled();
    });
  });
});
