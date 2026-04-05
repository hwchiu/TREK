import { z } from 'zod';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const CreateCollabNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().max(10000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  color: z.string().regex(hexColorRegex, 'color must be a valid hex color (#RRGGBB)').optional().nullable(),
  website: z.string().max(500).optional().nullable(),
});

export const UpdateCollabNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(10000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  color: z.string().regex(hexColorRegex, 'color must be a valid hex color (#RRGGBB)').optional().nullable(),
  pinned: z.boolean().or(z.number().int().min(0).max(1)).optional(),
  website: z.string().max(500).optional().nullable(),
});

export const CreatePollSchema = z.object({
  question: z.string().min(1, 'Question is required').max(500),
  options: z.array(z.string()).min(2, 'At least 2 options are required'),
  multiple: z.boolean().optional(),
  multiple_choice: z.boolean().optional(),
  deadline: z.string().optional().nullable(),
});

export const VotePollSchema = z.object({
  option_index: z.number().int().min(0),
});

export const CreateMessageSchema = z.object({
  text: z.string().min(1, 'Message text is required').max(5000),
  reply_to: z.number().int().optional().nullable(),
});

export const ReactMessageSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required').max(10),
});
