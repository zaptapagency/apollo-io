# Architecture & Process Decisions

This log records non-obvious decisions made while building Prospect, in chronological
order. Each entry states the decision and why it was made.

## Environment constraints discovered during Phase 0

- **No Docker Desktop is installed/running in this environment.** `docker`, `docker
  compose` are unavailable on PATH and no Docker service is registered. Decision:
  build everything so `docker compose up` is correct and will work wherever Docker
  is available (verified via CI, which runs real `docker compose` on Linux runners),
  but locally in this environment I validate via native `pnpm` build/lint/test
  instead of an actual `docker compose up` run. This is called out explicitly in
  GAPS.md — it is not something to gloss over.
- **pnpm was not on PATH.** Installed via `npm install -g pnpm`; added
  `~/.bashrc` PATH export so subsequent shells pick it up. Pinned
  `packageManager` in root `package.json` to the resolved version (10.34.4) so
  Turborepo (which requires this field) and CI resolve consistently.
- **Windows blocks unprivileged symlink creation.** Next.js's `output: 'standalone'`
  trace-copy step creates symlinks into `.next/standalone/node_modules` and fails
  with `EPERM` unless Developer Mode or admin rights are enabled. Decision: do not
  use `output: 'standalone'`. Instead, the web Dockerfile copies the full
  `node_modules` tree into the runtime image and runs `pnpm --filter @prospect/web
  start`. This is slightly larger but has zero platform-specific build behavior and
  works identically in CI (Linux) and prod.

## Monorepo & tooling

- **pnpm workspaces + Turborepo**, as mandated. Root `tsconfig.base.json` is
  extended by every package; `strict: true` plus `noUncheckedIndexedAccess` is
  enabled everywhere — no per-package opt-outs.
- **ESLint 8 + `@typescript-eslint` 7** (not ESLint 9 flat config) to stay
  compatible with `eslint-config-next` 14, which does not yet support flat config
  cleanly. `no-explicit-any` is an error, not a warning, repo-wide.
- **Vitest everywhere** (not Jest) for unit tests in every package, including the
  Next.js app (component/util tests) — consistent tooling, fast, ESM-native.
- Each app/package owns its own `tsconfig.json`, `vitest.config.ts`, and
  `package.json` scripts (`build`, `lint`, `typecheck`, `test`, `test:cov`) so
  Turborepo can cache and parallelize per-package.

## Data model (packages/db/prisma/schema.prisma)

- **Every tenant-owned table carries `organizationId` directly** (denormalized
  rather than only reachable via join), even where it could be derived through a
  relation (e.g. `Activity.organizationId` even though it's reachable via
  `contactId`/`dealId`). This is deliberate: it lets every Prisma query enforce
  tenant isolation with a single flat `where: { organizationId }` clause instead of
  nested joins, which is both faster and much harder to get wrong in application
  code — the single biggest source of cross-tenant data leaks in multi-tenant SaaS
  is a forgotten join filter.
- **`Session` and `ApiKey` are the two credential shapes**, unified behind one
  `Authorization: Bearer <token>` header in the API (see AuthGuard). Session tokens
  are opaque random strings stored server-side (not JWTs) so they can be revoked
  instantly — appropriate for a product where "log out everywhere" and "revoke API
  key" are real support requests. API keys are `psk_`-prefixed, hashed at rest
  (SHA-256; the raw key is shown once at creation, matching Stripe/GitHub UX).
- **`CompanySize` is a bucketed enum**, not a raw range, so it can be a fast
  indexed/faceted filter (like Apollo's employee-count buckets) while
  `employeeCount` remains available for min/max range queries. The bucketing logic
  (`companySizeFromCount`) lives once in `packages/db/src/company-size.ts` and is
  unit-tested; both the seed script and (later) the create/update company service
  call it, so the bucket can never drift from the raw count.
- **`SequenceStep` has a `variantKey` column (default `"A"`) and is unique on
  `(sequenceId, order, variantKey)`** rather than modeling A/B variants as a
  separate table. This lets a single step "slot" (e.g. step 1) hold multiple
  variants that share the same position in the sequence and the same `waitDays`,
  which mirrors how Apollo's sequence builder actually works (you add a variant to
  an existing step, you don't create a parallel timeline).
- **Enrollment progress is tracked via `SequenceEnrollment.currentStepOrder` +
  `SequenceStepExecution` rows**, not by mutating the step itself, so the full
  send history per contact is preserved (needed for analytics and for "why did
  this contact get this email" support debugging).
- **Email engagement events (`EmailEvent`) are append-only**, keyed by
  `emailMessageId`, rather than boolean flags on `EmailMessage` (e.g.
  `wasOpened`). A contact can open an email multiple times; open/click counts and
  timelines in Analytics need the full event stream, not just the first
  occurrence.
- **`DailyMetric` is a pre-aggregated rollup table**, separate from computing
  analytics live from `Activity`/`EmailEvent` on every request. Decision: nightly
  (or on-write, incrementally) aggregation into `DailyMetric` keeps the analytics
  dashboards fast regardless of org size, at the cost of eventual (not real-time)
  consistency for historical charts — acceptable for sales analytics, unlike e.g.
  billing numbers.
- **Custom fields use a generic `CustomFieldDefinition` + `CustomFieldValue`
  EAV pattern** scoped per org/entity, rather than a JSON blob column on
  Company/Contact/Deal. This is slower to query than a JSONB column but makes
  custom fields independently filterable/indexable per definition, and matches how
  Apollo/most CRMs expose "manage custom fields" as first-class schema.

## API kernel (apps/api/src/common)

- **A single global `AuthGuard` resolves both session and API-key auth**, and
  attaches one `AuthContext` shape (`{ userId, organizationId, role, authMethod
  }`) to the request. Every downstream controller/service reads
  `req.auth.organizationId` — **client-supplied organization ids in body/query are
  never trusted**. This is the tenant-isolation invariant the whole API is built
  around; Workstream E's task list includes a test proving org A cannot read org B
  data through every mutating and read endpoint that takes an id.
- **`RolesGuard` uses a linear hierarchy** (`READ_ONLY < REP < MANAGER < ADMIN <
  OWNER`) rather than a permission-bitmask/ACL system. Apollo's own role model is a
  simple ladder, not fine-grained ACLs, and a hierarchy is enough for every access
  rule in this product's scope (billing/API keys need ADMIN+, everything else REP+
  can touch their own records, MANAGER+ can touch teammates').
- **Validation uses `ZodValidationPipe` wrapping schemas from `@prospect/shared`**,
  not `class-validator` DTOs (Nest's default). This lets the exact same schema
  validate on the client (React Hook Form via `@hookform/resolvers/zod`) and the
  server, with no duplication — the schemas in `packages/shared/src` are the single
  source of truth for both the OpenAPI spec (generated via `@nestjs/swagger`
  `DocumentBuilder`, hand-annotated per route) and form validation.
- **Rate limiting is global via `@nestjs/throttler`** (`APP_GUARD`), 120 req/min
  default, with per-API-key overrides stored on `ApiKey.rateLimitPerMinute` applied
  in Workstream E's key-management service — satisfies "rate limiting" as a
  platform-wide concern rather than bolting it onto individual routes.

## OpenAPI contract strategy

- Rather than hand-writing a static OpenAPI YAML file that can drift from the
  implementation, the contract is **generated from the NestJS controllers via
  `@nestjs/swagger`'s `DocumentBuilder`**, served at `/docs` (Swagger UI) and
  exportable as `openapi.json`. The zod schemas in `@prospect/shared` are the
  actual runtime contract (enforced by `ZodValidationPipe`); Swagger decorators on
  controllers describe them for the generated spec. This guarantees the "frozen
  contract" workstreams integrate against is always in sync with real validation
  behavior, which a hand-maintained spec cannot guarantee.

## Seed data

- The mock enrichment/dev-seed dataset (10k companies / 50k contacts, via
  `@faker-js/faker`) is generated in batched `createMany` calls (1,000 rows/batch)
  to stay fast and avoid Postgres parameter-count limits. `SEED_COMPANY_COUNT` /
  `SEED_CONTACT_COUNT` env vars let CI run a much smaller seed (200/1,000) for fast
  e2e runs while local dev gets the full realistic volume.

## What's next (fan-out)

Phase 0 contracts (Prisma schema, `@prospect/shared` zod schemas, API auth/RBAC
kernel, docker-compose, CI) are frozen as of this commit. Workstreams A–F build
against them independently; module-level decisions made inside each workstream are
appended to this file under a dated subheading as they land.
