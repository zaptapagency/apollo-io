import { z } from 'zod';

export const companySizeSchema = z.enum([
  'SIZE_1_10',
  'SIZE_11_50',
  'SIZE_51_200',
  'SIZE_201_500',
  'SIZE_501_1000',
  'SIZE_1001_5000',
  'SIZE_5001_10000',
  'SIZE_10001_PLUS',
]);
export type CompanySize = z.infer<typeof companySizeSchema>;

export const seniorityLevelSchema = z.enum([
  'OWNER',
  'FOUNDER',
  'C_SUITE',
  'VP',
  'DIRECTOR',
  'MANAGER',
  'SENIOR',
  'ENTRY',
  'INTERN',
]);
export type SeniorityLevel = z.infer<typeof seniorityLevelSchema>;

export const emailVerificationStatusSchema = z.enum([
  'UNVERIFIED',
  'VALID',
  'RISKY',
  'INVALID',
  'UNKNOWN',
]);
export type EmailVerificationStatus = z.infer<typeof emailVerificationStatusSchema>;

export const sequenceStepTypeSchema = z.enum(['EMAIL', 'CALL', 'LINKEDIN_TASK', 'WAIT']);
export type SequenceStepType = z.infer<typeof sequenceStepTypeSchema>;

export const sequenceStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
export type SequenceStatus = z.infer<typeof sequenceStatusSchema>;

export const enrollmentStatusSchema = z.enum([
  'ACTIVE',
  'COMPLETED',
  'EXITED_REPLY',
  'EXITED_BOUNCE',
  'EXITED_MANUAL',
  'EXITED_BOOKED',
]);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

export const taskTypeSchema = z.enum(['CALL', 'EMAIL', 'LINKEDIN', 'GENERAL']);
export const taskStatusSchema = z.enum(['OPEN', 'COMPLETED', 'SKIPPED']);

export const enrichmentProviderKindSchema = z.enum(['MOCK', 'CLEARBIT_STYLE', 'HUNTER_STYLE']);
export type EnrichmentProviderKind = z.infer<typeof enrichmentProviderKindSchema>;
