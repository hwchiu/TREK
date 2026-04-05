import { z } from 'zod';

export const CreatePackingItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(200),
  category: z.string().max(100).optional().nullable(),
  checked: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  quantity: z.number().int().min(1).optional(),
  weight_grams: z.number().int().min(0).optional().nullable(),
  bag_id: z.number().int().optional().nullable(),
});

export const UpdatePackingItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(100).optional().nullable(),
  checked: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  weight_grams: z.number().int().min(0).optional().nullable(),
  bag_id: z.number().int().optional().nullable(),
});

export const ReorderPackingSchema = z.object({
  orderedIds: z.array(z.number().int()),
});

export const CreateBagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  color: z.string().max(20).optional().nullable(),
  weight_limit_grams: z.number().int().min(0).optional().nullable(),
});

export const UpdateBagSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  color: z.string().max(20).optional().nullable(),
  weight_limit_grams: z.number().int().min(0).optional().nullable(),
});

export const CategoryAssigneesSchema = z.object({
  user_ids: z.array(z.number().int()),
});
