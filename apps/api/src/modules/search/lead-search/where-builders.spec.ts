import { describe, expect, it } from 'vitest';
import { buildCompanyWhere, buildContactWhere } from './where-builders';

const ORG = 'org_A';

describe('buildCompanyWhere', () => {
  it('always scopes by organizationId, even with no filter at all', () => {
    const where = buildCompanyWhere(undefined, ORG);
    expect(where).toEqual({ organizationId: ORG });
  });

  it('companyKeyword: ORs across name/domain/industry/description with insensitive contains', () => {
    const where = buildCompanyWhere({ companyKeyword: 'acme' }, ORG);
    expect(where.AND).toEqual([
      {
        OR: [
          { name: { contains: 'acme', mode: 'insensitive' } },
          { domain: { contains: 'acme', mode: 'insensitive' } },
          { industry: { contains: 'acme', mode: 'insensitive' } },
          { description: { contains: 'acme', mode: 'insensitive' } },
        ],
      },
    ]);
  });

  it('companyName: exact match against an array', () => {
    const where = buildCompanyWhere({ companyName: ['Acme', 'Globex'] }, ORG);
    expect(where.AND).toContainEqual({ name: { in: ['Acme', 'Globex'] } });
  });

  it('companyDomain: exact match against an array', () => {
    const where = buildCompanyWhere({ companyDomain: ['acme.com'] }, ORG);
    expect(where.AND).toContainEqual({ domain: { in: ['acme.com'] } });
  });

  it('industry: array membership', () => {
    const where = buildCompanyWhere({ industry: ['SaaS', 'Fintech'] }, ORG);
    expect(where.AND).toContainEqual({ industry: { in: ['SaaS', 'Fintech'] } });
  });

  it('excludeIndustry: notIn', () => {
    const where = buildCompanyWhere({ excludeIndustry: ['Retail'] }, ORG);
    expect(where.AND).toContainEqual({ industry: { notIn: ['Retail'] } });
  });

  it('employeeCountMin/Max: gte/lte range', () => {
    const where = buildCompanyWhere({ employeeCountMin: 10, employeeCountMax: 500 }, ORG);
    expect(where.AND).toContainEqual({ employeeCount: { gte: 10 } });
    expect(where.AND).toContainEqual({ employeeCount: { lte: 500 } });
  });

  it('companySize: array membership against the bucketed enum', () => {
    const where = buildCompanyWhere({ companySize: ['SIZE_1_10', 'SIZE_11_50'] }, ORG);
    expect(where.AND).toContainEqual({ companySize: { in: ['SIZE_1_10', 'SIZE_11_50'] } });
  });

  it('annualRevenueMin/Max: gte/lte as BigInt', () => {
    const where = buildCompanyWhere({ annualRevenueMin: 1_000_000, annualRevenueMax: 5_000_000 }, ORG);
    expect(where.AND).toContainEqual({ annualRevenue: { gte: 1_000_000n } });
    expect(where.AND).toContainEqual({ annualRevenue: { lte: 5_000_000n } });
  });

  it('foundedYearMin/Max: gte/lte range', () => {
    const where = buildCompanyWhere({ foundedYearMin: 2000, foundedYearMax: 2020 }, ORG);
    expect(where.AND).toContainEqual({ foundedYear: { gte: 2000 } });
    expect(where.AND).toContainEqual({ foundedYear: { lte: 2020 } });
  });

  it('companyCity/State/Country: array membership', () => {
    const where = buildCompanyWhere(
      { companyCity: ['SF'], companyState: ['CA'], companyCountry: ['US'] },
      ORG,
    );
    expect(where.AND).toContainEqual({ city: { in: ['SF'] } });
    expect(where.AND).toContainEqual({ state: { in: ['CA'] } });
    expect(where.AND).toContainEqual({ country: { in: ['US'] } });
  });

  it('techStackIncludes: hasSome', () => {
    const where = buildCompanyWhere({ techStackIncludes: ['React', 'Postgres'] }, ORG);
    expect(where.AND).toContainEqual({ techStack: { hasSome: ['React', 'Postgres'] } });
  });

  it('techStackExcludes: NOT hasSome', () => {
    const where = buildCompanyWhere({ techStackExcludes: ['PHP'] }, ORG);
    expect(where.AND).toContainEqual({ NOT: { techStack: { hasSome: ['PHP'] } } });
  });

  it('fundingStage: array membership', () => {
    const where = buildCompanyWhere({ fundingStage: ['SERIES_B'] }, ORG);
    expect(where.AND).toContainEqual({ fundingStage: { in: ['SERIES_B'] } });
  });

  it('totalFundingMin/Max: gte/lte as BigInt', () => {
    const where = buildCompanyWhere({ totalFundingMin: 100, totalFundingMax: 900 }, ORG);
    expect(where.AND).toContainEqual({ totalFundingUsd: { gte: 100n } });
    expect(where.AND).toContainEqual({ totalFundingUsd: { lte: 900n } });
  });

  it('companyTagIds: relation membership via CompanyTag.tagId', () => {
    const where = buildCompanyWhere({ companyTagIds: ['tag_1', 'tag_2'] }, ORG);
    expect(where.AND).toContainEqual({ tags: { some: { tagId: { in: ['tag_1', 'tag_2'] } } } });
  });

  it('companyListIds: relation membership via ListMembership.listId', () => {
    const where = buildCompanyWhere({ companyListIds: ['list_1'] }, ORG);
    expect(where.AND).toContainEqual({ listMembers: { some: { listId: { in: ['list_1'] } } } });
  });

  it('excludeCompanyIds: notIn on id', () => {
    const where = buildCompanyWhere({ excludeCompanyIds: ['c1'] }, ORG);
    expect(where.AND).toContainEqual({ id: { notIn: ['c1'] } });
  });

  it('companyIds: in on id', () => {
    const where = buildCompanyWhere({ companyIds: ['c1', 'c2'] }, ORG);
    expect(where.AND).toContainEqual({ id: { in: ['c1', 'c2'] } });
  });

  it('descriptionKeyword: contains insensitive', () => {
    const where = buildCompanyWhere({ descriptionKeyword: 'widgets' }, ORG);
    expect(where.AND).toContainEqual({ description: { contains: 'widgets', mode: 'insensitive' } });
  });

  it('hasLinkedin true/false maps to not-null / null', () => {
    expect(buildCompanyWhere({ hasLinkedin: true }, ORG).AND).toContainEqual({
      linkedinUrl: { not: null },
    });
    expect(buildCompanyWhere({ hasLinkedin: false }, ORG).AND).toContainEqual({ linkedinUrl: null });
  });

  it('hasLogo true/false maps to not-null / null', () => {
    expect(buildCompanyWhere({ hasLogo: true }, ORG).AND).toContainEqual({ logoUrl: { not: null } });
    expect(buildCompanyWhere({ hasLogo: false }, ORG).AND).toContainEqual({ logoUrl: null });
  });

  it('combines many facets into a single AND array, always with organizationId at the root', () => {
    const where = buildCompanyWhere(
      {
        industry: ['SaaS'],
        employeeCountMin: 50,
        companySize: ['SIZE_51_200'],
        techStackIncludes: ['React'],
        hasLinkedin: true,
        companyTagIds: ['tag_1'],
      },
      ORG,
    );
    expect(where.organizationId).toBe(ORG);
    expect(where.AND).toHaveLength(6);
  });
});

describe('buildContactWhere', () => {
  it('always scopes by organizationId, even with no filters at all', () => {
    const where = buildContactWhere(undefined, undefined, ORG);
    expect(where).toEqual({ organizationId: ORG });
  });

  it('contactKeyword: ORs across firstName/lastName/title/email', () => {
    const where = buildContactWhere({ contactKeyword: 'jane' }, undefined, ORG);
    expect(where.AND).toContainEqual({
      OR: [
        { firstName: { contains: 'jane', mode: 'insensitive' } },
        { lastName: { contains: 'jane', mode: 'insensitive' } },
        { title: { contains: 'jane', mode: 'insensitive' } },
        { email: { contains: 'jane', mode: 'insensitive' } },
      ],
    });
  });

  it('fullName: splits multi-word names into firstName/lastName AND clauses', () => {
    const where = buildContactWhere({ fullName: ['Jane Doe'] }, undefined, ORG);
    expect(where.AND).toContainEqual({
      OR: [
        {
          AND: [
            { firstName: { contains: 'Jane', mode: 'insensitive' } },
            { lastName: { contains: 'Doe', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('fullName: falls back to an OR across both fields for a single-word entry', () => {
    const where = buildContactWhere({ fullName: ['Cher'] }, undefined, ORG);
    expect(where.AND).toContainEqual({
      OR: [
        {
          OR: [
            { firstName: { contains: 'Cher', mode: 'insensitive' } },
            { lastName: { contains: 'Cher', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('title: array membership', () => {
    const where = buildContactWhere({ title: ['VP Sales'] }, undefined, ORG);
    expect(where.AND).toContainEqual({ title: { in: ['VP Sales'] } });
  });

  it('titleKeyword: contains insensitive', () => {
    const where = buildContactWhere({ titleKeyword: 'VP' }, undefined, ORG);
    expect(where.AND).toContainEqual({ title: { contains: 'VP', mode: 'insensitive' } });
  });

  it('excludeTitle: notIn', () => {
    const where = buildContactWhere({ excludeTitle: ['Intern'] }, undefined, ORG);
    expect(where.AND).toContainEqual({ title: { notIn: ['Intern'] } });
  });

  it('seniority: array membership', () => {
    const where = buildContactWhere({ seniority: ['VP', 'DIRECTOR'] }, undefined, ORG);
    expect(where.AND).toContainEqual({ seniority: { in: ['VP', 'DIRECTOR'] } });
  });

  it('department: array membership', () => {
    const where = buildContactWhere({ department: ['Sales'] }, undefined, ORG);
    expect(where.AND).toContainEqual({ department: { in: ['Sales'] } });
  });

  it('emailStatus: array membership', () => {
    const where = buildContactWhere({ emailStatus: ['VALID', 'RISKY'] }, undefined, ORG);
    expect(where.AND).toContainEqual({ emailStatus: { in: ['VALID', 'RISKY'] } });
  });

  it('emailScoreMin: gte', () => {
    const where = buildContactWhere({ emailScoreMin: 0.8 }, undefined, ORG);
    expect(where.AND).toContainEqual({ emailScore: { gte: 0.8 } });
  });

  it('hasEmail/hasPhone/hasLinkedin: not-null / null', () => {
    const where = buildContactWhere(
      { hasEmail: true, hasPhone: false, hasLinkedin: true },
      undefined,
      ORG,
    );
    expect(where.AND).toContainEqual({ email: { not: null } });
    expect(where.AND).toContainEqual({ phone: null });
    expect(where.AND).toContainEqual({ linkedinUrl: { not: null } });
  });

  it('contactCity/State/Country: array membership', () => {
    const where = buildContactWhere(
      { contactCity: ['SF'], contactState: ['CA'], contactCountry: ['US'] },
      undefined,
      ORG,
    );
    expect(where.AND).toContainEqual({ city: { in: ['SF'] } });
    expect(where.AND).toContainEqual({ state: { in: ['CA'] } });
    expect(where.AND).toContainEqual({ country: { in: ['US'] } });
  });

  it('contactTagIds: relation membership via ContactTag.tagId', () => {
    const where = buildContactWhere({ contactTagIds: ['tag_1'] }, undefined, ORG);
    expect(where.AND).toContainEqual({ tags: { some: { tagId: { in: ['tag_1'] } } } });
  });

  it('contactListIds: relation membership via ListMembership.listId', () => {
    const where = buildContactWhere({ contactListIds: ['list_1'] }, undefined, ORG);
    expect(where.AND).toContainEqual({ listMembers: { some: { listId: { in: ['list_1'] } } } });
  });

  it('excludeContactIds/contactIds: notIn/in on id', () => {
    const where = buildContactWhere(
      { excludeContactIds: ['c1'], contactIds: ['c2'] },
      undefined,
      ORG,
    );
    expect(where.AND).toContainEqual({ id: { notIn: ['c1'] } });
    expect(where.AND).toContainEqual({ id: { in: ['c2'] } });
  });

  it('excludeExistingSequenceContacts: sequenceEnrollments none', () => {
    const where = buildContactWhere({ excludeExistingSequenceContacts: true }, undefined, ORG);
    expect(where.AND).toContainEqual({ sequenceEnrollments: { none: {} } });
  });

  it('isVerifiedOnly: forces emailStatus VALID', () => {
    const where = buildContactWhere({ isVerifiedOnly: true }, undefined, ORG);
    expect(where.AND).toContainEqual({ emailStatus: 'VALID' });
  });

  it('booleanQuery: parses into a nested Prisma where clause', () => {
    const where = buildContactWhere({ booleanQuery: 'VP AND Sales' }, undefined, ORG);
    expect(where.AND).toContainEqual({
      AND: [
        {
          OR: [
            { title: { contains: 'VP', mode: 'insensitive' } },
            { department: { contains: 'VP', mode: 'insensitive' } },
            { firstName: { contains: 'VP', mode: 'insensitive' } },
            { lastName: { contains: 'VP', mode: 'insensitive' } },
          ],
        },
        {
          OR: [
            { title: { contains: 'Sales', mode: 'insensitive' } },
            { department: { contains: 'Sales', mode: 'insensitive' } },
            { firstName: { contains: 'Sales', mode: 'insensitive' } },
            { lastName: { contains: 'Sales', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  // ── Engagement facets ──

  it('neverContacted: activities none of the contact-touch types', () => {
    const where = buildContactWhere(undefined, { neverContacted: true }, ORG);
    expect(where.AND).toContainEqual({
      activities: { none: { type: { in: ['EMAIL_SENT', 'CALL_LOGGED'] } } },
    });
  });

  it('lastContactedAfter/Before: activities some with a date range', () => {
    const after = new Date('2024-01-01');
    const before = new Date('2024-06-01');
    const where = buildContactWhere(
      undefined,
      { lastContactedAfter: after, lastContactedBefore: before },
      ORG,
    );
    expect(where.AND).toContainEqual({
      activities: { some: { type: { in: ['EMAIL_SENT', 'CALL_LOGGED'] }, createdAt: { gte: after } } },
    });
    expect(where.AND).toContainEqual({
      activities: { some: { type: { in: ['EMAIL_SENT', 'CALL_LOGGED'] }, createdAt: { lte: before } } },
    });
  });

  it('inActiveSequence: sequenceEnrollments some ACTIVE', () => {
    const where = buildContactWhere(undefined, { inActiveSequence: true }, ORG);
    expect(where.AND).toContainEqual({ sequenceEnrollments: { some: { status: 'ACTIVE' } } });
  });

  it('inSequenceIds/excludeInSequenceIds: some/none on sequenceId', () => {
    const where = buildContactWhere(
      undefined,
      { inSequenceIds: ['seq_1'], excludeInSequenceIds: ['seq_2'] },
      ORG,
    );
    expect(where.AND).toContainEqual({
      sequenceEnrollments: { some: { sequenceId: { in: ['seq_1'] } } },
    });
    expect(where.AND).toContainEqual({
      sequenceEnrollments: { none: { sequenceId: { in: ['seq_2'] } } },
    });
  });

  it('sequenceStatus: some with status in array', () => {
    const where = buildContactWhere(undefined, { sequenceStatus: ['ACTIVE', 'PAUSED'] }, ORG);
    expect(where.AND).toContainEqual({
      sequenceEnrollments: { some: { status: { in: ['ACTIVE', 'PAUSED'] } } },
    });
  });

  it('hasOpenTask: tasks some OPEN', () => {
    const where = buildContactWhere(undefined, { hasOpenTask: true }, ORG);
    expect(where.AND).toContainEqual({ tasks: { some: { status: 'OPEN' } } });
  });

  it('dealStageIds: deals some with stageId in array', () => {
    const where = buildContactWhere(undefined, { dealStageIds: ['stage_1'] }, ORG);
    expect(where.AND).toContainEqual({ deals: { some: { stageId: { in: ['stage_1'] } } } });
  });

  it('hasOpenDeal: deals some with stage not won/lost', () => {
    const where = buildContactWhere(undefined, { hasOpenDeal: true }, ORG);
    expect(where.AND).toContainEqual({
      deals: { some: { stage: { isWon: false, isLost: false } } },
    });
  });

  it('emailOpenedSequenceId: emailMessages some with OPEN event + matching sequence step', () => {
    const where = buildContactWhere(undefined, { emailOpenedSequenceId: 'seq_1' }, ORG);
    expect(where.AND).toContainEqual({
      emailMessages: {
        some: {
          events: { some: { type: 'OPEN' } },
          stepExecution: { step: { sequenceId: 'seq_1' } },
        },
      },
    });
  });

  it('emailRepliedSequenceId: emailMessages some with REPLY event + matching sequence step', () => {
    const where = buildContactWhere(undefined, { emailRepliedSequenceId: 'seq_2' }, ORG);
    expect(where.AND).toContainEqual({
      emailMessages: {
        some: {
          events: { some: { type: 'REPLY' } },
          stepExecution: { step: { sequenceId: 'seq_2' } },
        },
      },
    });
  });

  it('mailboxWarmupOnly: emailMessages some with warmup-enabled mailbox', () => {
    const where = buildContactWhere(undefined, { mailboxWarmupOnly: true }, ORG);
    expect(where.AND).toContainEqual({
      emailMessages: { some: { mailbox: { warmupEnabled: true } } },
    });
  });

  it('createdAfter/createdBefore: contact-level createdAt range', () => {
    const after = new Date('2023-01-01');
    const before = new Date('2023-12-31');
    const where = buildContactWhere(undefined, { createdAfter: after, createdBefore: before }, ORG);
    expect(where.AND).toContainEqual({ createdAt: { gte: after } });
    expect(where.AND).toContainEqual({ createdAt: { lte: before } });
  });

  it('combines contact + engagement facets into a single AND array, scoped by organizationId', () => {
    const where = buildContactWhere(
      { seniority: ['VP'], hasEmail: true, contactTagIds: ['tag_1'] },
      { neverContacted: true, hasOpenTask: true },
      ORG,
    );
    expect(where.organizationId).toBe(ORG);
    expect(where.AND).toHaveLength(5);
  });
});
