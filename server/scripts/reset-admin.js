import { db } from '../src/db.js';
import { resetAdmin } from '../src/resetAdmin.js';

const [username, newPassword] = process.argv.slice(2);
if (!username || !newPassword) {
  console.error('Kullanım: npm run reset-admin -- <kullanici-adi> <yeni-sifre>');
  process.exit(1);
}
try {
  resetAdmin(db, username, newPassword);
  console.log(`Tamam: ${username} aktif yönetici yapıldı ve şifresi sıfırlandı.`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
