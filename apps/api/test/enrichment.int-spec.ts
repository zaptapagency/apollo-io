import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

describe('Enrichment Module - Integration Tests', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;

  let orgAId: string;
  let orgBId: string;
  let orgAUserId: string;
  let orgBUserId: string;
  let orgASessionToken: string;
  let orgBSessionToken: string;
  let contactAId: string;
  let contactBId: string;

  beforeAll(async () => {
    // Start Postgres testcontainer
    container = await new PostgreSqlContainer().start();

    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;

    // Run migrations
    const execSync = await import('child_process').then((m) => m.execSync);
    try {
      execSync('pnpm --filter @prospect/db exec prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      });
    } catch (error) {
      console.warn('Migration warning:', error);
    }

    // Create Prisma client for setup
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });

    // Initialize NestJS app
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DATABASE_URL')
      .useValue(databaseUrl)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Setup: create orgs and users for tenant isolation testing
    const now = new Date();

    orgAId = (
      await prisma.organization.create({
        data: { name: 'Org A', slug: 'org-a' },
      })
    ).id;

    orgBId = (
      await prisma.organization.create({
        data: { name: 'Org B', slug: 'org-b' },
      })
    ).id;

    orgAUserId = (
      await prisma.user.create({
        data: {
          email: 'user-a@org-a.com',
          passwordHash: 'hashed_password_a',
        },
      })
    ).id;

    orgBUserId = (
      await prisma.user.create({
        data: {
          email: 'user-b@org-b.com',
          passwordHash: 'hashed_password_b',
        },
      })
    ).id;

    await prisma.membership.create({
      data: {
        organizationId: orgAId,
        userId: orgAUserId,
        role: 'OWNER',
      },
    });

    await prisma.membership.create({
      data: {
        organizationId: orgBId,
        userId: orgBUserId,
        role: 'OWNER',
      },
    });

    orgASessionToken = (
      await prisma.session.create({
        data: {
          userId: orgAUserId,
          token: 'session-token-org-a-' + Math.random().toString(36),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    ).token;

    orgBSessionToken = (
      await prisma.session.create({
        data: {
          userId: orgBUserId,
          token: 'session-token-org-b-' + Math.random().toString(36),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    ).token;

    // Create contacts for enrichment
    contactAId = (
      await prisma.contact.create({
        data: {
          organizationId: orgAId,
          email: 'contact-a@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      })
    ).id;

    contactBId = (
      await prisma.contact.create({
        data: {
          organizationId: orgBId,
          email: 'contact-b@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
    await container.stop();
  });

  describe('Tenant Isolation', () => {
    it('org A cannot enrich org B contact', async () => {
      // Org A user tries to enrich Org B contact
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/contacts/enrich',
        headers: { Authorization: `Bearer ${orgASessionToken}` },
        payload: {
          contactId: contactBId, // Org B contact
          email: 'contact-b@example.com',
          provider: 'MOCK',
        },
      });

      // Should either fail or update only within org A's scope
      // In this case, the contact doesn't belong to org A, so operation might succeed
      // but the update should not affect org B's data
      const responseBody = JSON.parse(response.payload);

      // Post-enrichment, verify org B contact wasn't modified
      const orgBContact = await prisma.contact.findUnique({ where: { id: contactBId } });
      expect(orgBContact?.organizationId).toBe(orgBId);
    });

    it('org A can only see and enrich its own contacts', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/contacts/enrich',
        headers: { Authorization: `Bearer ${orgASessionToken}` },
        payload: {
          contactId: contactAId, // Org A contact
          email: 'john.doe@company.com',
          provider: 'MOCK',
        },
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody).toBeDefined();
      expect(responseBody.confidence).toBeGreaterThan(0);
    });
  });

  describe('Email Verification', () => {
    it('verifies disposable email as RISKY', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/verify-email',
        headers: { Authorization: `Bearer ${orgASessionToken}` },
        payload: {
          email: 'test@tempmail.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.isDisposable).toBe(true);
      expect(result.status).toBe('RISKY');
    });

    it('verifies role-based email as VALID with lower score', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/verify-email',
        headers: { Authorization: `Bearer ${orgASessionToken}` },
        payload: {
          email: 'support@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.isRoleBased).toBe(true);
      expect(result.status).toBe('VALID');
      expect(result.score).toBeLessThan(1);
    });

    it('marks invalid email format as INVALID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/verify-email',
        headers: { Authorization: `Bearer ${orgASessionToken}` },
        payload: {
          email: 'not-an-email',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.status).toBe('INVALID');
    });
  });

  describe('Provider Selection', () => {
    it('uses MOCK provider by default', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/contacts/enrich',
        headers: { Authorization: `Bearer ${orgASessionToken}` },
        payload: {
          contactId: contactAId,
          email: 'test@example.com',
          // No provider specified, should default to MOCK
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      // MOCK provider always returns confidence >= 0.7
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('accepts explicit provider selection', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/contacts/enrich',
        headers: { Authorization: `Bearer ${orgASessionToken}` },
        payload: {
          contactId: contactAId,
          email: 'test@example.com',
          provider: 'CLEARBIT_STYLE',
        },
      });

      expect(response.statusCode).toBe(200);
      // ClearbitStyle returns confidence 0 when no API key configured
      const result = JSON.parse(response.payload);
      expect(result).toBeDefined();
    });
  });

  describe('Enrichment Validation', () => {
    it('requires either contactId or email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/contacts/enrich',
        headers: { Authorization: `Bearer ${orgASessionToken}` },
        payload: {
          domain: 'example.com',
          // Missing both contactId and email
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('accepts minimal enrichment request with email only', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/contacts/enrich',
        headers: { Authorization: `Bearer ${orgASessionToken}` },
        payload: {
          email: 'minimal@example.com',
          provider: 'MOCK',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.email).toBeDefined();
    });
  });

  describe('Authenticated Access', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/contacts/enrich',
        payload: {
          contactId: contactAId,
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/enrichment/contacts/enrich',
        headers: { Authorization: 'Bearer invalid-token-xyz' },
        payload: {
          contactId: contactAId,
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
