import { z } from 'zod';
import { orgRoleSchema } from './common';

export const signUpSchema = z.object({
  organizationName: z.string().min(1).max(160),
  name: z.string().min(1).max(160),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: orgRoleSchema.default('REP'),
});

export const updateMemberRoleSchema = z.object({
  role: orgRoleSchema,
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.string()).default([]),
  rateLimitPerMinute: z.number().int().min(1).max(10_000).default(120),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const checkoutSessionSchema = z.object({
  plan: z.enum(['free', 'starter', 'growth', 'enterprise']),
  seats: z.number().int().min(1).max(500),
});
