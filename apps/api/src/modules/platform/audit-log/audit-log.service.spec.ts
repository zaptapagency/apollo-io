import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogService } from './audit-log.service';
import type { PrismaService } from '../../../prisma/prisma.service';

function makePrismaMock() {
  return { client: { auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() } } };
}

describe('AuditLogService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AuditLogService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AuditLogService(prisma as unknown as PrismaService);
  });

  describe('record', () => {
    it('persists the organization, actor, action, entity, and metadata', async () => {
      prisma.client.auditLog.create.mockResolvedValue({});

      await service.record(
        'org_A',
        { userId: 'user_1' },
        'member.invited',
        'Membership',
        'm1',
        { email: 'a@b.com' },
      );

      expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org_A',
          actorUserId: 'user_1',
          actorApiKeyId: null,
          action: 'member.invited',
          entityType: 'Membership',
          entityId: 'm1',
          metadata: { email: 'a@b.com' },
        },
      });
    });

    it('records API-key-driven actions with actorApiKeyId instead of actorUserId', async () => {
      prisma.client.auditLog.create.mockResolvedValue({});

      await service.record('org_A', { apiKeyId: 'key_1' }, 'api_key.created', 'ApiKey', 'key_1');

      const call = prisma.client.auditLog.create.mock.calls[0] as unknown as [
        { data: { actorUserId: string | null; actorApiKeyId: string | null } },
      ];
      expect(call[0].data.actorUserId).toBeNull();
      expect(call[0].data.actorApiKeyId).toEqual('key_1');
    });
  });

  describe('tenant isolation', () => {
    it('list() only queries/counts rows scoped to the caller organization', async () => {
      prisma.client.auditLog.findMany.mockResolvedValue([]);
      prisma.client.auditLog.count.mockResolvedValue(0);

      await service.list('org_A', { page: 1, pageSize: 25 });

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_A' } }),
      );
      expect(prisma.client.auditLog.count).toHaveBeenCalledWith({ where: { organizationId: 'org_A' } });
      expect(prisma.client.auditLog.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_B' } }),
      );
    });

    it('paginates using page/pageSize from the caller-supplied pagination input', async () => {
      prisma.client.auditLog.findMany.mockResolvedValue([]);
      prisma.client.auditLog.count.mockResolvedValue(0);

      await service.list('org_A', { page: 3, pageSize: 10 });

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });
});
