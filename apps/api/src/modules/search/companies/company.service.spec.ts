import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CompanyService } from './company.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { OpenSearchIndexerService } from '../opensearch/opensearch-indexer.service';
import type { CreateCompanyInput, UpdateCompanyInput } from '@prospect/shared';

function makePrismaMock() {
  return {
    client: {
      company: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function makeIndexerMock() {
  return {
    indexCompany: vi.fn().mockResolvedValue(undefined),
    deleteCompany: vi.fn().mockResolvedValue(undefined),
  };
}

const baseInput: CreateCompanyInput = {
  name: 'Acme Inc',
  domain: 'acme.com',
};

describe('CompanyService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let indexer: ReturnType<typeof makeIndexerMock>;
  let service: CompanyService;

  beforeEach(() => {
    prisma = makePrismaMock();
    indexer = makeIndexerMock();
    service = new CompanyService(
      prisma as unknown as PrismaService,
      indexer as unknown as OpenSearchIndexerService,
    );
  });

  describe('create', () => {
    it('scopes the created row to the caller organization and indexes it', async () => {
      const created = { id: 'company_1', organizationId: 'org_A', ...baseInput };
      prisma.client.company.create.mockResolvedValue(created);

      const result = await service.create('org_A', baseInput);

      expect(prisma.client.company.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org_A' }) }),
      );
      expect(indexer.indexCompany).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });

    it('computes companySize from employeeCount, overriding any explicit companySize', async () => {
      prisma.client.company.create.mockResolvedValue({ id: 'company_1' });

      await service.create('org_A', {
        ...baseInput,
        employeeCount: 5000,
        companySize: 'SIZE_1_10',
      } as CreateCompanyInput);

      expect(prisma.client.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companySize: 'SIZE_1001_5000' }),
        }),
      );
    });

    it('falls back to the explicit companySize when no employeeCount is given', async () => {
      prisma.client.company.create.mockResolvedValue({ id: 'company_1' });

      await service.create('org_A', {
        ...baseInput,
        companySize: 'SIZE_11_50',
      } as CreateCompanyInput);

      expect(prisma.client.company.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ companySize: 'SIZE_11_50' }) }),
      );
    });

    it('converts annualRevenue/totalFundingUsd numbers to BigInt', async () => {
      prisma.client.company.create.mockResolvedValue({ id: 'company_1' });

      await service.create('org_A', {
        ...baseInput,
        annualRevenue: 1_000_000,
        totalFundingUsd: 5_000_000,
      } as CreateCompanyInput);

      expect(prisma.client.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            annualRevenue: 1_000_000n,
            totalFundingUsd: 5_000_000n,
          }),
        }),
      );
    });

    it('does not fail the write if OpenSearch indexing throws', async () => {
      prisma.client.company.create.mockResolvedValue({ id: 'company_1' });
      indexer.indexCompany.mockRejectedValue(new Error('down'));

      await expect(service.create('org_A', baseInput)).resolves.toBeDefined();
    });
  });

  describe('tenant isolation', () => {
    it('findOne() returns the row when it belongs to the caller organization', async () => {
      const company = { id: 'company_1', organizationId: 'org_A' };
      prisma.client.company.findUnique.mockResolvedValue(company);

      const result = await service.findOne('org_A', 'company_1');

      expect(prisma.client.company.findUnique).toHaveBeenCalledWith({ where: { id: 'company_1' } });
      expect(result).toBe(company);
    });

    it('findOne() throws NotFoundException when the row does not exist', async () => {
      prisma.client.company.findUnique.mockResolvedValue(null);

      await expect(service.findOne('org_A', 'ghost')).rejects.toThrow(NotFoundException);
    });

    it('findOne() throws NotFoundException when the row belongs to a different organization', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_B' });

      await expect(service.findOne('org_A', 'company_1')).rejects.toThrow(NotFoundException);
    });

    it('update() throws NotFoundException for a cross-org id and never calls update()', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_B' });

      await expect(
        service.update('org_A', 'company_1', { name: 'New Name' } as UpdateCompanyInput),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.client.company.update).not.toHaveBeenCalled();
    });

    it('remove() throws NotFoundException for a cross-org id and never calls delete()', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_B' });

      await expect(service.remove('org_A', 'company_1')).rejects.toThrow(NotFoundException);
      expect(prisma.client.company.delete).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('re-indexes the updated row', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_A' });
      const updated = { id: 'company_1', organizationId: 'org_A', name: 'New Name' };
      prisma.client.company.update.mockResolvedValue(updated);

      const result = await service.update('org_A', 'company_1', { name: 'New Name' } as UpdateCompanyInput);

      expect(prisma.client.company.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'company_1' } }),
      );
      expect(indexer.indexCompany).toHaveBeenCalledWith(updated);
      expect(result).toBe(updated);
    });
  });

  describe('remove', () => {
    it('deletes and removes the row from the search index', async () => {
      prisma.client.company.findUnique.mockResolvedValue({ id: 'company_1', organizationId: 'org_A' });
      prisma.client.company.delete.mockResolvedValue({});

      await service.remove('org_A', 'company_1');

      expect(prisma.client.company.delete).toHaveBeenCalledWith({ where: { id: 'company_1' } });
      expect(indexer.deleteCompany).toHaveBeenCalledWith('company_1');
    });
  });
});
