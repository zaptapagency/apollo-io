import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createApiKeySchema } from '@prospect/shared';
import type { CreateApiKeyInput } from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { ApiKeysService } from './api-keys.service';

@ApiTags('platform/api-keys')
@Controller('platform/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @Roles('ADMIN')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyInput,
  ) {
    return this.apiKeysService.create(auth.organizationId, auth.userId, body);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.apiKeysService.list(auth.organizationId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.apiKeysService.revoke(auth.organizationId, auth.userId, id);
  }
}
