import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../request-context';
import type { OrgRole } from '@prospect/shared';

/**
 * Resolves the caller's identity for every non-public route.
 *
 * Two credential shapes are supported on the same `Authorization: Bearer <token>` header:
 *  - Session tokens (opaque, issued at sign-in) resolve to a user + org membership.
 *  - API keys (prefixed `psk_`) resolve directly to an organization for the public REST API.
 *
 * Tenant isolation invariant: `req.auth.organizationId` is the ONLY organization id any
 * downstream handler may trust. Client-supplied organization ids in body/query are ignored.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(req);
    if (!token) throw new UnauthorizedException('Missing credentials');

    if (token.startsWith('psk_')) {
      await this.authenticateApiKey(req, token);
      return true;
    }
    await this.authenticateSession(req, token);
    return true;
  }

  private async authenticateApiKey(req: AuthenticatedRequest, token: string): Promise<void> {
    const prefix = token.slice(0, API_KEY_PREFIX_LENGTH);
    const keyHash = hashToken(token);
    const apiKey = await this.prisma.client.apiKey.findFirst({
      where: { keyPrefix: prefix, keyHash, revokedAt: null },
    });
    if (!apiKey) throw new UnauthorizedException('Invalid API key');

    await this.prisma.client.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    req.auth = {
      userId: `apikey:${apiKey.id}`,
      email: '',
      organizationId: apiKey.organizationId,
      role: 'ADMIN' as OrgRole,
      authMethod: 'apiKey',
      apiKeyId: apiKey.id,
    };
  }

  private async authenticateSession(req: AuthenticatedRequest, token: string): Promise<void> {
    const session = await this.prisma.client.session.findUnique({
      where: { token },
      include: { user: { include: { memberships: true } } },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const requestedOrgId = req.header('X-Org-Id') ?? undefined;
    const membership = requestedOrgId
      ? session.user.memberships.find((m) => m.organizationId === requestedOrgId)
      : session.user.memberships[0];

    if (!membership) {
      throw new UnauthorizedException('No accessible organization for this user');
    }

    req.auth = {
      userId: session.user.id,
      email: session.user.email,
      organizationId: membership.organizationId,
      role: membership.role as OrgRole,
      authMethod: 'session',
    };
  }
}

function extractToken(req: AuthenticatedRequest): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  const cookieToken = (req as unknown as { cookies?: Record<string, string> }).cookies?.[
    process.env.SESSION_COOKIE_NAME ?? 'prospect_session'
  ];
  return cookieToken;
}

export const API_KEY_PREFIX_LENGTH = 12;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
