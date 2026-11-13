import { Router } from 'express';
import { register, login, setPin, loginWithPin, verifySession } from '../auth.js';

export const authRouter = Router();

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = verifySession(token);
  if (!user) return res.status(401).json({ error: 'Yetkisiz' });
  req.user = user;
  next();
}

authRouter.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;
    res.json(register(username, password));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    res.json(login(username, password));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.post('/login-pin', (req, res) => {
  try {
    const { deviceToken, pin } = req.body;
    res.json(loginWithPin(deviceToken, pin));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.post('/pin/set', requireAuth, (req, res) => {
  try {
    const { pin } = req.body;
    res.json(setPin(req.user.id, pin));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ userId: req.user.id, username: req.user.username, isAdmin: req.user.isAdmin });
});
