// Kimlik deposu (saf mantık): ayar nesnesindeki sabitlenmiş sunucu kimliğini
// okur/yazar ve yerel sunucunun identity.pub dosyasını okur.
// Ayar nesneleri değiştirilmez; her işlev yeni nesne döndürür.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fingerprintOf } from './identity.js';

// Ed25519 SPKI ~60 karakter; bozuk/dev dosyaları ayrıştırmadan reddetmek için üst sınır.
const MAX_KEY_LENGTH = 200;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// Sabitlenmiş kimlik. Biçim bozuksa ya da parmak izi anahtarla uyuşmuyorsa
// "sabitlenmemiş" sayılır (güvenli yön: bozuk kayıt kimliği doğrulamış gibi davranmaz).
export function getPinned(config) {
  const s = config?.serverIdentity;
  if (s === null || typeof s !== 'object' || Array.isArray(s)) return undefined;
  const { publicKey, fingerprint } = s;
  if (typeof publicKey !== 'string' || publicKey === '') return undefined;
  if (typeof fingerprint !== 'string' || fingerprint === '') return undefined;
  if (fingerprint !== fingerprintOf(publicKey)) return undefined;
  return { publicKey, fingerprint };
}

// Bağlanılan adresi kaydeder. identity: nesne -> sabitle, null -> sabitlemeyi sil,
// undefined -> dokunma.
export function withConnection(config, url, identity) {
  const next = { ...config, lastServer: url };
  if (identity === null) {
    delete next.serverIdentity;
  } else if (identity !== undefined) {
    next.serverIdentity = { publicKey: identity.publicKey, fingerprint: identity.fingerprint };
  }
  return next;
}

// Sunucu bilgisini (adres ve kimlik) unutur.
export function withoutServer(config) {
  const next = { ...config };
  delete next.lastServer;
  delete next.serverIdentity;
  return next;
}

// Bu bilgisayardaki sunucunun identity.pub dosyasından kimliği okur.
// Dosya yok/bozuksa null; hata fırlatmaz.
export function readLocalIdentity(serverDataDir) {
  try {
    if (typeof serverDataDir !== 'string' || serverDataDir === '') return null;
    const publicKey = fs.readFileSync(path.join(serverDataDir, 'identity.pub'), 'utf8').trim();
    if (publicKey === '' || publicKey.length > MAX_KEY_LENGTH || !BASE64_RE.test(publicKey)) return null;
    const key = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ed25519') return null;
    return { publicKey, fingerprint: fingerprintOf(publicKey) };
  } catch {
    return null;
  }
}

// Sunucu, kimlik dosyası (identity.key) bozuk ya da eksik olduğu için başlamadığında
// yöneticiye gösterilecek açıklama (tasarım §7.1: sunucu durur ve yöneticiye söyler).
export function identityFailureNotice(serverDataDir) {
  const folder = typeof serverDataDir === 'string' && serverDataDir !== '' ? serverDataDir : 'server-data';
  return {
    message: 'Sunucu başlatılamadı: sunucunun kimlik dosyası bozuk ya da eksik.',
    detail: [
      `Kimlik dosyaları şu klasörde: ${folder}`,
      '',
      'Bu klasördeki identity.key dosyası okunamadı ya da yok (yarım bir yedek geri yüklenmiş olabilir). ' +
        'Hesaplar ve mesajlar aynı klasörde durur; hiçbiri silinmedi.',
      '',
      'Ne yapmalı:',
      '1. server-data klasörünü silme.',
      '2. Bu klasörün tam bir yedeği varsa, identity.key ve identity.pub dosyalarını yedekten bu klasöre geri koy, sonra Ipchat\'i yeniden aç.',
      '3. Yedek yoksa: identity.key ve identity.pub dosyalarını bu klasörden başka bir yere taşı (silme), sonra Ipchat\'i yeniden aç. ' +
        'Sunucu yeni bir kimlik oluşturur; bu yüzden her kullanıcı bir kez "sunucu kimliği değişti" ekranını görür ve onaylaması gerekir. ' +
        'Bunu yapmadan önce kullanıcılara haber ver.',
    ].join('\n'),
  };
}
