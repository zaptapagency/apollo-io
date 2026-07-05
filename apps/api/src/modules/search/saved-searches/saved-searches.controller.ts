import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SavedSearch } from '@prospect/db';
import { saveSearchSchema } from '@prospect/shared';
import type { SaveSearchInput } from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { SavedSearchesService } from './saved-searches.service';

@ApiTags('search/saved-searches')
@Controller('search/saved-searches')
export class SavedSearchesController {
  constructor(private readonly savedSearchesService: SavedSearchesService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<SavedSearch[]> {
    return this.savedSearchesService.list(auth.organizationId);
  }

  @Post()
  @Roles('REP')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(saveSearchSchema)) body: SaveSearchInput,
  ): Promise<SavedSearch> {
    return this.savedSearchesService.create(auth.organizationId, body);
  }

  @Get(':id/run')
  run(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.savedSearchesService.run(auth.organizationId, id);
  }

  @Delete(':id')
  @Roles('REP')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.savedSearchesService.remove(auth.organizationId, id);
  }
}
