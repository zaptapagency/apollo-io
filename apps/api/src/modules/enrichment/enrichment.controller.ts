import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { AuthContext } from '../../common/request-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { enrichContactRequestSchema, verifyEmailRequestSchema } from '@prospect/shared';
import { EnrichmentService } from './enrichment.service';

@ApiTags('Enrichment')
@Controller('enrichment')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class EnrichmentController {
  constructor(private enrichmentService: EnrichmentService) {}

  @Post('contacts/enrich')
  @Roles('REP')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enrich a contact via third-party API' })
  async enrichContact(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(enrichContactRequestSchema))
    request: {
      contactId?: string;
      email?: string;
      domain?: string;
      fullName?: string;
      provider?: 'MOCK' | 'CLEARBIT_STYLE' | 'HUNTER_STYLE';
    },
  ) {
    if (!request.contactId && !request.email) {
      throw new BadRequestException('Either contactId or email must be provided');
    }

    const result = await this.enrichmentService.enrichContact(
      auth.organizationId,
      request.contactId,
      {
        email: request.email,
        domain: request.domain,
        fullName: request.fullName,
      },
      request.provider || 'MOCK',
    );

    return result;
  }

  @Post('companies/enrich')
  @Roles('REP')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enrich a company via third-party API' })
  async enrichCompany(
    @CurrentAuth() auth: AuthContext,
    @Body()
    request: {
      companyId?: string;
      domain?: string;
      companyName?: string;
      provider?: 'MOCK' | 'CLEARBIT_STYLE' | 'HUNTER_STYLE';
    },
  ) {
    if (!request.companyId && !request.domain) {
      throw new BadRequestException('Either companyId or domain must be provided');
    }

    const result = await this.enrichmentService.enrichCompany(
      auth.organizationId,
      request.companyId,
      {
        domain: request.domain,
        companyName: request.companyName,
      },
      request.provider || 'MOCK',
    );

    return result;
  }

  @Post('verify-email')
  @Roles('REP')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify email deliverability' })
  async verifyEmail(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(verifyEmailRequestSchema))
    request: { email: string },
  ) {
    // Verification doesn't require a contactId, but we'll use a placeholder for logging
    const result = await this.enrichmentService.verifyContactEmail(auth.organizationId, '', request.email);
    return result;
  }

  @Get('verify-email/:email')
  @Roles('REP')
  @ApiOperation({ summary: 'Get cached email verification result' })
  async getEmailVerification(
    @CurrentAuth() auth: AuthContext,
    @Param('email') email: string,
  ) {
    // In production, would query EmailVerificationResult table for cached entry
    // For now, trigger a fresh verification
    const result = await this.enrichmentService.verifyContactEmail(auth.organizationId, '', email);
    return result;
  }
}
