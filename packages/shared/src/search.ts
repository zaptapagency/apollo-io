import { z } from 'zod';
import { companySizeSchema, seniorityLevelSchema, emailVerificationStatusSchema } from './enums';
import { paginationSchema, sortSchema } from './common';

/**
 * Combined lead-search filter contract shared by companies + contacts search.
 * Facets are grouped by entity; the search module treats the union as an
 * intersection (AND) of all provided facets, with array facets treated as
 * OR-within-facet, matching Apollo's filter semantics.
 */
export const companyFilterSchema = z.object({
  companyKeyword: z.string().optional(),
  companyName: z.array(z.string()).optional(),
  companyDomain: z.array(z.string()).optional(),
  industry: z.array(z.string()).optional(),
  excludeIndustry: z.array(z.string()).optional(),
  employeeCountMin: z.number().int().min(0).optional(),
  employeeCountMax: z.number().int().min(0).optional(),
  companySize: z.array(companySizeSchema).optional(),
  annualRevenueMin: z.number().int().min(0).optional(),
  annualRevenueMax: z.number().int().min(0).optional(),
  foundedYearMin: z.number().int().optional(),
  foundedYearMax: z.number().int().optional(),
  companyCity: z.array(z.string()).optional(),
  companyState: z.array(z.string()).optional(),
  companyCountry: z.array(z.string()).optional(),
  techStackIncludes: z.array(z.string()).optional(),
  techStackExcludes: z.array(z.string()).optional(),
  fundingStage: z.array(z.string()).optional(),
  totalFundingMin: z.number().int().min(0).optional(),
  totalFundingMax: z.number().int().min(0).optional(),
  companyTagIds: z.array(z.string()).optional(),
  companyListIds: z.array(z.string()).optional(),
  excludeCompanyIds: z.array(z.string()).optional(),
  companyIds: z.array(z.string()).optional(),
  descriptionKeyword: z.string().optional(),
  hasLinkedin: z.boolean().optional(),
  hasLogo: z.boolean().optional(),
});
export type CompanyFilter = z.infer<typeof companyFilterSchema>;

export const contactFilterSchema = z.object({
  contactKeyword: z.string().optional(),
  fullName: z.array(z.string()).optional(),
  title: z.array(z.string()).optional(),
  titleKeyword: z.string().optional(),
  excludeTitle: z.array(z.string()).optional(),
  seniority: z.array(seniorityLevelSchema).optional(),
  department: z.array(z.string()).optional(),
  emailStatus: z.array(emailVerificationStatusSchema).optional(),
  emailScoreMin: z.number().min(0).max(1).optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  hasLinkedin: z.boolean().optional(),
  contactCity: z.array(z.string()).optional(),
  contactState: z.array(z.string()).optional(),
  contactCountry: z.array(z.string()).optional(),
  contactTagIds: z.array(z.string()).optional(),
  contactListIds: z.array(z.string()).optional(),
  excludeContactIds: z.array(z.string()).optional(),
  excludeExistingSequenceContacts: z.boolean().optional(),
  booleanQuery: z.string().optional(),
  isVerifiedOnly: z.boolean().optional(),
  contactIds: z.array(z.string()).optional(),
});
export type ContactFilter = z.infer<typeof contactFilterSchema>;

/** Cross-entity engagement/CRM facets that constrain contacts via joined data. */
export const engagementFilterSchema = z.object({
  lastContactedBefore: z.coerce.date().optional(),
  lastContactedAfter: z.coerce.date().optional(),
  neverContacted: z.boolean().optional(),
  inActiveSequence: z.boolean().optional(),
  inSequenceIds: z.array(z.string()).optional(),
  excludeInSequenceIds: z.array(z.string()).optional(),
  sequenceStatus: z.array(z.string()).optional(),
  hasOpenTask: z.boolean().optional(),
  dealStageIds: z.array(z.string()).optional(),
  hasOpenDeal: z.boolean().optional(),
  emailOpenedSequenceId: z.string().optional(),
  emailRepliedSequenceId: z.string().optional(),
  mailboxWarmupOnly: z.boolean().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
});
export type EngagementFilter = z.infer<typeof engagementFilterSchema>;

export const leadSearchSchema = z
  .object({
    company: companyFilterSchema.optional(),
    contact: contactFilterSchema.optional(),
    engagement: engagementFilterSchema.optional(),
  })
  .merge(paginationSchema)
  .merge(sortSchema);
export type LeadSearchQuery = z.infer<typeof leadSearchSchema>;

export const saveSearchSchema = z.object({
  name: z.string().min(1).max(120),
  entity: z.enum(['COMPANY', 'CONTACT']),
  filters: z.record(z.unknown()),
});
export type SaveSearchInput = z.infer<typeof saveSearchSchema>;

export const csvImportEntitySchema = z.enum(['COMPANY', 'CONTACT']);
