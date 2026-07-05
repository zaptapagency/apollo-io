import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import type { AuthContext } from '../../../common/request-context';
import type { PrismaService } from '../../../prisma/prisma.service';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

function makePrismaMock() {
  return { client: { organization: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } } };
}

function makeController() {
  const authService = { signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined) };
  const prisma = makePrismaMock();
  const controller = new AuthController(
    authService as unknown as AuthService,
    prisma as unknown as PrismaService,
  );
  return { controller, authService, prisma };
}

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof makeController>['authService'];
  let prisma: ReturnType<typeof makeController>['prisma'];

  beforeEach(() => {
    ({ controller, authService, prisma } = makeController());
  });

  it('signup and signin are @Public (no session/API key required)', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.signUp)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.signIn)).toBe(true);
  });

  it('signup() delegates the validated body to AuthService', () => {
    const body = { organizationName: 'Acme', name: 'Ada', email: 'ada@acme.com', password: 'password123' };
    controller.signUp(body);
    expect(authService.signUp).toHaveBeenCalledWith(body);
  });

  it('signin() delegates the validated body to AuthService', () => {
    const body = { email: 'ada@acme.com', password: 'password123' };
    controller.signIn(body);
    expect(authService.signIn).toHaveBeenCalledWith(body);
  });

  it('signout() extracts the bearer token from the Authorization header and revokes it', async () => {
    const req = {
      header: (name: string) => (name === 'authorization' ? 'Bearer abc123' : undefined),
    } as unknown as Request;

    await controller.signOut(req);

    expect(authService.signOut).toHaveBeenCalledWith('abc123');
  });

  it('signout() is a no-op when no bearer token is present', async () => {
    const req = { header: () => undefined } as unknown as Request;

    await controller.signOut(req);

    expect(authService.signOut).not.toHaveBeenCalled();
  });

  it('me() returns user + organization info for a session-authenticated caller', async () => {
    prisma.client.organization.findUnique.mockResolvedValue({ id: 'org_A', name: 'Acme', slug: 'acme' });
    prisma.client.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'ada@acme.com', name: 'Ada' });
    const auth: AuthContext = {
      userId: 'user_1',
      email: 'ada@acme.com',
      organizationId: 'org_A',
      role: 'OWNER',
      authMethod: 'session',
    };

    const result = await controller.me(auth);

    expect(result.user).toEqual({ id: 'user_1', email: 'ada@acme.com', name: 'Ada' });
    expect(result.organization).toEqual({ id: 'org_A', name: 'Acme', slug: 'acme' });
    expect(result.auth).toEqual(auth);
  });

  it('me() returns a null user (no User row to look up) for an API-key-authenticated caller', async () => {
    prisma.client.organization.findUnique.mockResolvedValue({ id: 'org_A', name: 'Acme', slug: 'acme' });
    const auth: AuthContext = {
      userId: 'apikey:key_1',
      email: '',
      organizationId: 'org_A',
      role: 'ADMIN',
      authMethod: 'apiKey',
      apiKeyId: 'key_1',
    };

    const result = await controller.me(auth);

    expect(result.user).toBeNull();
    expect(prisma.client.user.findUnique).not.toHaveBeenCalled();
  });
});
