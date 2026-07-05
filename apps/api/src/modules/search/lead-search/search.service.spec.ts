import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchService } from './search.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { LeadSearchQuery } from '@prospect/shared';

function makePrismaMock() {
  return {
    client: {
      company: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      contact: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    },
  };
}

const baseQuery: LeadSearchQuery = {
  page: 1,
  pageSize: 25,
  sortDir: 'desc',
};

describe('SearchService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SearchService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new SearchService(prisma as unknown as PrismaService);
  });

  describe('searchCompanies', () => {
    it('scopes the where clause to the caller organization', async () => {
      await service.searchCompanies('org_A', baseQuery);

      expect(prisma.client.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org_A' }) }),
      );
      expect(prisma.client.company.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org_A' }) }),
      );
    });

    it('applies company facets from query.company into the where clause', async () => {
      await service.searchCompanies('org_A', { ...baseQuery, company: { industry: ['SaaS'] } });

      expect(prisma.client.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [{ industry: { in: ['SaaS'] } }],
          }),
        }),
      );
    });

    it('computes skip/take from page/pageSize', async () => {
      await service.searchCompanies('org_A', { ...baseQuery, page: 3, pageSize: 10 });

      expect(prisma.client.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('resolves sort via the allowlist, defaulting to createdAt', async () => {
      await service.searchCompanies('org_A', { ...baseQuery, sortBy: 'annualRevenue', sortDir: 'asc' });

      expect(prisma.client.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { annualRevenue: 'asc' } }),
      );
    });

    it('returns items/total/page/pageSize from Promise.all([findMany, count])', async () => {
      const items = [{ id: 'company_1' }];
      prisma.client.company.findMany.mockResolvedValue(items);
      prisma.client.company.count.mockResolvedValue(42);

      const result = await service.searchCompanies('org_A', baseQuery);

      expect(result).toEqual({ items, total: 42, page: 1, pageSize: 25 });
    });
  });

  describe('searchContacts', () => {
    it('scopes the where clause to the caller organization and includes the company relation', async () => {
      await service.searchContacts('org_A', baseQuery);

      expect(prisma.client.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org_A' }),
          include: { company: true },
        }),
      );
    });

    it('applies contact + engagement facets into the where clause', async () => {
      await service.searchContacts('org_A', {
        ...baseQuery,
        contact: { title: ['VP Sales'] },
        engagement: { hasOpenTask: true },
      });

      expect(prisma.client.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [{ title: { in: ['VP Sales'] } }, { tasks: { some: { status: 'OPEN' } } }],
          }),
        }),
      );
    });

    it('nests a company where clause under `where.company.is` when query.company is present', async () => {
      await service.searchContacts('org_A', { ...baseQuery, company: { industry: ['SaaS'] } });

      expect(prisma.client.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company: {
              is: {
                organizationId: 'org_A',
                AND: [{ industry: { in: ['SaaS'] } }],
              },
            },
          }),
        }),
      );
    });

    it('does not set where.company when query.company is absent', async () => {
      await service.searchContacts('org_A', baseQuery);

      const call = prisma.client.contact.findMany.mock.calls[0][0];
      expect(call.where.company).toBeUndefined();
    });

    it('computes skip/take from page/pageSize', async () => {
      await service.searchContacts('org_A', { ...baseQuery, page: 2, pageSize: 15 });

      expect(prisma.client.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 15, take: 15 }),
      );
    });

    it('returns items/total/page/pageSize from Promise.all([findMany, count])', async () => {
      const items = [{ id: 'contact_1', company: null }];
      prisma.client.contact.findMany.mockResolvedValue(items);
      prisma.client.contact.count.mockResolvedValue(7);

      const result = await service.searchContacts('org_A', baseQuery);

      expect(result).toEqual({ items, total: 7, page: 1, pageSize: 25 });
    });
  });
});
