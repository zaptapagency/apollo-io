import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import { hashPassword } from '../common/password.util';

interface TxMock {
  organization: { create: ReturnType<typeof vi.fn> };
  user: { create: ReturnType<typeof vi.fn> };
  membership: { create: ReturnType<typeof vi.fn> };
}

function makePrismaMock() {
  return {
    client: {
      user: { findUnique: vi.fn() },
      organization: { findUnique: vi.fn() },
      session: { create: vi.fn(), deleteMany: vi.fn() },
      $transaction: vi.fn(),
    },
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AuthService(prisma as unknown as PrismaService);
  });

  describe('signUp', () => {
    it('rejects sign-up when the email is already registered', async () => {
      prisma.client.user.findUnique.mockResolvedValue({ id: 'user_1' });

      await expect(
        service.signUp({
          organizationName: 'Acme',
          name: 'Ada',
          email: 'ada@acme.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates an organization, an OWNER user + membership, and a session', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      prisma.client.organization.findUnique.mockResolvedValue(null); // slug is free
      prisma.client.session.create.mockResolvedValue({});
      prisma.client.$transaction.mockImplementation(async (fn: (tx: TxMock) => Promise<unknown>) => {
        const tx: TxMock = {
          organization: {
            create: vi.fn().mockResolvedValue({ id: 'org_1', name: 'Acme', slug: 'acme' }),
          },
          user: {
            create: vi.fn().mockResolvedValue({ id: 'user_1', email: 'ada@acme.com', name: 'Ada' }),
          },
          membership: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.signUp({
        organizationName: 'Acme',
        name: 'Ada',
        email: 'ada@acme.com',
        password: 'password123',
      });

      expect(result.organization).toEqual({ id: 'org_1', name: 'Acme', slug: 'acme' });
      expect(result.user).toEqual({ id: 'user_1', email: 'ada@acme.com', name: 'Ada' });
      expect(result.role).toEqual('OWNER');
      expect(result.token).toHaveLength(64); // 32 random bytes, hex-encoded
      expect(prisma.client.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user_1', token: result.token }),
      });
    });
  });

  describe('signIn', () => {
    it('rejects an unknown email', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);

      await expect(service.signIn({ email: 'nope@acme.com', password: 'whatever' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an incorrect password without revealing which field was wrong', async () => {
      const passwordHash = await hashPassword('correct-password');
      prisma.client.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'ada@acme.com',
        name: 'Ada',
        passwordHash,
        memberships: [{ role: 'OWNER', organization: { id: 'org_1', name: 'Acme', slug: 'acme' } }],
      });

      await expect(
        service.signIn({ email: 'ada@acme.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues a new session on valid credentials, carrying the membership role', async () => {
      const passwordHash = await hashPassword('correct-password');
      prisma.client.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'ada@acme.com',
        name: 'Ada',
        passwordHash,
        memberships: [{ role: 'ADMIN', organization: { id: 'org_1', name: 'Acme', slug: 'acme' } }],
      });
      prisma.client.session.create.mockResolvedValue({});

      const result = await service.signIn({ email: 'ada@acme.com', password: 'correct-password' });

      expect(result.role).toEqual('ADMIN');
      expect(result.organization.id).toEqual('org_1');
      expect(result.token).toHaveLength(64);
    });

    it('rejects a user with no organization membership', async () => {
      const passwordHash = await hashPassword('correct-password');
      prisma.client.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'ada@acme.com',
        name: 'Ada',
        passwordHash,
        memberships: [],
      });

      await expect(
        service.signIn({ email: 'ada@acme.com', password: 'correct-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a user with no password set (e.g. invited but never activated)', async () => {
      prisma.client.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'ada@acme.com',
        name: 'Ada',
        passwordHash: null,
        memberships: [],
      });

      await expect(
        service.signIn({ email: 'ada@acme.com', password: 'anything' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signOut', () => {
    it('deletes the session row matching the given raw token', async () => {
      prisma.client.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.signOut('some-raw-token');

      expect(prisma.client.session.deleteMany).toHaveBeenCalledWith({
        where: { token: 'some-raw-token' },
      });
    });
  });
});
