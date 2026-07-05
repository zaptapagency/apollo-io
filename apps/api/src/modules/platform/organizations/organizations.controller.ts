import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import type { AuthContext } from '../../../common/request-context';
import { OrganizationsService } from './organizations.service';

@ApiTags('platform/organizations')
@Controller('platform/organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  getMine(@CurrentAuth() auth: AuthContext) {
    return this.organizationsService.getMine(auth.organizationId);
  }
}
