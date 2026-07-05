import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prospect/db';
import { TagsService } from './tags.service';
import type { PrismaService } from '../../../prisma/prisma.service';

function makePrismaMock() {
  return {
    client: {
      tag: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
      company: { findUnique: vi.fn() },
      contact: { findUnique: vi.fn() },
      companyTag: { upsert: vi.fn(), deleteMany: vi.fn() },
      contactTag: { upsert: vi.fn(), deleteMany: vi.fn() },
    },
  };
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.0.0',
  });
}

describe('TagsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: TagsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new TagsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('scopes the created tag to the caller organization', async () => {
      prisma.client.tag.create.mockResolvedValue({ id: 'tag_1', organizationId: 'org_A' });

      await service.create('org_A', { name: 'Hot Lead' });

      expect(prisma.client.tag.create).toHaveBeenCalledWith({
        data: { organizationId: 'org_A', name: 'Hot Lead', color: undefined },
      });
    });

    it('translates a P2002 unique-constraint violation into ConflictException', async () => {
      prisma.client.tag.create.mockRejectedValue(uniqueConstraintError());

      await expect(service.create('org_A', { name: 'Hot Lead' })).rejects.toThrow(ConflictException);
    });

    it('rethrows unrelated errors', async () => {
      prisma.client.tag.create.mockRejectedValue(new Error('boom'));

      await expect(service.create('org_A', { name: 'Hot Lead' })).rejects.toThrow('boom');
    });
  });

  describe('list', () => {
    it('only queries tags for the caller organization', async () => {
      prisma.client.tag.findMany.mockResolvedValue([]);

      await service.list('org_A');

      expect(prisma.client.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_A' } }),
      );
    });
  });

  describe('attachToCompany / detachFromCompany', () => {
    it('upserts the CompanyTag join row when both company and tag belong to the org', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_A' });
      prisma.client.tag.findUnique.mockResolvedValue({ id: 'tag_1', organizationId: 'org_A' });

      await service.attachToCompany('org_A', 'company_1', 'tag_1');

      expect(prisma.client.companyTag.upsert).toHaveBeenCalledWith({
        where: { companyId_tagId: { companyId: 'company_1', tagId: 'tag_1' } },
        create: { companyId: 'company_1', tagId: 'tag_1' },
        update: {},
      });
    });

    it('rejects attaching a tag from a different organization', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_A' });
      prisma.client.tag.findUnique.mockResolvedValue({ id: 'tag_1', organizationId: 'org_B' });

      await expect(service.attachToCompany('org_A', 'company_1', 'tag_1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.client.companyTag.upsert).not.toHaveBeenCalled();
    });

    it('rejects attaching to a company from a different organization', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_B' });
      prisma.client.tag.findUnique.mockResolvedValue({ id: 'tag_1', organizationId: 'org_A' });

      await expect(service.attachToCompany('org_A', 'company_1', 'tag_1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('detachFromCompany deletes the join row after verifying ownership', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_A' });
      prisma.client.tag.findUnique.mockResolvedValue({ id: 'tag_1', organizationId: 'org_A' });

      await service.detachFromCompany('org_A', 'company_1', 'tag_1');

      expect(prisma.client.companyTag.deleteMany).toHaveBeenCalledWith({
        where: { companyId: 'company_1', tagId: 'tag_1' },
      });
    });
  });

  describe('attachToContact / detachFromContact', () => {
    it('upserts the ContactTag join row when both contact and tag belong to the org', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'contact_1', organizationId: 'org_A' });
      prisma.client.tag.findUnique.mockResolvedValue({ id: 'tag_1', organizationId: 'org_A' });

      await service.attachToContact('org_A', 'contact_1', 'tag_1');

      expect(prisma.client.contactTag.upsert).toHaveBeenCalledWith({
        where: { contactId_tagId: { contactId: 'contact_1', tagId: 'tag_1' } },
        create: { contactId: 'contact_1', tagId: 'tag_1' },
        update: {},
      });
    });

    it('rejects attaching to a contact from a different organization', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'contact_1', organizationId: 'org_B' });
      prisma.client.tag.findUnique.mockResolvedValue({ id: 'tag_1', organizationId: 'org_A' });

      await expect(service.attachToContact('org_A', 'contact_1', 'tag_1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('detachFromContact deletes the join row after verifying ownership', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'contact_1', organizationId: 'org_A' });
      prisma.client.tag.findUnique.mockResolvedValue({ id: 'tag_1', organizationId: 'org_A' });

      await service.detachFromContact('org_A', 'contact_1', 'tag_1');

      expect(prisma.client.contactTag.deleteMany).toHaveBeenCalledWith({
        where: { contactId: 'contact_1', tagId: 'tag_1' },
      });
    });
  });
});
