import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MembersService } from './members.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditLogService } from '../audit-log/audit-log.service';

function makePrismaMock() {
  return {
    client: {
      user: { findUnique: vi.fn(), create: vi.fn() },
      membership: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    },
  };
}

function makeAuditLogMock() {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

describe('MembersService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let auditLog: ReturnType<typeof makeAuditLogMock>;
  let service: MembersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    auditLog = makeAuditLogMock();
    service = new MembersService(prisma as unknown as PrismaService, auditLog as unknown as AuditLogService);
  });

  describe('tenant isolation', () => {
    it('list() only queries memberships for the caller organization', async () => {
      prisma.client.membership.findMany.mockResolvedValue([]);

      await service.list('org_A');

      // Proves org A's query can never leak org B's rows: the `where` clause is a hardcoded
      // literal from the caller's AuthContext, not something a client could override.
      expect(prisma.client.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_A' } }),
      );
      expect(prisma.client.membership.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_B' } }),
      );
    });

    it('updateRole() looks up the membership scoped by (organizationId, userId) compound key', async () => {
      prisma.client.membership.findUnique.mockResolvedValue({
        organizationId: 'org_A',
        userId: 'user_1',
        role: 'REP',
      });
      prisma.client.membership.update.mockResolvedValue({ id: 'm1', role: 'MANAGER' });

      await service.updateRole('org_A', 'actor_1', 'user_1', { role: 'MANAGER' });

      expect(prisma.client.membership.findUnique).toHaveBeenCalledWith({
        where: { organizationId_userId: { organizationId: 'org_A', userId: 'user_1' } },
      });
    });
  });

  describe('invite', () => {
    it('reuses an existing user by email and creates a new membership', async () => {
      prisma.client.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'a@b.com' });
      prisma.client.membership.findUnique.mockResolvedValue(null);
      prisma.client.membership.create.mockResolvedValue({ id: 'm1', role: 'REP' });

      const result = await service.invite('org_A', 'actor_1', { email: 'a@b.com', role: 'REP' });

      expect(prisma.client.user.create).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'm1', role: 'REP' });
      expect(auditLog.record).toHaveBeenCalledWith(
        'org_A',
        { userId: 'actor_1' },
        'member.invited',
        'Membership',
        'm1',
        expect.any(Object),
      );
    });

    it('creates a new user when none exists for that email', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      prisma.client.user.create.mockResolvedValue({ id: 'user_2', email: 'new@b.com' });
      prisma.client.membership.findUnique.mockResolvedValue(null);
      prisma.client.membership.create.mockResolvedValue({ id: 'm2', role: 'REP' });

      await service.invite('org_A', 'actor_1', { email: 'new@b.com', role: 'REP' });

      expect(prisma.client.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'new@b.com' }) }),
      );
    });

    it('rejects inviting someone already a member of the organization', async () => {
      prisma.client.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'a@b.com' });
      prisma.client.membership.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.invite('org_A', 'actor_1', { email: 'a@b.com', role: 'REP' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('last-owner protection', () => {
    it('blocks demoting the sole remaining OWNER', async () => {
      prisma.client.membership.findUnique.mockResolvedValue({
        organizationId: 'org_A',
        userId: 'user_1',
        role: 'OWNER',
      });
      prisma.client.membership.count.mockResolvedValue(1);

      await expect(
        service.updateRole('org_A', 'actor_1', 'user_1', { role: 'ADMIN' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.client.membership.update).not.toHaveBeenCalled();
    });

    it('allows demoting an OWNER when another OWNER remains', async () => {
      prisma.client.membership.findUnique.mockResolvedValue({
        organizationId: 'org_A',
        userId: 'user_1',
        role: 'OWNER',
      });
      prisma.client.membership.count.mockResolvedValue(2);
      prisma.client.membership.update.mockResolvedValue({ id: 'm1', role: 'ADMIN' });

      await service.updateRole('org_A', 'actor_1', 'user_1', { role: 'ADMIN' });

      expect(prisma.client.membership.update).toHaveBeenCalled();
    });

    it('blocks removing the sole remaining OWNER', async () => {
      prisma.client.membership.findUnique.mockResolvedValue({
        organizationId: 'org_A',
        userId: 'user_1',
        role: 'OWNER',
      });
      prisma.client.membership.count.mockResolvedValue(1);

      await expect(service.remove('org_A', 'actor_1', 'user_1')).rejects.toThrow(BadRequestException);
      expect(prisma.client.membership.delete).not.toHaveBeenCalled();
    });

    it('allows removing a non-OWNER member freely', async () => {
      prisma.client.membership.findUnique.mockResolvedValue({
        organizationId: 'org_A',
        userId: 'user_2',
        role: 'REP',
      });
      prisma.client.membership.delete.mockResolvedValue({});

      await service.remove('org_A', 'actor_1', 'user_2');

      expect(prisma.client.membership.count).not.toHaveBeenCalled();
      expect(prisma.client.membership.delete).toHaveBeenCalledWith({
        where: { organizationId_userId: { organizationId: 'org_A', userId: 'user_2' } },
      });
    });
  });

  describe('not-found handling', () => {
    it('throws NotFoundException updating a role for a non-member', async () => {
      prisma.client.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRole('org_A', 'actor_1', 'ghost', { role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException removing a non-member', async () => {
      prisma.client.membership.findUnique.mockResolvedValue(null);

      await expect(service.remove('org_A', 'actor_1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
