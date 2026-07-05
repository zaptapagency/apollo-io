import { z } from 'zod';
import { taskTypeSchema, taskStatusSchema } from './enums';

export const createDealSchema = z.object({
  name: z.string().min(1).max(200),
  companyId: z.string().cuid().optional(),
  contactId: z.string().cuid().optional(),
  stageId: z.string().cuid(),
  amountUsd: z.number().int().min(0).default(0),
  closeDate: z.coerce.date().optional(),
});
export type CreateDealInput = z.infer<typeof createDealSchema>;
export const updateDealSchema = createDealSchema.partial();

export const moveDealStageSchema = z.object({
  stageId: z.string().cuid(),
});

export const createTaskSchema = z.object({
  contactId: z.string().cuid().optional(),
  dealId: z.string().cuid().optional(),
  ownerId: z.string().cuid().optional(),
  type: taskTypeSchema.default('GENERAL'),
  title: z.string().min(1).max(255),
  dueAt: z.coerce.date().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
});

export const createNoteSchema = z.object({
  contactId: z.string().cuid().optional(),
  dealId: z.string().cuid().optional(),
  body: z.string().min(1).max(5000),
});

export const createPipelineStageSchema = z.object({
  name: z.string().min(1).max(80),
  order: z.number().int().min(1),
  probability: z.number().int().min(0).max(100).default(0),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
});

export const createCustomFieldSchema = z.object({
  entity: z.enum(['COMPANY', 'CONTACT', 'DEAL']),
  name: z.string().min(1).max(80),
  type: z.enum(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT']),
  options: z.array(z.string()).default([]),
});
