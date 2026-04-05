import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import * as tagService from '../services/tagService';
import { validateBody } from '../middleware/zodValidate';
import { CreateTagSchema, UpdateTagSchema } from '../schemas/tagSchemas';

const router = express.Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({ tags: tagService.listTags(authReq.user.id) });
});

router.post('/', authenticate, validateBody(CreateTagSchema), (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { name, color } = req.body;
  const tag = tagService.createTag(authReq.user.id, name, color);
  res.status(201).json({ tag });
});

router.put('/:id', authenticate, validateBody(UpdateTagSchema), (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { name, color } = req.body;
  if (!tagService.getTagByIdAndUser(req.params.id, authReq.user.id))
    return res.status(404).json({ error: 'Tag not found' });
  const tag = tagService.updateTag(req.params.id, name, color);
  res.json({ tag });
});

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!tagService.getTagByIdAndUser(req.params.id, authReq.user.id))
    return res.status(404).json({ error: 'Tag not found' });
  tagService.deleteTag(req.params.id);
  res.json({ success: true });
});

export default router;
