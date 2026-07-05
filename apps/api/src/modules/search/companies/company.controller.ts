import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createCompanySchema, updateCompanySchema, leadSearchSchema } from '@prospect/shared';
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  LeadSearchQuery,
  PaginatedResult,
} from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { CompanyService } from './company.service';
import { SearchService } from '../lead-search/search.service';
import { TagsService } from '../tags/tags.service';
import { toCompanyResponse, toCompanyResponseList, type CompanyResponse } from '../common/serialize';

@ApiTags('search/companies')
@Controller('search/companies')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly searchService: SearchService,
    private readonly tagsService: TagsService,
  ) {}

  @Get()
  async search(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(leadSearchSchema)) query: LeadSearchQuery,
  ): Promise<PaginatedResult<CompanyResponse>> {
    const result = await this.searchService.searchCompanies(auth.organizationId, query);
    return { ...result, items: toCompanyResponseList(result.items) };
  }

  @Post()
  @Roles('REP')
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createCompanySchema)) body: CreateCompanyInput,
  ): Promise<CompanyResponse> {
    const company = await this.companyService.create(auth.organizationId, body);
    return toCompanyResponse(company);
  }

  @Get(':id')
  async findOne(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
  ): Promise<CompanyResponse> {
    const company = await this.companyService.findOne(auth.organizationId, id);
    return toCompanyResponse(company);
  }

  @Patch(':id')
  @Roles('REP')
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCompanySchema)) body: UpdateCompanyInput,
  ): Promise<CompanyResponse> {
    const company = await this.companyService.update(auth.organizationId, id, body);
    return toCompanyResponse(company);
  }

  @Delete(':id')
  @Roles('MANAGER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.companyService.remove(auth.organizationId, id);
  }

  @Post(':id/tags/:tagId')
  @Roles('REP')
  @HttpCode(HttpStatus.NO_CONTENT)
  async attachTag(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ): Promise<void> {
    await this.tagsService.attachToCompany(auth.organizationId, id, tagId);
  }

  @Delete(':id/tags/:tagId')
  @Roles('REP')
  @HttpCode(HttpStatus.NO_CONTENT)
  async detachTag(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ): Promise<void> {
    await this.tagsService.detachFromCompany(auth.organizationId, id, tagId);
  }
}
