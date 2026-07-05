import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrgRole } from '@prospect/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../request-context';

/** Higher index = more privileged. A member satisfies a required role if their level is >= it. */
const ROLE_HIERARCHY: OrgRole[] = ['READ_ONLY', 'REP', 'MANAGER', 'ADMIN', 'OWNER'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<OrgRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = req.auth?.role;
    if (!role) throw new ForbiddenException('No role resolved for this request');

    const callerLevel = ROLE_HIERARCHY.indexOf(role);
    const satisfied = required.some((r) => callerLevel >= ROLE_HIERARCHY.indexOf(r));
    if (!satisfied) {
      throw new ForbiddenException(`Requires one of roles: ${required.join(', ')}`);
    }
    return true;
  }
}
