import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthContext, AuthenticatedRequest } from '../request-context';

/** Injects the resolved auth context (user/org/role) set by SessionAuthGuard or ApiKeyGuard. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.auth) {
      throw new Error('CurrentAuth used on a route without an auth guard');
    }
    return req.auth;
  },
);
