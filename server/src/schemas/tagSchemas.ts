import { z } from 'zod';

export const CreateTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100),
  color: z.string().max(20).optional().nullable(),
});

export const UpdateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).optional().nullable(),
});
