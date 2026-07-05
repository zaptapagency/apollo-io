import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createTagSchema } from '@prospect/shared';
import type { CreateTagInput } from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { TagsService } from './tags.service';

@ApiTags('search/tags')
@Controller('search/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.tagsService.list(auth.organizationId);
  }

  @Post()
  @Roles('REP')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createTagSchema)) body: CreateTagInput,
  ) {
    return this.tagsService.create(auth.organizationId, body);
  }
}
