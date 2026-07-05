/**
 * Integration test STUB for the search module (Workstream A).
 *
 * These tests spin up a real Postgres via `@testcontainers/postgresql`, apply the frozen Prisma
 * schema to it, boot the full Nest `AppModule` against that database, and exercise the search HTTP
 * surface end to end with `supertest` — no mocks. They complement (not replace) the unit tests
 * colocated next to each service (`src/modules/search/**\/*.spec.ts`), which mock `PrismaService`
 * and run in every environment, including this one.
 *
 * IMPORTANT — this file could NOT be executed in the sandbox this was authored in: Docker is not
 * installed/running there (see root DECISIONS.md / GAPS.md), and `@testcontainers/postgresql`
 * requires a working Docker daemon to pull and start the `postgres` image. The code below is
 * believed correct (types check, imports resolve, mirrors both the documented
 * `@testcontainers/postgresql` v10 API and the sibling `test/platform.int-spec.ts` stub already in
 * this repo) but has only been *reviewed*, not run.
 *
 * Also note: this module's primary query path is Postgres via Prisma (`SearchService`), not the
 * OpenSearch indexer — see DECISIONS.md for why. These tests exercise that Postgres path; they do
 * not (and, without a live OpenSearch cluster, could not) assert anything about documents actually
 * landing in `prospect-companies`/`prospect-contacts`.
 *
 * Run for real with: `pnpm --filter @prospect/api test:integration` on a machine with Docker.
 */
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Search module (integration)', () => {
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
    // No live OpenSearch cluster is available in CI/this sandbox either; pointing at an
    // unreachable node is fine because every OpenSearchIndexerService call is fire-and-forget.
    process.env.OPENSEARCH_NODE = 'http://localhost:9200';

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

  async function ownerToken(): Promise<string> {
    const res = await signUp();
    return res.body.token as string;
  }

  describe('companies', () => {
    it('creates, searches, updates, and deletes a company, tenant-scoped throughout', async () => {
      const token = await ownerToken();

      const created = await request(app.getHttpServer())
        .post('/api/search/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme Inc', domain: 'acme.example.com', employeeCount: 250 });
      expect(created.status).toBe(201);
      expect(created.body.companySize).toBe('SIZE_201_500'); // bucketed from employeeCount

      const search = await request(app.getHttpServer())
        .get('/api/search/companies')
        .query({ 'company.companyDomain': ['acme.example.com'] })
        .set('Authorization', `Bearer ${token}`);
      expect(search.status).toBe(200);
      expect(search.body.total).toBe(1);

      const updated = await request(app.getHttpServer())
        .patch(`/api/search/companies/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ industry: 'SaaS' });
      expect(updated.status).toBe(200);
      expect(updated.body.industry).toBe('SaaS');

      const removed = await request(app.getHttpServer())
        .delete(`/api/search/companies/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(removed.status).toBe(204);
    });

    it('never returns another organization\'s company (tenant isolation)', async () => {
      const tokenA = await ownerToken();
      const tokenB = await ownerToken();

      const created = await request(app.getHttpServer())
        .post('/api/search/companies')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Org A Co' });

      const asB = await request(app.getHttpServer())
        .get(`/api/search/companies/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(asB.status).toBe(404);
    });
  });

  describe('contacts', () => {
    it('rejects a companyId belonging to a different organization', async () => {
      const tokenA = await ownerToken();
      const tokenB = await ownerToken();

      const companyA = await request(app.getHttpServer())
        .post('/api/search/companies')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Org A Co' });

      const contact = await request(app.getHttpServer())
        .post('/api/search/contacts')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ firstName: 'Jane', lastName: 'Doe', companyId: companyA.body.id });
      expect(contact.status).toBe(400);
    });

    it('supports the booleanQuery facet across title/department/first/last name', async () => {
      const token = await ownerToken();
      await request(app.getHttpServer())
        .post('/api/search/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Jane', lastName: 'Doe', title: 'VP Sales' });
      await request(app.getHttpServer())
        .post('/api/search/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Bob', lastName: 'Intern', title: 'Intern' });

      const search = await request(app.getHttpServer())
        .get('/api/search/contacts')
        .query({ 'contact.booleanQuery': 'VP AND NOT Intern' })
        .set('Authorization', `Bearer ${token}`);
      expect(search.status).toBe(200);
      expect(search.body.total).toBe(1);
      expect(search.body.items[0].firstName).toBe('Jane');
    });
  });

  describe('tags and lists', () => {
    it('creates a tag, attaches it to a company, and filters search by companyTagIds', async () => {
      const token = await ownerToken();
      const company = await request(app.getHttpServer())
        .post('/api/search/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tagged Co' });
      const tag = await request(app.getHttpServer())
        .post('/api/search/tags')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hot Lead' });
      expect(tag.status).toBe(201);

      const attach = await request(app.getHttpServer())
        .post(`/api/search/companies/${company.body.id}/tags/${tag.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(attach.status).toBe(204);

      const search = await request(app.getHttpServer())
        .get('/api/search/companies')
        .query({ 'company.companyTagIds': [tag.body.id] })
        .set('Authorization', `Bearer ${token}`);
      expect(search.body.total).toBe(1);
    });

    it('creates a list, adds a company member, and rejects a cross-org company id', async () => {
      const tokenA = await ownerToken();
      const tokenB = await ownerToken();

      const companyB = await request(app.getHttpServer())
        .post('/api/search/companies')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Org B Co' });

      const list = await request(app.getHttpServer())
        .post('/api/search/lists')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'ABM Targets', type: 'COMPANY' });

      const addCrossOrg = await request(app.getHttpServer())
        .post('/api/search/lists/members')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ listId: list.body.id, companyIds: [companyB.body.id] });
      expect(addCrossOrg.status).toBe(400);
    });
  });

  describe('saved searches', () => {
    it('saves a search and re-executes it via GET /search/saved-searches/:id/run', async () => {
      const token = await ownerToken();
      await request(app.getHttpServer())
        .post('/api/search/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme', industry: 'SaaS' });

      const saved = await request(app.getHttpServer())
        .post('/api/search/saved-searches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'SaaS companies',
          entity: 'COMPANY',
          filters: { company: { industry: ['SaaS'] }, page: 1, pageSize: 25, sortDir: 'desc' },
        });
      expect(saved.status).toBe(201);

      const run = await request(app.getHttpServer())
        .get(`/api/search/saved-searches/${saved.body.id}/run`)
        .set('Authorization', `Bearer ${token}`);
      expect(run.status).toBe(200);
      expect(run.body.total).toBe(1);
    });
  });

  describe('CSV import/export', () => {
    it('imports a companies CSV, reporting a per-row validation error for an invalid row', async () => {
      const token = await ownerToken();
      const csv = 'name,domain\nAcme,acme.example.com\n,missing-name.example.com\n';

      const importRes = await request(app.getHttpServer())
        .post('/api/search/csv-imports/companies')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(csv), 'companies.csv');
      expect(importRes.status).toBe(201);
      expect(importRes.body.processedRows).toBe(1);
      expect(importRes.body.errorRows).toBe(1);
    });

    it('exports companies as CSV with the correct content type', async () => {
      const token = await ownerToken();
      await request(app.getHttpServer())
        .post('/api/search/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme' });

      const exportRes = await request(app.getHttpServer())
        .get('/api/search/csv-exports/companies')
        .set('Authorization', `Bearer ${token}`);
      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['content-type']).toContain('text/csv');
      expect(exportRes.text).toContain('Acme');
    });
  });
});
