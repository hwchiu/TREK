import { z } from 'zod';

export const UpdateDaySchema = z.object({
  title: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  date: z.string().optional().nullable(),
});

export const CreateDayNoteSchema = z.object({
  text: z.string().min(1, 'Text required').max(500),
  time: z.string().max(150).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
});

export const UpdateDayNoteSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  time: z.string().max(150).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
});

export const CreateAccommodationSchema = z.object({
  place_id: z.number({ error: 'place_id, start_day_id, and end_day_id are required' }).int(),
  start_day_id: z.number({ error: 'place_id, start_day_id, and end_day_id are required' }).int(),
  end_day_id: z.number({ error: 'place_id, start_day_id, and end_day_id are required' }).int(),
  check_in: z.string().max(50).optional().nullable(),
  check_out: z.string().max(50).optional().nullable(),
  confirmation: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const UpdateAccommodationSchema = z.object({
  place_id: z.number().int().optional(),
  start_day_id: z.number().int().optional(),
  end_day_id: z.number().int().optional(),
  check_in: z.string().max(50).optional().nullable(),
  check_out: z.string().max(50).optional().nullable(),
  confirmation: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
