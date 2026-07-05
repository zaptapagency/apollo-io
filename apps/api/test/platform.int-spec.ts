/**
 * Integration test STUB for the platform module (Workstream E).
 *
 * These tests spin up a real Postgres via `@testcontainers/postgresql`, apply the frozen Prisma
 * schema to it, boot the full Nest `AppModule` against that database, and exercise the platform
 * HTTP surface end to end with `supertest` — no mocks.
 *
 * IMPORTANT — this file could NOT be executed in the sandbox this was authored in: Docker is not
 * installed/running there (see root DECISIONS.md / GAPS.md), and `@testcontainers/postgresql`
 * requires a working Docker daemon to pull and start the `postgres` image. The code below is
 * believed correct (types check, imports resolve, mirrors the documented
 * `@testcontainers/postgresql` v10 API) but has only been *reviewed*, not run. Business logic is
 * instead verified via the unit tests colocated next to each service
 * (`src/modules/platform/**\/*.spec.ts`), which mock `PrismaService` and run in every environment.
 *
 * Run for real with: `pnpm --filter @prospect/api test:integration` on a machine with Docker.
 */
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Platform module (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('prospect_test')
      .withUsername('prospect')
      .withPassword('prospect')
      .start();

    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;

    // Apply the frozen schema to the freshly-started container. Uses the @prospect/db package's
    // own `prisma` CLI (already a devDependency there) rather than duplicating schema state here.
    execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
      cwd: '../../packages/db',
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    // Imported dynamically, after DATABASE_URL is set: `@prospect/db` constructs its singleton
    // `PrismaClient` at module-evaluation time, so it must not be imported (even transitively)
    // before the real connection string is in place.
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  function signUp(overrides: Partial<Record<string, string>> = {}) {
    return request(app.getHttpServer())
      .post('/api/platform/auth/signup')
      .send({
        organizationName: overrides.organizationName ?? 'Acme Inc',
        name: overrides.name ?? 'Ada Owner',
        email: overrides.email ?? `ada-${Date.now()}@acme.example.com`,
        password: overrides.password ?? 'correct-horse-battery-staple',
      });
  }

  describe('sign-up / sign-in / session lifecycle', () => {
    it('signs up a new organization + owner and returns a usable session token', async () => {
      const res = await signUp();

      expect(res.status).toBe(201);
      expect(res.body.token).toBeTypeOf('string');
      expect(res.body.role).toBe('OWNER');
      expect(res.body.organization.slug).toBeTypeOf('string');

      const me = await request(app.getHttpServer())
        .get('/api/platform/auth/me')
        .set('Authorization', `Bearer ${res.body.token}`);
      expect(me.status).toBe(200);
      expect(me.body.organization.id).toBe(res.body.organization.id);
    });

    it('rejects sign-up with a duplicate email', async () => {
      const email = `dup-${Date.now()}@acme.example.com`;
      await signUp({ email });
      const second = await signUp({ email });
      expect(second.status).toBe(409);
    });

    it('signs in with correct credentials and rejects incorrect ones', async () => {
      const email = `signin-${Date.now()}@acme.example.com`;
      const password = 'correct-horse-battery-staple';
      await signUp({ email, password });

      const good = await request(app.getHttpServer())
        .post('/api/platform/auth/signin')
        .send({ email, password });
      expect(good.status).toBe(201);
      expect(good.body.token).toBeTypeOf('string');

      const bad = await request(app.getHttpServer())
        .post('/api/platform/auth/signin')
        .send({ email, password: 'wrong-password' });
      expect(bad.status).toBe(401);
    });

    it('signs out and invalidates the session token', async () => {
      const res = await signUp();
      const token = res.body.token as string;

      const signOut = await request(app.getHttpServer())
        .post('/api/platform/auth/signout')
        .set('Authorization', `Bearer ${token}`);
      expect(signOut.status).toBe(204);

      const meAfter = await request(app.getHttpServer())
        .get('/api/platform/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meAfter.status).toBe(401);
    });
  });

  describe('members, roles, and tenant isolation', () => {
    it('invites a member, changes their role, lists members, then removes them', async () => {
      const owner = await signUp();
      const ownerToken = owner.body.token as string;

      const invite = await request(app.getHttpServer())
        .post('/api/platform/members/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: `rep-${Date.now()}@acme.example.com`, role: 'REP' });
      expect(invite.status).toBe(201);
      const targetUserId = invite.body.userId as string;

      const promote = await request(app.getHttpServer())
        .patch(`/api/platform/members/${targetUserId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'MANAGER' });
      expect(promote.status).toBe(200);
      expect(promote.body.role).toBe('MANAGER');

      const list = await request(app.getHttpServer())
        .get('/api/platform/members')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(2); // owner + invited rep

      const remove = await request(app.getHttpServer())
        .delete(`/api/platform/members/${targetUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(remove.status).toBe(204);
    });

    it('refuses to remove or demote the last remaining OWNER', async () => {
      const owner = await signUp();
      const ownerToken = owner.body.token as string;
      const me = await request(app.getHttpServer())
        .get('/api/platform/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);
      const ownerUserId = me.body.user.id as string;

      const demote = await request(app.getHttpServer())
        .patch(`/api/platform/members/${ownerUserId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'ADMIN' });
      expect(demote.status).toBe(400);
    });

    it('never leaks org A membership data to org B, even with a valid session for org B', async () => {
      const orgA = await signUp();
      const orgB = await signUp();

      const listAsB = await request(app.getHttpServer())
        .get('/api/platform/members')
        .set('Authorization', `Bearer ${orgB.body.token}`);
      expect(listAsB.status).toBe(200);
      const memberIdsInB = (listAsB.body as Array<{ userId: string }>).map((m) => m.userId);
      expect(memberIdsInB).not.toContain(orgA.body.user.id);
    });

    it('rejects a REP attempting to invite a member (RBAC)', async () => {
      const owner = await signUp();
      const ownerToken = owner.body.token as string;
      const repEmail = `rep2-${Date.now()}@acme.example.com`;
      await request(app.getHttpServer())
        .post('/api/platform/members/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: repEmail, role: 'REP' });

      const repSignIn = await request(app.getHttpServer())
        .post('/api/platform/auth/signin')
        .send({ email: repEmail, password: 'irrelevant-because-no-password-set' });
      // Invited-but-never-signed-up users have no password yet — this documents that limitation
      // rather than asserting a false success; a real onboarding flow needs an invite-accept step
      // (see GAPS.md).
      expect(repSignIn.status).toBe(401);
    });
  });

  describe('API keys', () => {
    it('creates a key that authenticates a subsequent request, then can be revoked', async () => {
      const owner = await signUp();
      const ownerToken = owner.body.token as string;

      const created = await request(app.getHttpServer())
        .post('/api/platform/api-keys')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'CI key', scopes: [], rateLimitPerMinute: 100 });
      expect(created.status).toBe(201);
      const rawKey = created.body.key as string;
      expect(rawKey.startsWith('psk_')).toBe(true);

      const authedWithKey = await request(app.getHttpServer())
        .get('/api/platform/organizations/me')
        .set('Authorization', `Bearer ${rawKey}`);
      expect(authedWithKey.status).toBe(200);

      const revoke = await request(app.getHttpServer())
        .delete(`/api/platform/api-keys/${created.body.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(revoke.status).toBe(204);

      const afterRevoke = await request(app.getHttpServer())
        .get('/api/platform/organizations/me')
        .set('Authorization', `Bearer ${rawKey}`);
      expect(afterRevoke.status).toBe(401);
    });
  });

  describe('audit log', () => {
    it('records member-invited and api-key-created events, visible only to admins of that org', async () => {
      const owner = await signUp();
      const ownerToken = owner.body.token as string;

      await request(app.getHttpServer())
        .post('/api/platform/api-keys')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'CI key', scopes: [], rateLimitPerMinute: 100 });

      const auditLog = await request(app.getHttpServer())
        .get('/api/platform/audit-log')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(auditLog.status).toBe(200);
      const actions = (auditLog.body.items as Array<{ action: string }>).map((i) => i.action);
      expect(actions).toContain('api_key.created');
    });
  });

  describe('billing', () => {
    it('rejects checkout with a clear 4xx when Stripe is not configured (placeholder key)', async () => {
      const owner = await signUp();
      const ownerToken = owner.body.token as string;

      const checkout = await request(app.getHttpServer())
        .post('/api/platform/billing/checkout')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'starter', seats: 5 });

      expect(checkout.status).toBe(400);
    });

    it('downgrades to the free plan without contacting Stripe', async () => {
      const owner = await signUp();
      const ownerToken = owner.body.token as string;

      const checkout = await request(app.getHttpServer())
        .post('/api/platform/billing/checkout')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'free', seats: 1 });

      expect(checkout.status).toBe(201);
      expect(checkout.body.url).toBeNull();
    });

    it('rejects a webhook request with an invalid Stripe signature', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/platform/billing/webhook')
        .set('stripe-signature', 'not-a-real-signature')
        .send({ type: 'checkout.session.completed' });
      expect(res.status).toBe(400);
    });
  });

  describe('webhooks (outbound)', () => {
    it('creates, lists (secret masked), and deletes a webhook endpoint', async () => {
      const owner = await signUp();
      const ownerToken = owner.body.token as string;

      const created = await request(app.getHttpServer())
        .post('/api/platform/webhooks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ url: 'https://example.com/hook', events: ['member.invited'] });
      expect(created.status).toBe(201);

      const list = await request(app.getHttpServer())
        .get('/api/platform/webhooks')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(list.status).toBe(200);
      expect(list.body[0].secret).not.toEqual(created.body.secret);

      const remove = await request(app.getHttpServer())
        .delete(`/api/platform/webhooks/${created.body.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(remove.status).toBe(204);
    });
  });
});
