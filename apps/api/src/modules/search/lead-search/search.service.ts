import { Injectable } from '@nestjs/common';
import type { Company, Contact } from '@prospect/db';
import type { LeadSearchQuery, PaginatedResult } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { buildCompanyWhere, buildContactWhere } from './where-builders';
import { resolveCompanySort, resolveContactSort } from './sort';

export type ContactSearchResult = Contact & { company: Company | null };

/**
 * The core lead-search deliverable: translates the combined `LeadSearchQuery` (company + contact
 * + engagement facets, pagination, sort) into Prisma queries against Postgres. See DECISIONS.md
 * for why this — rather than a live OpenSearch cluster — is the primary, fully-tested query path
 * in this environment.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchCompanies(
    organizationId: string,
    query: LeadSearchQuery,
  ): Promise<PaginatedResult<Company>> {
    const where = buildCompanyWhere(query.company, organizationId);
    const orderBy = resolveCompanySort(query.sortBy, query.sortDir);
    const { page, pageSize } = query;

    const [items, total] = await Promise.all([
      this.prisma.client.company.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.company.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async searchContacts(
    organizationId: string,
    query: LeadSearchQuery,
  ): Promise<PaginatedResult<ContactSearchResult>> {
    const where = buildContactWhere(query.contact, query.engagement, organizationId);
    if (query.company) {
      where.company = { is: buildCompanyWhere(query.company, organizationId) };
    }
    const orderBy = resolveContactSort(query.sortBy, query.sortDir);
    const { page, pageSize } = query;

    const [items, total] = await Promise.all([
      this.prisma.client.contact.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { company: true },
      }),
      this.prisma.client.contact.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
