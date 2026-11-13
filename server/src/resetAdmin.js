import bcrypt from 'bcryptjs';

export function resetAdmin(db, username, newPassword) {
  if (!newPassword || newPassword.length < 4) throw new Error('Yeni şifre en az 4 karakter olmalı');
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!user) throw new Error(`Kullanıcı bulunamadı: ${username}`);

  db.prepare("UPDATE users SET password_hash = ?, status = 'active', is_admin = 1, pin_hash = NULL WHERE id = ?").run(
    bcrypt.hashSync(newPassword, 10),
    user.id
  );
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM devices WHERE user_id = ?').run(user.id);
}
