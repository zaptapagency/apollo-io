import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { companySizeFromCount } from '@prospect/db/src/company-size';
import type { Company, CompanySize } from '@prospect/db';
import type { CreateCompanyInput, UpdateCompanyInput } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { OpenSearchIndexerService } from '../opensearch/opensearch-indexer.service';

/** Resolves the bucketed `CompanySize` from a raw employee count, reusing the single shared
 * bucketing function (`@prospect/db`'s `companySizeFromCount`) so the bucket can never drift
 * from the raw count. Falls back to an explicitly-supplied `companySize` only when no
 * `employeeCount` is given at all. */
function resolveCompanySize(
  employeeCount: number | undefined,
  explicitSize: CompanySize | undefined,
): CompanySize | undefined {
  if (employeeCount !== undefined) return companySizeFromCount(employeeCount);
  return explicitSize;
}

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indexer: OpenSearchIndexerService,
  ) {}

  async create(organizationId: string, input: CreateCompanyInput): Promise<Company> {
    const company = await this.prisma.client.company.create({
      data: {
        organizationId,
        name: input.name,
        domain: input.domain,
        industry: input.industry,
        employeeCount: input.employeeCount,
        companySize: resolveCompanySize(input.employeeCount, input.companySize),
        annualRevenue: input.annualRevenue === undefined ? undefined : BigInt(input.annualRevenue),
        foundedYear: input.foundedYear,
        city: input.city,
        state: input.state,
        country: input.country,
        linkedinUrl: input.linkedinUrl,
        techStack: input.techStack,
        fundingStage: input.fundingStage,
        totalFundingUsd:
          input.totalFundingUsd === undefined ? undefined : BigInt(input.totalFundingUsd),
        description: input.description,
      },
    });

    await this.safeIndex(() => this.indexer.indexCompany(company));
    return company;
  }

  /** Always scoped by organization: fetches by primary key, then explicitly checks the row
   * belongs to the caller's org (rather than trusting a compound `findUnique`), throwing 404 —
   * not 403 — either way so a caller cannot distinguish "doesn't exist" from "not yours". */
  async findOne(organizationId: string, id: string): Promise<Company> {
    const company = await this.prisma.client.company.findUnique({ where: { id } });
    if (!company || company.organizationId !== organizationId) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async update(organizationId: string, id: string, input: UpdateCompanyInput): Promise<Company> {
    await this.findOne(organizationId, id);

    const company = await this.prisma.client.company.update({
      where: { id },
      data: {
        name: input.name,
        domain: input.domain,
        industry: input.industry,
        employeeCount: input.employeeCount,
        companySize: resolveCompanySize(input.employeeCount, input.companySize),
        annualRevenue: input.annualRevenue === undefined ? undefined : BigInt(input.annualRevenue),
        foundedYear: input.foundedYear,
        city: input.city,
        state: input.state,
        country: input.country,
        linkedinUrl: input.linkedinUrl,
        techStack: input.techStack,
        fundingStage: input.fundingStage,
        totalFundingUsd:
          input.totalFundingUsd === undefined ? undefined : BigInt(input.totalFundingUsd),
        description: input.description,
      },
    });

    await this.safeIndex(() => this.indexer.indexCompany(company));
    return company;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);
    await this.prisma.client.company.delete({ where: { id } });
    await this.safeIndex(() => this.indexer.deleteCompany(id));
  }

  /** Defense-in-depth wrapper: `OpenSearchIndexerService` already swallows its own errors, but a
   * write-path call site should never be able to fail a Postgres-committed mutation regardless. */
  private async safeIndex(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.warn(
        `Unexpected error indexing into OpenSearch (Postgres write already committed): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
