import { z } from 'zod';
import { sequenceStepTypeSchema, sequenceStatusSchema } from './enums';

export const createSequenceStepSchema = z.object({
  order: z.number().int().min(1),
  type: sequenceStepTypeSchema,
  waitDays: z.number().int().min(0).default(1),
  subject: z.string().max(255).optional(),
  bodyHtml: z.string().max(20_000).optional(),
  variantKey: z.string().max(4).default('A'),
});
export type CreateSequenceStepInput = z.infer<typeof createSequenceStepSchema>;

export const createSequenceSchema = z.object({
  name: z.string().min(1).max(160),
  sendWindowStart: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  sendWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
  sendDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  timezone: z.string().default('UTC'),
  exitOnReply: z.boolean().default(true),
  exitOnBooked: z.boolean().default(true),
  steps: z.array(createSequenceStepSchema).min(1),
});
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;

export const updateSequenceStatusSchema = z.object({
  status: sequenceStatusSchema,
});

export const enrollContactsSchema = z.object({
  sequenceId: z.string().cuid(),
  contactIds: z.array(z.string().cuid()).min(1),
  ownerId: z.string().cuid().optional(),
});
export type EnrollContactsInput = z.infer<typeof enrollContactsSchema>;

export const mailboxConnectSchema = z.object({
  email: z.string().email(),
  provider: z.enum(['GMAIL_OAUTH', 'OUTLOOK_OAUTH', 'SMTP']),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  dailySendLimit: z.number().int().min(1).max(2000).default(50),
});
export type MailboxConnectInput = z.infer<typeof mailboxConnectSchema>;

export const emailEventWebhookSchema = z.object({
  trackingId: z.string(),
  type: z.enum(['OPEN', 'CLICK', 'REPLY', 'BOUNCE', 'UNSUBSCRIBE']),
  metadata: z.record(z.unknown()).optional(),
});
