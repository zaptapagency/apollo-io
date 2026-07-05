import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContactService } from './contact.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { OpenSearchIndexerService } from '../opensearch/opensearch-indexer.service';
import type { CreateContactInput, UpdateContactInput } from '@prospect/shared';

function makePrismaMock() {
  return {
    client: {
      contact: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      company: {
        findUnique: vi.fn(),
      },
    },
  };
}

function makeIndexerMock() {
  return {
    indexContact: vi.fn().mockResolvedValue(undefined),
    deleteContact: vi.fn().mockResolvedValue(undefined),
  };
}

const baseInput: CreateContactInput = {
  firstName: 'Jane',
  lastName: 'Doe',
};

describe('ContactService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let indexer: ReturnType<typeof makeIndexerMock>;
  let service: ContactService;

  beforeEach(() => {
    prisma = makePrismaMock();
    indexer = makeIndexerMock();
    service = new ContactService(
      prisma as unknown as PrismaService,
      indexer as unknown as OpenSearchIndexerService,
    );
  });

  describe('create', () => {
    it('scopes the created row to the caller organization and indexes it', async () => {
      const created = { id: 'contact_1', organizationId: 'org_A', ...baseInput };
      prisma.client.contact.create.mockResolvedValue(created);

      const result = await service.create('org_A', baseInput);

      expect(prisma.client.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org_A' }) }),
      );
      expect(indexer.indexContact).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });

    it('accepts a companyId that belongs to the same organization', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_A' });
      prisma.client.contact.create.mockResolvedValue({ id: 'contact_1' });

      await service.create('org_A', { ...baseInput, companyId: 'company_1' });

      expect(prisma.client.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ companyId: 'company_1' }) }),
      );
    });

    it('rejects a companyId belonging to a different organization', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_B' });

      await expect(
        service.create('org_A', { ...baseInput, companyId: 'company_1' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.client.contact.create).not.toHaveBeenCalled();
    });

    it('rejects a companyId that does not exist at all', async () => {
      prisma.client.company.findUnique.mockResolvedValue(null);

      await expect(
        service.create('org_A', { ...baseInput, companyId: 'ghost' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.client.contact.create).not.toHaveBeenCalled();
    });

    it('does not fail the write if OpenSearch indexing throws', async () => {
      prisma.client.contact.create.mockResolvedValue({ id: 'contact_1' });
      indexer.indexContact.mockRejectedValue(new Error('down'));

      await expect(service.create('org_A', baseInput)).resolves.toBeDefined();
    });
  });

  describe('tenant isolation', () => {
    it('findOne() returns the row when it belongs to the caller organization', async () => {
      const contact = { id: 'contact_1', organizationId: 'org_A' };
      prisma.client.contact.findUnique.mockResolvedValue(contact);

      const result = await service.findOne('org_A', 'contact_1');

      expect(prisma.client.contact.findUnique).toHaveBeenCalledWith({ where: { id: 'contact_1' } });
      expect(result).toBe(contact);
    });

    it('findOne() throws NotFoundException when the row does not exist', async () => {
      prisma.client.contact.findUnique.mockResolvedValue(null);

      await expect(service.findOne('org_A', 'ghost')).rejects.toThrow(NotFoundException);
    });

    it('findOne() throws NotFoundException when the row belongs to a different organization', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'contact_1', organizationId: 'org_B' });

      await expect(service.findOne('org_A', 'contact_1')).rejects.toThrow(NotFoundException);
    });

    it('update() throws NotFoundException for a cross-org id and never calls update()', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'contact_1', organizationId: 'org_B' });

      await expect(
        service.update('org_A', 'contact_1', { firstName: 'X' } as UpdateContactInput),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.client.contact.update).not.toHaveBeenCalled();
    });

    it('remove() throws NotFoundException for a cross-org id and never calls delete()', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'contact_1', organizationId: 'org_B' });

      await expect(service.remove('org_A', 'contact_1')).rejects.toThrow(NotFoundException);
      expect(prisma.client.contact.delete).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('re-validates a changed companyId against the caller organization', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'contact_1', organizationId: 'org_A' });
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_2', organizationId: 'org_B' });

      await expect(
        service.update('org_A', 'contact_1', { companyId: 'company_2' } as UpdateContactInput),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.client.contact.update).not.toHaveBeenCalled();
    });

    it('re-indexes the updated row', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'contact_1', organizationId: 'org_A' });
      const updated = { id: 'contact_1', organizationId: 'org_A', firstName: 'New' };
      prisma.client.contact.update.mockResolvedValue(updated);

      const result = await service.update('org_A', 'contact_1', { firstName: 'New' } as UpdateContactInput);

      expect(indexer.indexContact).toHaveBeenCalledWith(updated);
      expect(result).toBe(updated);
    });
  });

  describe('remove', () => {
    it('deletes and removes the row from the search index', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'contact_1', organizationId: 'org_A' });
      prisma.client.contact.delete.mockResolvedValue({});

      await service.remove('org_A', 'contact_1');

      expect(prisma.client.contact.delete).toHaveBeenCalledWith({ where: { id: 'contact_1' } });
      expect(indexer.deleteContact).toHaveBeenCalledWith('contact_1');
    });
  });
});
