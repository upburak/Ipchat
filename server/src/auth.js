import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from './db.js';

const genToken = () => crypto.randomBytes(24).toString('hex');

function createSession(userId) {
  const token = genToken();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

export function register(username, password) {
  username = username.trim();
  if (!username || !password) {
    throw new Error('Kullanıcı adı ve şifre gerekli');
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) throw new Error('Bu kullanıcı adı zaten alınmış');

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);
  const userId = info.lastInsertRowid;
  const token = createSession(userId);
  return { userId, username, token };
}

export function login(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new Error('Kullanıcı adı veya şifre hatalı');
  }
  const token = createSession(user.id);
  return { userId: user.id, username: user.username, token };
}

export function setPin(userId, pin) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN 4 haneli rakam olmalı');
  const pinHash = bcrypt.hashSync(pin, 10);
  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pinHash, userId);
  const deviceToken = genToken();
  db.prepare('INSERT INTO devices (user_id, device_token) VALUES (?, ?)').run(userId, deviceToken);
  return { deviceToken };
}

export function loginWithPin(deviceToken, pin) {
  const device = db.prepare('SELECT * FROM devices WHERE device_token = ?').get(deviceToken);
  if (!device) throw new Error('Cihaz tanınmıyor, lütfen şifre ile giriş yapın');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(device.user_id);
  if (!user || !user.pin_hash || !bcrypt.compareSync(pin, user.pin_hash)) {
    throw new Error('PIN hatalı');
  }
  const token = createSession(user.id);
  return { userId: user.id, username: user.username, token };
}

export function verifySession(token) {
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(session.user_id);
  if (!user) return null;
  return user;
}
