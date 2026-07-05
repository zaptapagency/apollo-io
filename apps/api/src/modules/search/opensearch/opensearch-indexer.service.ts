import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import type { Company, Contact } from '@prospect/db';

export const COMPANY_INDEX = 'prospect-companies';
export const CONTACT_INDEX = 'prospect-contacts';

/**
 * Thin write-side indexer for OpenSearch. This is a genuine integration point (real client,
 * real index names, real document shapes) ready for a follow-up cutover to OpenSearch-backed
 * search, but it is intentionally "fire and forget": every method swallows its own errors and
 * logs a warning, because Postgres (via `SearchService`) is the source of truth and primary,
 * fully-tested query path in this environment (no live OpenSearch cluster reachable — no
 * Docker). A failure to reach OpenSearch must never fail a company/contact write.
 */
@Injectable()
export class OpenSearchIndexerService {
  private readonly logger = new Logger(OpenSearchIndexerService.name);
  private readonly client: Client;

  constructor(private readonly config: ConfigService) {
    const node = this.config.get<string>('opensearchNode') ?? 'http://localhost:9200';
    this.client = new Client({ node, requestTimeout: 3000 });
  }

  async indexCompany(company: Company): Promise<void> {
    await this.safely('indexCompany', () =>
      this.client.index({
        index: COMPANY_INDEX,
        id: company.id,
        body: serializeCompany(company),
        refresh: false,
      }),
    );
  }

  async deleteCompany(id: string): Promise<void> {
    await this.safely('deleteCompany', () => this.client.delete({ index: COMPANY_INDEX, id }));
  }

  async indexContact(contact: Contact): Promise<void> {
    await this.safely('indexContact', () =>
      this.client.index({
        index: CONTACT_INDEX,
        id: contact.id,
        body: serializeContact(contact),
        refresh: false,
      }),
    );
  }

  async deleteContact(id: string): Promise<void> {
    await this.safely('deleteContact', () => this.client.delete({ index: CONTACT_INDEX, id }));
  }

  private async safely(op: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.warn(
        `OpenSearch ${op} failed — continuing without updating the search index (Postgres write already committed): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

/** BigInt columns must be stringified — OpenSearch's JSON body serializer cannot handle them. */
function serializeCompany(company: Company): Record<string, unknown> {
  return {
    ...company,
    annualRevenue: company.annualRevenue === null ? null : company.annualRevenue.toString(),
    totalFundingUsd: company.totalFundingUsd === null ? null : company.totalFundingUsd.toString(),
  };
}

function serializeContact(contact: Contact): Record<string, unknown> {
  return { ...contact };
}
