import { Router } from 'express';
import { requireAuth } from './auth.js';
import { unreadCounts, markRead, UnreadError } from '../unread.js';

export const unreadRouter = Router();

unreadRouter.use(requireAuth);

unreadRouter.get('/unread', (req, res) => {
  res.json(unreadCounts(req.user.id));
});

unreadRouter.post('/read', (req, res) => {
  try {
    markRead(req.user.id, req.body?.type, Number(req.body?.id));
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof UnreadError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});
