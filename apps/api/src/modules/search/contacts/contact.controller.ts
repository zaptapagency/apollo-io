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
import { createContactSchema, updateContactSchema, leadSearchSchema } from '@prospect/shared';
import type {
  CreateContactInput,
  UpdateContactInput,
  LeadSearchQuery,
  PaginatedResult,
} from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { ContactService } from './contact.service';
import { SearchService, type ContactSearchResult } from '../lead-search/search.service';
import { TagsService } from '../tags/tags.service';

@ApiTags('search/contacts')
@Controller('search/contacts')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
    private readonly searchService: SearchService,
    private readonly tagsService: TagsService,
  ) {}

  @Get()
  search(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(leadSearchSchema)) query: LeadSearchQuery,
  ): Promise<PaginatedResult<ContactSearchResult>> {
    return this.searchService.searchContacts(auth.organizationId, query);
  }

  @Post()
  @Roles('REP')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createContactSchema)) body: CreateContactInput,
  ) {
    return this.contactService.create(auth.organizationId, body);
  }

  @Get(':id')
  findOne(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.contactService.findOne(auth.organizationId, id);
  }

  @Patch(':id')
  @Roles('REP')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) body: UpdateContactInput,
  ) {
    return this.contactService.update(auth.organizationId, id, body);
  }

  @Delete(':id')
  @Roles('MANAGER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.contactService.remove(auth.organizationId, id);
  }

  @Post(':id/tags/:tagId')
  @Roles('REP')
  @HttpCode(HttpStatus.NO_CONTENT)
  async attachTag(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ): Promise<void> {
    await this.tagsService.attachToContact(auth.organizationId, id, tagId);
  }

  @Delete(':id/tags/:tagId')
  @Roles('REP')
  @HttpCode(HttpStatus.NO_CONTENT)
  async detachTag(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ): Promise<void> {
    await this.tagsService.detachFromContact(auth.organizationId, id, tagId);
  }
}
