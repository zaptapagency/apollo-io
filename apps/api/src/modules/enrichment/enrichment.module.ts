import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EnrichmentController } from './enrichment.controller';
import { EnrichmentService } from './enrichment.service';
import { EmailVerificationService } from './email-verification.service';
import { MockEnrichmentProvider } from './providers/mock.provider';
import { ClearbitStyleProvider } from './providers/clearbit-style.provider';
import { HunterStyleProvider } from './providers/hunter-style.provider';

@Module({
  imports: [PrismaModule],
  controllers: [EnrichmentController],
  providers: [
    EnrichmentService,
    EmailVerificationService,
    MockEnrichmentProvider,
    ClearbitStyleProvider,
    HunterStyleProvider,
  ],
  exports: [EnrichmentService, EmailVerificationService],
})
export class EnrichmentModule {}
