import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createWebhookSchema } from '@prospect/shared';
import type { CreateWebhookInput } from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { WebhooksService } from './webhooks.service';

@ApiTags('platform/webhooks')
@Controller('platform/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @Roles('ADMIN')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createWebhookSchema)) body: CreateWebhookInput,
  ) {
    return this.webhooksService.create(auth.organizationId, body);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.webhooksService.list(auth.organizationId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.webhooksService.remove(auth.organizationId, id);
  }
}
