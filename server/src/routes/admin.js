import { Router } from 'express';
import { requireAuth } from './auth.js';
import { listUsers, applyAction, pendingSummary, AdminError } from '../admin.js';

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Yönetici yetkisi gerekli' });
  next();
}

export function createAdminRouter(io) {
  const router = Router();
  router.use('/admin', requireAuth, requireAdmin);

  router.get('/admin/users', (req, res) => res.json(listUsers()));
  router.get('/admin/pending-count', (req, res) => res.json(pendingSummary()));

  router.post('/admin/users/:id/:action', (req, res) => {
    try {
      applyAction(req.user.id, Number(req.params.id), req.params.action, io);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof AdminError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  });

  return router;
}
