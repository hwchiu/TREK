import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const CreateTripSchema = z.object({
  title: z.string({ error: 'Title is required' }).min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  start_date: z.string().regex(dateRegex, 'start_date must be YYYY-MM-DD').optional(),
  end_date: z.string().regex(dateRegex, 'end_date must be YYYY-MM-DD').optional(),
  currency: z.string().max(3).optional(),
  reminder_days: z.number().int().min(0).max(365).optional(),
});

export const UpdateTripSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  start_date: z.string().regex(dateRegex, 'start_date must be YYYY-MM-DD').optional(),
  end_date: z.string().regex(dateRegex, 'end_date must be YYYY-MM-DD').optional(),
  currency: z.string().max(3).optional(),
  reminder_days: z.number().int().min(0).max(365).optional(),
  is_archived: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  cover_image: z.string().max(500).optional().nullable(),
}).passthrough(); // allow extra fields so route logic can inspect all keys

export const AddMemberSchema = z.object({
  identifier: z.string().min(1, 'identifier is required'),
});

export const CopyTripSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});
