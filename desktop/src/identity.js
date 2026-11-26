// Sunucu kimliği doğrulayıcı (saf mantık): nonce üretir, parmak izi hesaplar,
// sunucunun /api/identity yanıtını doğrular. Yalnızca node:crypto kullanır.
// Yanıttaki her alan düşman girdi sayılır: hiçbir işlev hata fırlatmaz.
import crypto from 'node:crypto';

// Sunucudaki (server/src/identity.js) önekle birebir aynı olmalı.
export const IDENTITY_PREFIX = 'ipchat-kimlik-v1:';

// Sunucu süreci kimlik dosyasını okuyamayınca bu kodla çıkar; server/src/identity.js ile aynı olmalı
// (test denetler). Masaüstü sunucu kodunu çalışırken içe aktarmaz, sayıyı kendisi tutar.
export const IDENTITY_EXIT_CODE = 78;

// Anahtar ve imza için üst sınır: Ed25519 SPKI ~60, imza ~88 karakterdir.
const MAX_FIELD_LENGTH = 200;
const NONCE_RE = /^[0-9a-f]{64}$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// 32 rastgele bayt -> 64 küçük harfli hex.
export function makeNonce() {
  return crypto.randomBytes(32).toString('hex');
}

// Parmak izi: SPKI DER baytlarının SHA-256'sı, küçük harfli hex (sunucuyla aynı).
// String olmayan girdi için hata fırlatmaz, boş string döner.
export function fingerprintOf(publicKeyB64) {
  try {
    if (typeof publicKeyB64 !== 'string') return '';
    return crypto.createHash('sha256').update(Buffer.from(publicKeyB64, 'base64')).digest('hex');
  } catch {
    return '';
  }
}

// Ekranda gösterilen kısa biçim: ilk 12 hex, büyük harf, 4'lü gruplar (A1B2-C3D4-E5F6).
export function shortFingerprint(fp) {
  try {
    if (typeof fp !== 'string') return '';
    const head = fp.slice(0, 12).toUpperCase();
    return head.match(/.{1,4}/g)?.join('-') ?? '';
  } catch {
    return '';
  }
}

const isBoundedString = (v) => typeof v === 'string' && v.length > 0 && v.length <= MAX_FIELD_LENGTH;

export function verifyIdentityReply(reply, nonce) {
  try {
    if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) return { ok: false };
    if (reply === null || typeof reply !== 'object' || Array.isArray(reply)) return { ok: false };
    if (reply.app !== 'ipchat') return { ok: false };

    const { publicKey, signature, fingerprint } = reply;
    // Ayrıştırmadan önce tür ve uzunluk denetimi.
    if (!isBoundedString(publicKey) || !isBoundedString(signature)) return { ok: false };
    if (!BASE64_RE.test(publicKey) || !BASE64_RE.test(signature)) return { ok: false };

    const key = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ed25519') return { ok: false };

    const computed = fingerprintOf(publicKey);
    // Yanıt kendi parmak izini bildiriyorsa, anahtardan hesaplananla aynı olmalı.
    if (fingerprint !== undefined && fingerprint !== computed) return { ok: false };

    const valid = crypto.verify(
      null,
      Buffer.from(IDENTITY_PREFIX + nonce),
      key,
      Buffer.from(signature, 'base64')
    );
    if (valid !== true) return { ok: false };

    return { ok: true, publicKey, fingerprint: computed };
  } catch {
    return { ok: false };
  }
}
