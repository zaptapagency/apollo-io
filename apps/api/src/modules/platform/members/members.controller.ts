import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { inviteMemberSchema, updateMemberRoleSchema } from '@prospect/shared';
import type { InviteMemberInput, UpdateMemberRoleInput } from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { MembersService } from './members.service';

@ApiTags('platform/members')
@Controller('platform/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.membersService.list(auth.organizationId);
  }

  @Post('invite')
  @Roles('ADMIN')
  invite(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
  ) {
    return this.membersService.invite(auth.organizationId, auth.userId, body);
  }

  @Patch(':userId/role')
  @Roles('ADMIN')
  updateRole(
    @CurrentAuth() auth: AuthContext,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) body: UpdateMemberRoleInput,
  ) {
    return this.membersService.updateRole(auth.organizationId, auth.userId, userId, body);
  }

  @Delete(':userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentAuth() auth: AuthContext, @Param('userId') userId: string): Promise<void> {
    await this.membersService.remove(auth.organizationId, auth.userId, userId);
  }
}
