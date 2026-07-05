import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { addToListSchema, createListSchema } from '@prospect/shared';
import type { AddToListInput, CreateListInput } from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { ListsService } from './lists.service';

@ApiTags('search/lists')
@Controller('search/lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.listsService.list(auth.organizationId);
  }

  @Post()
  @Roles('REP')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createListSchema)) body: CreateListInput,
  ) {
    return this.listsService.create(auth.organizationId, body);
  }

  @Post('members')
  @Roles('REP')
  addMembers(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(addToListSchema)) body: AddToListInput,
  ) {
    return this.listsService.addMembers(auth.organizationId, body);
  }

  @Get(':listId/members')
  listMembers(@CurrentAuth() auth: AuthContext, @Param('listId') listId: string) {
    return this.listsService.listMembers(auth.organizationId, listId);
  }

  @Delete(':listId/members/:membershipId')
  @Roles('REP')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentAuth() auth: AuthContext,
    @Param('listId') listId: string,
    @Param('membershipId') membershipId: string,
  ): Promise<void> {
    await this.listsService.removeMember(auth.organizationId, listId, membershipId);
  }
}
