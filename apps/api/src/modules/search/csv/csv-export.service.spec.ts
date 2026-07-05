import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CsvExportService } from './csv-export.service';
import type { SearchService } from '../lead-search/search.service';
import type { LeadSearchQuery } from '@prospect/shared';

function makeSearchServiceMock() {
  return {
    searchCompanies: vi.fn(),
    searchContacts: vi.fn(),
  };
}

const baseQuery: LeadSearchQuery = { page: 1, pageSize: 25, sortDir: 'desc' };

const company = {
  id: 'company_1',
  name: 'Acme',
  domain: 'acme.com',
  industry: 'SaaS',
  employeeCount: 50,
  companySize: 'SIZE_11_50',
  annualRevenue: 1_000_000n,
  foundedYear: 2010,
  city: 'SF',
  state: 'CA',
  country: 'US',
  linkedinUrl: null,
  techStack: ['React', 'Node'],
  fundingStage: 'Seed',
  totalFundingUsd: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

const contact = {
  id: 'contact_1',
  firstName: 'Jane',
  lastName: 'Doe',
  title: 'VP Sales',
  seniority: 'VP',
  department: 'Sales',
  email: 'jane@acme.com',
  emailStatus: 'VALID',
  phone: null,
  linkedinUrl: null,
  city: null,
  state: null,
  country: null,
  company: { name: 'Acme', domain: 'acme.com' },
  createdAt: new Date('2024-02-01T00:00:00.000Z'),
};

describe('CsvExportService', () => {
  let searchService: ReturnType<typeof makeSearchServiceMock>;
  let service: CsvExportService;

  beforeEach(() => {
    searchService = makeSearchServiceMock();
    service = new CsvExportService(searchService as unknown as SearchService);
  });

  describe('exportCompanies', () => {
    it('produces a CSV with a header row and one row per company', async () => {
      searchService.searchCompanies.mockResolvedValue({ items: [company], total: 1, page: 1, pageSize: 200 });

      const csv = await service.exportCompanies('org_A', baseQuery);

      const lines = csv.trim().split('\n');
      expect(lines[0]).toBe(
        'id,name,domain,industry,employeeCount,companySize,annualRevenue,foundedYear,city,state,country,linkedinUrl,techStack,fundingStage,totalFundingUsd,createdAt',
      );
      expect(lines[1]).toContain('Acme');
      expect(lines[1]).toContain('React|Node');
      expect(lines[1]).toContain('1000000');
    });

    it('always scopes searchCompanies to the caller organization', async () => {
      searchService.searchCompanies.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 200 });

      await service.exportCompanies('org_A', baseQuery);

      expect(searchService.searchCompanies).toHaveBeenCalledWith('org_A', expect.any(Object));
    });

    it('pages through results until the total is exhausted, ignoring the caller-supplied pageSize', async () => {
      searchService.searchCompanies
        .mockResolvedValueOnce({ items: new Array(200).fill(company), total: 250, page: 1, pageSize: 200 })
        .mockResolvedValueOnce({ items: new Array(50).fill(company), total: 250, page: 2, pageSize: 200 });

      await service.exportCompanies('org_A', { ...baseQuery, pageSize: 10 });

      expect(searchService.searchCompanies).toHaveBeenCalledTimes(2);
      expect(searchService.searchCompanies).toHaveBeenNthCalledWith(
        1,
        'org_A',
        expect.objectContaining({ page: 1, pageSize: 200 }),
      );
      expect(searchService.searchCompanies).toHaveBeenNthCalledWith(
        2,
        'org_A',
        expect.objectContaining({ page: 2, pageSize: 200 }),
      );
    });
  });

  describe('exportContacts', () => {
    it('produces a CSV including the joined company name/domain', async () => {
      searchService.searchContacts.mockResolvedValue({ items: [contact], total: 1, page: 1, pageSize: 200 });

      const csv = await service.exportContacts('org_A', baseQuery);

      const lines = csv.trim().split('\n');
      expect(lines[0]).toBe(
        'id,firstName,lastName,title,seniority,department,email,emailStatus,phone,linkedinUrl,city,state,country,companyName,companyDomain,createdAt',
      );
      expect(lines[1]).toContain('Jane');
      expect(lines[1]).toContain('Acme');
      expect(lines[1]).toContain('acme.com');
    });
  });
});
