import { z } from 'zod';

export const CreateBudgetItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  total_price: z.number().min(0),
  category: z.string().max(100).optional(),
  note: z.string().max(500).optional().nullable(),
  persons: z.number().int().min(1).optional().nullable(),
  days: z.number().int().min(1).optional().nullable(),
});

export const UpdateBudgetItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  total_price: z.number().min(0).optional(),
  category: z.string().max(100).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  persons: z.number().int().min(1).optional().nullable(),
  days: z.number().int().min(1).optional().nullable(),
  sort_order: z.number().int().optional(),
});

export const BudgetMembersSchema = z.object({
  user_ids: z.array(z.number().int()),
});

export const TogglePaidSchema = z.object({
  paid: z.boolean().or(z.number().int().min(0).max(1)),
});
