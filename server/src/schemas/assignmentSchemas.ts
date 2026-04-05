import { z } from 'zod';

export const CreateAssignmentSchema = z.object({
  place_id: z.number().int({ message: 'place_id is required' }),
  notes: z.string().max(500).optional().nullable(),
});

export const ReorderAssignmentsSchema = z.object({
  orderedIds: z.array(z.number().int()).min(1),
});

export const MoveAssignmentSchema = z.object({
  new_day_id: z.number().int({ message: 'new_day_id is required' }),
  order_index: z.number().int().optional(),
});

export const UpdateAssignmentTimeSchema = z.object({
  place_time: z.string().max(50).optional().nullable(),
  end_time: z.string().max(50).optional().nullable(),
});

export const AssignmentParticipantsSchema = z.object({
  user_ids: z.array(z.number().int()),
});
