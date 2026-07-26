import { Injectable } from '@nestjs/common';
import { EnrichmentResult } from '@prospect/shared';
import { BaseEnrichmentProvider } from './enrichment.provider';

@Injectable()
export class MockEnrichmentProvider extends BaseEnrichmentProvider {
  constructor() {
    super();
  }

  async enrichContact(data: {
    contactId?: string;
    email?: string;
    domain?: string;
    fullName?: string;
  }): Promise<EnrichmentResult> {
    // Use seeded fake data or return deterministic mock result
    const mockTitles = ['Software Engineer', 'Product Manager', 'Sales Manager', 'CTO', 'Founder'];
    const mockStatuses: Array<'VALID' | 'RISKY' | 'INVALID' | 'UNKNOWN'> = ['VALID', 'RISKY', 'UNKNOWN'];

    return {
      email: data.email || `contact+${Math.random().toString(36).substring(7)}@example.com`,
      emailStatus: mockStatuses[Math.floor(Math.random() * mockStatuses.length)],
      title: mockTitles[Math.floor(Math.random() * mockTitles.length)],
      companyName: data.domain ? `Company at ${data.domain}` : 'Example Corp',
      companyDomain: data.domain || 'example.com',
      linkedinUrl: undefined,
      confidence: 0.7 + Math.random() * 0.3, // 0.7-1.0
    };
  }

  async enrichCompany(data: {
    domain?: string;
    companyName?: string;
  }): Promise<EnrichmentResult> {
    return {
      companyName: data.companyName || data.domain || 'Example Corp',
      companyDomain: data.domain || 'example.com',
      confidence: 0.8 + Math.random() * 0.2,
    };
  }
}
