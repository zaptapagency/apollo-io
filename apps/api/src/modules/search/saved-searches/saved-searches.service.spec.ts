import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SavedSearchesService } from './saved-searches.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { SearchService } from '../lead-search/search.service';

function makePrismaMock() {
  return {
    client: {
      savedSearch: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function makeSearchServiceMock() {
  return {
    searchCompanies: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    searchContacts: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
  };
}

describe('SavedSearchesService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let searchService: ReturnType<typeof makeSearchServiceMock>;
  let service: SavedSearchesService;

  beforeEach(() => {
    prisma = makePrismaMock();
    searchService = makeSearchServiceMock();
    service = new SavedSearchesService(
      prisma as unknown as PrismaService,
      searchService as unknown as SearchService,
    );
  });

  describe('create / list / remove', () => {
    it('scopes a created saved search to the caller organization', async () => {
      prisma.client.savedSearch.create.mockResolvedValue({ id: 'ss_1' });

      await service.create('org_A', { name: 'VPs in SaaS', entity: 'CONTACT', filters: { contact: {} } });

      expect(prisma.client.savedSearch.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org_A',
          name: 'VPs in SaaS',
          entity: 'CONTACT',
          filters: { contact: {} },
        },
      });
    });

    it('only lists the caller organization\'s saved searches', async () => {
      prisma.client.savedSearch.findMany.mockResolvedValue([]);

      await service.list('org_A');

      expect(prisma.client.savedSearch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org_A' } }),
      );
    });

    it('removes a saved search after verifying ownership', async () => {
      prisma.client.savedSearch.findUnique.mockResolvedValue({ id: 'ss_1', organizationId: 'org_A' });

      await service.remove('org_A', 'ss_1');

      expect(prisma.client.savedSearch.delete).toHaveBeenCalledWith({ where: { id: 'ss_1' } });
    });

    it('throws NotFoundException removing a saved search belonging to a different organization', async () => {
      prisma.client.savedSearch.findUnique.mockResolvedValue({ id: 'ss_1', organizationId: 'org_B' });

      await expect(service.remove('org_A', 'ss_1')).rejects.toThrow(NotFoundException);
      expect(prisma.client.savedSearch.delete).not.toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('dispatches to searchCompanies when entity is COMPANY', async () => {
      prisma.client.savedSearch.findUnique.mockResolvedValue({
        id: 'ss_1',
        organizationId: 'org_A',
        entity: 'COMPANY',
        filters: { company: { industry: ['SaaS'] }, page: 1, pageSize: 25, sortDir: 'desc' },
      });

      await service.run('org_A', 'ss_1');

      expect(searchService.searchCompanies).toHaveBeenCalledWith(
        'org_A',
        expect.objectContaining({ company: { industry: ['SaaS'] } }),
      );
      expect(searchService.searchContacts).not.toHaveBeenCalled();
    });

    it('dispatches to searchContacts when entity is CONTACT', async () => {
      prisma.client.savedSearch.findUnique.mockResolvedValue({
        id: 'ss_1',
        organizationId: 'org_A',
        entity: 'CONTACT',
        filters: { contact: { title: ['VP'] }, page: 1, pageSize: 25, sortDir: 'desc' },
      });

      await service.run('org_A', 'ss_1');

      expect(searchService.searchContacts).toHaveBeenCalledWith(
        'org_A',
        expect.objectContaining({ contact: { title: ['VP'] } }),
      );
      expect(searchService.searchCompanies).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the stored filters no longer match the schema', async () => {
      prisma.client.savedSearch.findUnique.mockResolvedValue({
        id: 'ss_1',
        organizationId: 'org_A',
        entity: 'COMPANY',
        filters: { page: 'not-a-number' },
      });

      await expect(service.run('org_A', 'ss_1')).rejects.toThrow(BadRequestException);
      expect(searchService.searchCompanies).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a saved search belonging to a different organization', async () => {
      prisma.client.savedSearch.findUnique.mockResolvedValue({ id: 'ss_1', organizationId: 'org_B' });

      await expect(service.run('org_A', 'ss_1')).rejects.toThrow(NotFoundException);
    });
  });
});
