import { SetMetadata } from '@nestjs/common';
import type { OrgRole } from '@prospect/shared';

export const ROLES_KEY = 'roles';

/** Restricts a route to members holding one of the given organization roles. */
export const Roles = (...roles: OrgRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
