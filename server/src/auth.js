import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from './db.js';

const genToken = () => crypto.randomBytes(24).toString('hex');

function createSession(userId) {
  const token = genToken();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

const STATUS_ERRORS = {
  pending: 'Hesabın yönetici onayı bekliyor',
  rejected: 'Hesabın reddedildi',
  disabled: 'Hesabın kapatıldı',
};

function assertActive(user) {
  if (user.status !== 'active') {
    throw new Error(STATUS_ERRORS[user.status] || 'Hesap aktif değil');
  }
}

export function register(username, password) {
  username = username.trim();
  if (!username || !password) {
    throw new Error('Kullanıcı adı ve şifre gerekli');
  }
  const passwordHash = bcrypt.hashSync(password, 10);

  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare('SELECT id, status FROM users WHERE username = ?').get(username);
    let userId;
    let status;
    if (existing) {
      if (existing.status !== 'rejected') throw new Error('Bu kullanıcı adı zaten alınmış');
      userId = existing.id;
      status = 'pending';
      db.prepare("UPDATE users SET password_hash = ?, pin_hash = NULL, status = 'pending' WHERE id = ?").run(
        passwordHash,
        userId
      );
    } else {
      const isFirst = !db.prepare('SELECT 1 FROM users LIMIT 1').get();
      status = isFirst ? 'active' : 'pending';
      const info = db
        .prepare('INSERT INTO users (username, password_hash, status, is_admin) VALUES (?, ?, ?, ?)')
        .run(username, passwordHash, status, isFirst ? 1 : 0);
      userId = Number(info.lastInsertRowid);
    }
    db.exec('COMMIT');
    if (status !== 'active') return { userId, username, status };
    return { userId, username, status, isAdmin: true, token: createSession(userId) };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function login(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new Error('Kullanıcı adı veya şifre hatalı');
  }
  assertActive(user);
  const token = createSession(user.id);
  return { userId: user.id, username: user.username, isAdmin: user.is_admin === 1, token };
}

export function setPin(userId, pin) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN 4 haneli rakam olmalı');
  const pinHash = bcrypt.hashSync(pin, 10);
  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pinHash, userId);
  const deviceToken = genToken();
  db.prepare('INSERT INTO devices (user_id, device_token) VALUES (?, ?)').run(userId, deviceToken);
  return { deviceToken };
}

const MAX_PIN_ATTEMPTS = 5;

export function loginWithPin(deviceToken, pin) {
  const device = db.prepare('SELECT * FROM devices WHERE device_token = ?').get(deviceToken);
  if (!device) throw new Error('Cihaz tanınmıyor, lütfen şifre ile giriş yapın');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(device.user_id);
  if (!user || !user.pin_hash || !bcrypt.compareSync(String(pin), user.pin_hash)) {
    if (device.failed_attempts + 1 >= MAX_PIN_ATTEMPTS) {
      db.prepare('DELETE FROM devices WHERE id = ?').run(device.id);
    } else {
      db.prepare('UPDATE devices SET failed_attempts = failed_attempts + 1 WHERE id = ?').run(device.id);
    }
    throw new Error('PIN hatalı');
  }
  assertActive(user);
  db.prepare('UPDATE devices SET failed_attempts = 0 WHERE id = ?').run(device.id);
  const token = createSession(user.id);
  return { userId: user.id, username: user.username, isAdmin: user.is_admin === 1, token };
}

export function verifySession(token) {
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  const user = db
    .prepare('SELECT id, username, status, is_admin FROM users WHERE id = ?')
    .get(session.user_id);
  if (!user || user.status !== 'active') return null;
  return { id: user.id, username: user.username, isAdmin: user.is_admin === 1 };
}
