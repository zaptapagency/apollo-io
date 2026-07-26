import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnrichmentResult } from '@prospect/shared';
import { BaseEnrichmentProvider } from './enrichment.provider';

@Injectable()
export class ClearbitStyleProvider extends BaseEnrichmentProvider {
  private readonly logger = new Logger(ClearbitStyleProvider.name);
  private apiKey: string | undefined;

  constructor(private config: ConfigService) {
    super();
    this.apiKey = this.config.get<string>('CLEARBIT_API_KEY');
  }

  async enrichContact(_data: {
    contactId?: string;
    email?: string;
    domain?: string;
    fullName?: string;
  }): Promise<EnrichmentResult> {
    if (!this.apiKey) {
      this.logger.warn('Clearbit API key not configured, returning empty result');
      return { confidence: 0 };
    }

    // In a real implementation, call fetch() to Clearbit's Person API
    // For this workstream, return a realistic placeholder matching the shape
    try {
      // const resp = await fetch(`https://api.clearbit.com/v1/people/email/${data.email}`, {
      //   headers: { Authorization: `Bearer ${this.apiKey}` },
      // });
      // const json = await resp.json();
      // return { /* map json to EnrichmentResult */ };

      this.logger.debug('Clearbit enrichment called but not executed (gated by config)');
      return { confidence: 0 };
    } catch (error) {
      this.logger.error('Clearbit enrichment failed', error);
      return { confidence: 0 };
    }
  }

  async enrichCompany(_data: {
    domain?: string;
    companyName?: string;
  }): Promise<EnrichmentResult> {
    if (!this.apiKey) {
      this.logger.warn('Clearbit API key not configured, returning empty result');
      return { confidence: 0 };
    }

    try {
      // Real implementation would call Clearbit's Company API
      // const resp = await fetch(`https://api.clearbit.com/v1/companies/find?domain=${data.domain}`, {
      //   headers: { Authorization: `Bearer ${this.apiKey}` },
      // });
      this.logger.debug('Clearbit company enrichment called but not executed (gated by config)');
      return { confidence: 0 };
    } catch (error) {
      this.logger.error('Clearbit company enrichment failed', error);
      return { confidence: 0 };
    }
  }
}
