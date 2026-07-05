import { z } from 'zod';
import { companySizeSchema, seniorityLevelSchema } from './enums';

export const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional(),
  industry: z.string().max(120).optional(),
  employeeCount: z.number().int().min(0).optional(),
  companySize: companySizeSchema.optional(),
  annualRevenue: z.number().int().min(0).optional(),
  foundedYear: z.number().int().min(1800).max(2100).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  linkedinUrl: z.string().url().optional(),
  techStack: z.array(z.string()).default([]),
  fundingStage: z.string().max(60).optional(),
  totalFundingUsd: z.number().int().min(0).optional(),
  description: z.string().max(2000).optional(),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export const updateCompanySchema = createCompanySchema.partial();

export const createContactSchema = z.object({
  companyId: z.string().cuid().optional(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  title: z.string().max(160).optional(),
  seniority: seniorityLevelSchema.optional(),
  department: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  linkedinUrl: z.string().url().optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;
export const updateContactSchema = createContactSchema.partial();

export const createListSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['COMPANY', 'CONTACT']),
});

export const addToListSchema = z.object({
  listId: z.string().cuid(),
  companyIds: z.array(z.string().cuid()).optional(),
  contactIds: z.array(z.string().cuid()).optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
});
