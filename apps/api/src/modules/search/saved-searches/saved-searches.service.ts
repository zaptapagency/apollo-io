import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prospect/db';
import type { SavedSearch, Company } from '@prospect/db';
import { leadSearchSchema } from '@prospect/shared';
import type { SaveSearchInput, PaginatedResult } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchService, type ContactSearchResult } from '../lead-search/search.service';

@Injectable()
export class SavedSearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  async create(organizationId: string, input: SaveSearchInput): Promise<SavedSearch> {
    return this.prisma.client.savedSearch.create({
      data: {
        organizationId,
        name: input.name,
        entity: input.entity,
        filters: input.filters as Prisma.InputJsonValue,
      },
    });
  }

  async list(organizationId: string): Promise<SavedSearch[]> {
    return this.prisma.client.savedSearch.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.getOwned(organizationId, id);
    await this.prisma.client.savedSearch.delete({ where: { id } });
  }

  /** Re-executes the stored filter through `SearchService`, dispatching to
   * `searchCompanies`/`searchContacts` based on the saved search's `entity`. */
  async run(
    organizationId: string,
    id: string,
  ): Promise<PaginatedResult<Company> | PaginatedResult<ContactSearchResult>> {
    const savedSearch = await this.getOwned(organizationId, id);

    const parsed = leadSearchSchema.safeParse(savedSearch.filters);
    if (!parsed.success) {
      throw new BadRequestException('Saved search filters no longer match the current schema');
    }

    return savedSearch.entity === 'COMPANY'
      ? this.searchService.searchCompanies(organizationId, parsed.data)
      : this.searchService.searchContacts(organizationId, parsed.data);
  }

  private async getOwned(organizationId: string, id: string): Promise<SavedSearch> {
    const savedSearch = await this.prisma.client.savedSearch.findUnique({ where: { id } });
    if (!savedSearch || savedSearch.organizationId !== organizationId) {
      throw new NotFoundException('Saved search not found');
    }
    return savedSearch;
  }
}
