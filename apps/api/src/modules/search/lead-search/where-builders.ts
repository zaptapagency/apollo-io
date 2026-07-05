import type { Prisma, EnrollmentStatus } from '@prospect/db';
import type { CompanyFilter, ContactFilter, EngagementFilter } from '@prospect/shared';
import { parseBooleanQuery } from './boolean-query';

/** Activity types that represent an actual outreach touch on a contact (used by the
 * `neverContacted`/`lastContactedBefore`/`lastContactedAfter` engagement facets). */
const CONTACT_TOUCH_ACTIVITY_TYPES = ['EMAIL_SENT', 'CALL_LOGGED'] as const;

/**
 * Translates every `CompanyFilter` facet into a Prisma `where` clause, always scoped to the
 * caller's organization. Pure function — no I/O — so it is exhaustively unit-testable.
 */
export function buildCompanyWhere(
  filter: CompanyFilter | undefined,
  organizationId: string,
): Prisma.CompanyWhereInput {
  const f = filter ?? {};
  const and: Prisma.CompanyWhereInput[] = [];

  if (f.companyKeyword) {
    const keyword = f.companyKeyword;
    and.push({
      OR: [
        { name: { contains: keyword, mode: 'insensitive' } },
        { domain: { contains: keyword, mode: 'insensitive' } },
        { industry: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ],
    });
  }

  if (f.companyName?.length) and.push({ name: { in: f.companyName } });
  if (f.companyDomain?.length) and.push({ domain: { in: f.companyDomain } });
  if (f.industry?.length) and.push({ industry: { in: f.industry } });
  if (f.excludeIndustry?.length) and.push({ industry: { notIn: f.excludeIndustry } });

  if (f.employeeCountMin !== undefined) and.push({ employeeCount: { gte: f.employeeCountMin } });
  if (f.employeeCountMax !== undefined) and.push({ employeeCount: { lte: f.employeeCountMax } });

  if (f.companySize?.length) and.push({ companySize: { in: f.companySize } });

  if (f.annualRevenueMin !== undefined) {
    and.push({ annualRevenue: { gte: BigInt(f.annualRevenueMin) } });
  }
  if (f.annualRevenueMax !== undefined) {
    and.push({ annualRevenue: { lte: BigInt(f.annualRevenueMax) } });
  }

  if (f.foundedYearMin !== undefined) and.push({ foundedYear: { gte: f.foundedYearMin } });
  if (f.foundedYearMax !== undefined) and.push({ foundedYear: { lte: f.foundedYearMax } });

  if (f.companyCity?.length) and.push({ city: { in: f.companyCity } });
  if (f.companyState?.length) and.push({ state: { in: f.companyState } });
  if (f.companyCountry?.length) and.push({ country: { in: f.companyCountry } });

  if (f.techStackIncludes?.length) and.push({ techStack: { hasSome: f.techStackIncludes } });
  if (f.techStackExcludes?.length) {
    and.push({ NOT: { techStack: { hasSome: f.techStackExcludes } } });
  }

  if (f.fundingStage?.length) and.push({ fundingStage: { in: f.fundingStage } });
  if (f.totalFundingMin !== undefined) {
    and.push({ totalFundingUsd: { gte: BigInt(f.totalFundingMin) } });
  }
  if (f.totalFundingMax !== undefined) {
    and.push({ totalFundingUsd: { lte: BigInt(f.totalFundingMax) } });
  }

  if (f.companyTagIds?.length) {
    and.push({ tags: { some: { tagId: { in: f.companyTagIds } } } });
  }
  if (f.companyListIds?.length) {
    and.push({ listMembers: { some: { listId: { in: f.companyListIds } } } });
  }

  if (f.excludeCompanyIds?.length) and.push({ id: { notIn: f.excludeCompanyIds } });
  if (f.companyIds?.length) and.push({ id: { in: f.companyIds } });

  if (f.descriptionKeyword) {
    and.push({ description: { contains: f.descriptionKeyword, mode: 'insensitive' } });
  }

  if (f.hasLinkedin !== undefined) {
    and.push({ linkedinUrl: f.hasLinkedin ? { not: null } : null });
  }
  if (f.hasLogo !== undefined) {
    and.push({ logoUrl: f.hasLogo ? { not: null } : null });
  }

  return { organizationId, ...(and.length ? { AND: and } : {}) };
}

/**
 * Translates `ContactFilter` + the cross-entity `EngagementFilter` facets into a Prisma `where`
 * clause, always scoped to the caller's organization. Engagement facets reference
 * `activities`/`sequenceEnrollments`/`tasks`/`deals`/`emailMessages` relations on `Contact` —
 * these relations exist on the frozen schema even though the sequences/CRM modules haven't
 * landed yet, so filtering against them is valid Prisma today (it will simply match zero rows
 * until those modules start writing data).
 */
export function buildContactWhere(
  filter: ContactFilter | undefined,
  engagement: EngagementFilter | undefined,
  organizationId: string,
): Prisma.ContactWhereInput {
  const f = filter ?? {};
  const e = engagement ?? {};
  const and: Prisma.ContactWhereInput[] = [];

  if (f.contactKeyword) {
    const keyword = f.contactKeyword;
    and.push({
      OR: [
        { firstName: { contains: keyword, mode: 'insensitive' } },
        { lastName: { contains: keyword, mode: 'insensitive' } },
        { title: { contains: keyword, mode: 'insensitive' } },
        { email: { contains: keyword, mode: 'insensitive' } },
      ],
    });
  }

  if (f.fullName?.length) {
    and.push({ OR: f.fullName.map(fullNameClause) });
  }

  if (f.title?.length) and.push({ title: { in: f.title } });
  if (f.titleKeyword) and.push({ title: { contains: f.titleKeyword, mode: 'insensitive' } });
  if (f.excludeTitle?.length) and.push({ title: { notIn: f.excludeTitle } });

  if (f.seniority?.length) and.push({ seniority: { in: f.seniority } });
  if (f.department?.length) and.push({ department: { in: f.department } });

  if (f.emailStatus?.length) and.push({ emailStatus: { in: f.emailStatus } });
  if (f.emailScoreMin !== undefined) and.push({ emailScore: { gte: f.emailScoreMin } });

  if (f.hasEmail !== undefined) and.push({ email: f.hasEmail ? { not: null } : null });
  if (f.hasPhone !== undefined) and.push({ phone: f.hasPhone ? { not: null } : null });
  if (f.hasLinkedin !== undefined) and.push({ linkedinUrl: f.hasLinkedin ? { not: null } : null });

  if (f.contactCity?.length) and.push({ city: { in: f.contactCity } });
  if (f.contactState?.length) and.push({ state: { in: f.contactState } });
  if (f.contactCountry?.length) and.push({ country: { in: f.contactCountry } });

  if (f.contactTagIds?.length) {
    and.push({ tags: { some: { tagId: { in: f.contactTagIds } } } });
  }
  if (f.contactListIds?.length) {
    and.push({ listMembers: { some: { listId: { in: f.contactListIds } } } });
  }

  if (f.excludeContactIds?.length) and.push({ id: { notIn: f.excludeContactIds } });
  if (f.contactIds?.length) and.push({ id: { in: f.contactIds } });

  if (f.excludeExistingSequenceContacts) {
    and.push({ sequenceEnrollments: { none: {} } });
  }

  if (f.booleanQuery) {
    const parsed = parseBooleanQuery(f.booleanQuery);
    if (parsed) and.push(parsed);
  }

  if (f.isVerifiedOnly) and.push({ emailStatus: 'VALID' });

  // ── Engagement (cross-entity CRM/sequence) facets ──
  if (e.neverContacted) {
    and.push({ activities: { none: { type: { in: [...CONTACT_TOUCH_ACTIVITY_TYPES] } } } });
  }
  if (e.lastContactedAfter) {
    and.push({
      activities: {
        some: { type: { in: [...CONTACT_TOUCH_ACTIVITY_TYPES] }, createdAt: { gte: e.lastContactedAfter } },
      },
    });
  }
  if (e.lastContactedBefore) {
    and.push({
      activities: {
        some: { type: { in: [...CONTACT_TOUCH_ACTIVITY_TYPES] }, createdAt: { lte: e.lastContactedBefore } },
      },
    });
  }

  if (e.inActiveSequence) {
    and.push({ sequenceEnrollments: { some: { status: 'ACTIVE' } } });
  }
  if (e.inSequenceIds?.length) {
    and.push({ sequenceEnrollments: { some: { sequenceId: { in: e.inSequenceIds } } } });
  }
  if (e.excludeInSequenceIds?.length) {
    and.push({ sequenceEnrollments: { none: { sequenceId: { in: e.excludeInSequenceIds } } } });
  }
  if (e.sequenceStatus?.length) {
    and.push({
      sequenceEnrollments: { some: { status: { in: e.sequenceStatus as EnrollmentStatus[] } } },
    });
  }

  if (e.hasOpenTask) {
    and.push({ tasks: { some: { status: 'OPEN' } } });
  }

  if (e.dealStageIds?.length) {
    and.push({ deals: { some: { stageId: { in: e.dealStageIds } } } });
  }
  if (e.hasOpenDeal) {
    and.push({ deals: { some: { stage: { isWon: false, isLost: false } } } });
  }

  if (e.emailOpenedSequenceId) {
    and.push({
      emailMessages: {
        some: {
          events: { some: { type: 'OPEN' } },
          stepExecution: { step: { sequenceId: e.emailOpenedSequenceId } },
        },
      },
    });
  }
  if (e.emailRepliedSequenceId) {
    and.push({
      emailMessages: {
        some: {
          events: { some: { type: 'REPLY' } },
          stepExecution: { step: { sequenceId: e.emailRepliedSequenceId } },
        },
      },
    });
  }

  if (e.mailboxWarmupOnly) {
    and.push({ emailMessages: { some: { mailbox: { warmupEnabled: true } } } });
  }

  if (e.createdAfter) and.push({ createdAt: { gte: e.createdAfter } });
  if (e.createdBefore) and.push({ createdAt: { lte: e.createdBefore } });

  return { organizationId, ...(and.length ? { AND: and } : {}) };
}

function fullNameClause(fullName: string): Prisma.ContactWhereInput {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const last = parts.at(-1);
  if (parts.length >= 2 && last !== undefined) {
    const first = parts.slice(0, -1).join(' ');
    return {
      AND: [
        { firstName: { contains: first, mode: 'insensitive' } },
        { lastName: { contains: last, mode: 'insensitive' } },
      ],
    };
  }
  return {
    OR: [
      { firstName: { contains: fullName, mode: 'insensitive' } },
      { lastName: { contains: fullName, mode: 'insensitive' } },
    ],
  };
}
