import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, hashToken } from './auth.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../request-context';

function makeContext(req: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let prisma: { client: Record<string, unknown> };
  let reflector: Reflector;

  beforeEach(() => {
    prisma = { client: {} };
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
  });

  it('rejects requests with no credentials', async () => {
    const guard = new AuthGuard(reflector, prisma as unknown as PrismaService);
    const req = { header: () => undefined } as unknown as AuthenticatedRequest;
    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(UnauthorizedException);
  });

  it('authenticates a valid API key and scopes the request to its organization', async () => {
    const apiKeyRecord = {
      id: 'key_1',
      organizationId: 'org_A',
      keyPrefix: 'psk_demo1234',
      keyHash: hashToken('psk_demo1234secret'),
      revokedAt: null,
    };
    prisma.client.apiKey = {
      findFirst: vi.fn().mockResolvedValue(apiKeyRecord),
      update: vi.fn().mockResolvedValue(apiKeyRecord),
    };
    const guard = new AuthGuard(reflector, prisma as unknown as PrismaService);
    const req = {
      header: (name: string) => (name === 'authorization' ? 'Bearer psk_demo1234secret' : undefined),
    } as unknown as AuthenticatedRequest;

    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.auth?.organizationId).toBe('org_A');
    expect(req.auth?.authMethod).toBe('apiKey');
  });

  it('rejects a session token that has no membership in the requested organization (tenant isolation)', async () => {
    prisma.client.session = {
      findUnique: vi.fn().mockResolvedValue({
        token: 'sess_1',
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'user_1',
          email: 'a@org-a.com',
          memberships: [{ organizationId: 'org_A', role: 'REP' }],
        },
      }),
    };
    const guard = new AuthGuard(reflector, prisma as unknown as PrismaService);
    const req = {
      header: (name: string) => {
        if (name === 'authorization') return 'Bearer sess_1';
        if (name === 'X-Org-Id') return 'org_B';
        return undefined;
      },
    } as unknown as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(UnauthorizedException);
  });
});
