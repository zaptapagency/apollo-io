import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrichmentProviderKind, EnrichmentResult } from '@prospect/shared';
import { EnrichmentProvider } from './providers/enrichment.provider';
import { MockEnrichmentProvider } from './providers/mock.provider';
import { ClearbitStyleProvider } from './providers/clearbit-style.provider';
import { HunterStyleProvider } from './providers/hunter-style.provider';
import { EmailVerificationService } from './email-verification.service';

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);
  private providers: Map<EnrichmentProviderKind, EnrichmentProvider>;

  constructor(
    private prisma: PrismaService,
    private emailVerificationService: EmailVerificationService,
    private mockProvider: MockEnrichmentProvider,
    private clearbitProvider: ClearbitStyleProvider,
    private hunterProvider: HunterStyleProvider,
  ) {
    this.providers = new Map<EnrichmentProviderKind, EnrichmentProvider>([
      ['MOCK', this.mockProvider],
      ['CLEARBIT_STYLE', this.clearbitProvider],
      ['HUNTER_STYLE', this.hunterProvider],
    ]);
  }

  async enrichContact(
    organizationId: string,
    contactId: string | undefined,
    data: {
      email?: string;
      domain?: string;
      fullName?: string;
    },
    providerKind: EnrichmentProviderKind = 'MOCK',
  ): Promise<EnrichmentResult> {
    const provider = this.providers.get(providerKind) || this.providers.get('MOCK')!;

    try {
      const result = await provider.enrichContact({
        contactId,
        email: data.email,
        domain: data.domain,
        fullName: data.fullName,
      });

      // If we got an email and it passes verification, set its status
      if (result.email && !result.emailStatus) {
        const verification = await this.emailVerificationService.verifyEmail(result.email);
        result.emailStatus = verification.status;
      }

      // Update contact if contactId provided and enrichment succeeded
      if (contactId && result.confidence > 0.5) {
        await this.prisma.client.contact.update({
          where: { id: contactId },
          data: {
            email: result.email || undefined,
            title: result.title || undefined,
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Enrichment failed for contact ${contactId}`, error);
      throw error;
    }
  }

  async enrichCompany(
    organizationId: string,
    companyId: string | undefined,
    data: {
      domain?: string;
      companyName?: string;
    },
    providerKind: EnrichmentProviderKind = 'MOCK',
  ): Promise<EnrichmentResult> {
    const provider = this.providers.get(providerKind) || this.providers.get('MOCK')!;

    try {
      const result = await provider.enrichCompany({
        domain: data.domain,
        companyName: data.companyName,
      });

      // Update company if companyId provided and enrichment succeeded
      if (companyId && result.confidence > 0.5) {
        await this.prisma.client.company.update({
          where: { id: companyId },
          data: {
            domain: result.companyDomain || undefined,
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Enrichment failed for company ${companyId}`, error);
      throw error;
    }
  }

  async verifyContactEmail(organizationId: string, contactId: string, email: string) {
    const verification = await this.emailVerificationService.verifyEmail(email);

    // Persist result to EmailVerificationResult table
    await this.prisma.client.emailVerificationResult.create({
      data: {
        email,
        status: verification.status,
        score: verification.score,
        mxFound: verification.mxFound,
        isDisposable: verification.isDisposable,
        isRoleBased: verification.isRoleBased,
        isCatchAll: verification.isCatchAll,
      },
    });

    return verification;
  }
}
