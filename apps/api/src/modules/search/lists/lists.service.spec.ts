import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ListsService } from './lists.service';
import type { PrismaService } from '../../../prisma/prisma.service';

function makePrismaMock() {
  return {
    client: {
      list: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
      company: { count: vi.fn() },
      contact: { count: vi.fn() },
      listMembership: {
        createMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
      },
    },
  };
}

describe('ListsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ListsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ListsService(prisma as unknown as PrismaService);
  });

  describe('create / list', () => {
    it('scopes a created list to the caller organization', async () => {
      prisma.client.list.create.mockResolvedValue({ id: 'list_1' });

      await service.create('org_A', { name: 'ABM Targets', type: 'COMPANY' });

      expect(prisma.client.list.create).toHaveBeenCalledWith({
        data: { organizationId: 'org_A', name: 'ABM Targets', type: 'COMPANY' },
      });
    });

    it('only lists the caller organization\'s lists', async () => {
      prisma.client.list.findMany.mockResolvedValue([]);

      await service.list('org_A');

      expect(prisma.client.list.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_A' } }),
      );
    });
  });

  describe('addMembers', () => {
    it('rejects adding contactIds to a COMPANY-typed list', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_A', type: 'COMPANY' });

      await expect(
        service.addMembers('org_A', { listId: 'list_1', contactIds: ['contact_1'] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.client.listMembership.createMany).not.toHaveBeenCalled();
    });

    it('rejects adding companyIds to a CONTACT-typed list', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_A', type: 'CONTACT' });

      await expect(
        service.addMembers('org_A', { listId: 'list_1', companyIds: ['company_1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a companyId that does not belong to the caller organization', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_A', type: 'COMPANY' });
      prisma.client.company.count.mockResolvedValue(1); // only 1 of the 2 requested actually belongs

      await expect(
        service.addMembers('org_A', { listId: 'list_1', companyIds: ['company_1', 'company_2'] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.client.listMembership.createMany).not.toHaveBeenCalled();
    });

    it('adds companies via createMany with skipDuplicates, returning the inserted count', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_A', type: 'COMPANY' });
      prisma.client.company.count.mockResolvedValue(2);
      prisma.client.listMembership.createMany.mockResolvedValue({ count: 2 });

      const result = await service.addMembers('org_A', {
        listId: 'list_1',
        companyIds: ['company_1', 'company_2'],
      });

      expect(prisma.client.listMembership.createMany).toHaveBeenCalledWith({
        data: [
          { listId: 'list_1', companyId: 'company_1' },
          { listId: 'list_1', companyId: 'company_2' },
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual({ added: 2 });
    });

    it('rejects a contactId that does not belong to the caller organization', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_A', type: 'CONTACT' });
      prisma.client.contact.count.mockResolvedValue(0);

      await expect(
        service.addMembers('org_A', { listId: 'list_1', contactIds: ['contact_1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a list belonging to a different organization', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_B', type: 'COMPANY' });

      await expect(
        service.addMembers('org_A', { listId: 'list_1', companyIds: ['company_1'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns { added: 0 } and skips the insert when no ids are given', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_A', type: 'COMPANY' });

      const result = await service.addMembers('org_A', { listId: 'list_1' });

      expect(result).toEqual({ added: 0 });
      expect(prisma.client.listMembership.createMany).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('deletes a membership that belongs to the owned list', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_A' });
      prisma.client.listMembership.findUnique.mockResolvedValue({ id: 'membership_1', listId: 'list_1' });

      await service.removeMember('org_A', 'list_1', 'membership_1');

      expect(prisma.client.listMembership.delete).toHaveBeenCalledWith({ where: { id: 'membership_1' } });
    });

    it('throws NotFoundException when the membership belongs to a different list', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_A' });
      prisma.client.listMembership.findUnique.mockResolvedValue({ id: 'membership_1', listId: 'list_other' });

      await expect(service.removeMember('org_A', 'list_1', 'membership_1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.client.listMembership.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a list belonging to a different organization', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_B' });

      await expect(service.removeMember('org_A', 'list_1', 'membership_1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listMembers', () => {
    it('lists memberships for an owned list, including company/contact relations', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_A' });
      prisma.client.listMembership.findMany.mockResolvedValue([]);

      await service.listMembers('org_A', 'list_1');

      expect(prisma.client.listMembership.findMany).toHaveBeenCalledWith({
        where: { listId: 'list_1' },
        include: { company: true, contact: true },
      });
    });

    it('throws NotFoundException for a list belonging to a different organization', async () => {
      prisma.client.list.findUnique.mockResolvedValue({ id: 'list_1', organizationId: 'org_B' });

      await expect(service.listMembers('org_A', 'list_1')).rejects.toThrow(NotFoundException);
    });
  });
});
