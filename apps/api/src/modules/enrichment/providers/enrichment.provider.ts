import { EnrichmentResult } from '@prospect/shared';

export interface EnrichmentProvider {
  enrichContact(data: {
    contactId?: string;
    email?: string;
    domain?: string;
    fullName?: string;
  }): Promise<EnrichmentResult>;

  enrichCompany(data: { domain?: string; companyName?: string }): Promise<EnrichmentResult>;
}

export abstract class BaseEnrichmentProvider implements EnrichmentProvider {
  abstract enrichContact(data: {
    contactId?: string;
    email?: string;
    domain?: string;
    fullName?: string;
  }): Promise<EnrichmentResult>;

  abstract enrichCompany(data: { domain?: string; companyName?: string }): Promise<EnrichmentResult>;
}
