import { z } from 'zod';
import { enrichmentProviderKindSchema, emailVerificationStatusSchema } from './enums';

export const enrichContactRequestSchema = z.object({
  contactId: z.string().cuid().optional(),
  email: z.string().email().optional(),
  domain: z.string().optional(),
  fullName: z.string().optional(),
  provider: enrichmentProviderKindSchema.default('MOCK'),
});
export type EnrichContactRequest = z.infer<typeof enrichContactRequestSchema>;

export const enrichmentResultSchema = z.object({
  email: z.string().email().optional(),
  emailStatus: emailVerificationStatusSchema.optional(),
  title: z.string().optional(),
  companyName: z.string().optional(),
  companyDomain: z.string().optional(),
  linkedinUrl: z.string().optional(),
  confidence: z.number().min(0).max(1),
});
export type EnrichmentResult = z.infer<typeof enrichmentResultSchema>;

export const verifyEmailRequestSchema = z.object({
  email: z.string().email(),
});

export const verifyEmailResultSchema = z.object({
  email: z.string().email(),
  status: emailVerificationStatusSchema,
  score: z.number().min(0).max(1),
  mxFound: z.boolean(),
  isDisposable: z.boolean(),
  isRoleBased: z.boolean(),
  isCatchAll: z.boolean(),
});
export type VerifyEmailResult = z.infer<typeof verifyEmailResultSchema>;
