import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import type { Company } from '@prospect/db';
import type { LeadSearchQuery } from '@prospect/shared';
import { SearchService, type ContactSearchResult } from '../lead-search/search.service';

const EXPORT_PAGE_SIZE = 200;
/** Hard cap on rows materialized per export request, so a very broad filter can't hang a
 * request or exhaust memory. Documented as a known limitation — a production cutover would
 * stream this from OpenSearch's scroll/PIT API instead. */
const MAX_EXPORT_ROWS = 10_000;

const COMPANY_COLUMNS = [
  'id',
  'name',
  'domain',
  'industry',
  'employeeCount',
  'companySize',
  'annualRevenue',
  'foundedYear',
  'city',
  'state',
  'country',
  'linkedinUrl',
  'techStack',
  'fundingStage',
  'totalFundingUsd',
  'createdAt',
] as const;

const CONTACT_COLUMNS = [
  'id',
  'firstName',
  'lastName',
  'title',
  'seniority',
  'department',
  'email',
  'emailStatus',
  'phone',
  'linkedinUrl',
  'city',
  'state',
  'country',
  'companyName',
  'companyDomain',
  'createdAt',
] as const;

@Injectable()
export class CsvExportService {
  constructor(private readonly searchService: SearchService) {}

  async exportCompanies(organizationId: string, query: LeadSearchQuery): Promise<string> {
    const rows = await this.collectAll(query, (q) =>
      this.searchService.searchCompanies(organizationId, q),
    );
    const records = rows.map(companyToRow);
    return stringify(records, { header: true, columns: [...COMPANY_COLUMNS] });
  }

  async exportContacts(organizationId: string, query: LeadSearchQuery): Promise<string> {
    const rows = await this.collectAll(query, (q) =>
      this.searchService.searchContacts(organizationId, q),
    );
    const records = rows.map(contactToRow);
    return stringify(records, { header: true, columns: [...CONTACT_COLUMNS] });
  }

  /** Pages through `SearchService` until either the result set is exhausted or `MAX_EXPORT_ROWS`
   * is hit, ignoring the caller-supplied page/pageSize (export always wants "all matches"). */
  private async collectAll<T>(
    query: LeadSearchQuery,
    fetchPage: (q: LeadSearchQuery) => Promise<{ items: T[]; total: number }>,
  ): Promise<T[]> {
    const rows: T[] = [];
    let page = 1;
    for (;;) {
      const result = await fetchPage({ ...query, page, pageSize: EXPORT_PAGE_SIZE });
      rows.push(...result.items);
      if (result.items.length < EXPORT_PAGE_SIZE) break;
      if (rows.length >= result.total) break;
      if (rows.length >= MAX_EXPORT_ROWS) break;
      page += 1;
    }
    return rows;
  }
}

function companyToRow(company: Company): Record<string, string> {
  return {
    id: company.id,
    name: company.name,
    domain: company.domain ?? '',
    industry: company.industry ?? '',
    employeeCount: company.employeeCount?.toString() ?? '',
    companySize: company.companySize ?? '',
    annualRevenue: company.annualRevenue === null ? '' : company.annualRevenue.toString(),
    foundedYear: company.foundedYear?.toString() ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    country: company.country ?? '',
    linkedinUrl: company.linkedinUrl ?? '',
    techStack: company.techStack.join('|'),
    fundingStage: company.fundingStage ?? '',
    totalFundingUsd: company.totalFundingUsd === null ? '' : company.totalFundingUsd.toString(),
    createdAt: company.createdAt.toISOString(),
  };
}

function contactToRow(contact: ContactSearchResult): Record<string, string> {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    title: contact.title ?? '',
    seniority: contact.seniority ?? '',
    department: contact.department ?? '',
    email: contact.email ?? '',
    emailStatus: contact.emailStatus,
    phone: contact.phone ?? '',
    linkedinUrl: contact.linkedinUrl ?? '',
    city: contact.city ?? '',
    state: contact.state ?? '',
    country: contact.country ?? '',
    companyName: contact.company?.name ?? '',
    companyDomain: contact.company?.domain ?? '',
    createdAt: contact.createdAt.toISOString(),
  };
}
