// Sunucu kimliği: Ed25519 anahtar çifti. Sunucu bununla meydan okumaları (nonce) imzalar;
// istemci parmak izini sabitleyip sonraki bağlantılarda doğrular.
// Bu dosya yalnızca node:* yerleşik modüllerini içe aktarır (db.js yok): masaüstü testleri doğrudan içe aktarır.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class IdentityError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'IdentityError';
  }
}

export const IDENTITY_PREFIX = 'ipchat-kimlik-v1:';
export const KEY_FILE = 'identity.key';
export const PUB_FILE = 'identity.pub';

// Parmak izi: açık anahtarın SPKI DER baytlarının SHA-256'sı, küçük harfli hex.
export function fingerprintOf(publicKeyB64) {
  return crypto.createHash('sha256').update(Buffer.from(publicKeyB64, 'base64')).digest('hex');
}

const spkiB64 = (publicKeyObject) => publicKeyObject.export({ type: 'spki', format: 'der' }).toString('base64');

function buildIdentity(privateKey, publicKeyB64) {
  return {
    publicKey: publicKeyB64,
    fingerprint: fingerprintOf(publicKeyB64),
    sign(nonce) {
      return crypto.sign(null, Buffer.from(IDENTITY_PREFIX + nonce), privateKey).toString('base64');
    },
  };
}

export function loadOrCreateIdentity(dir) {
  const keyPath = path.join(dir, KEY_FILE);
  const pubPath = path.join(dir, PUB_FILE);
  const hasKey = fs.existsSync(keyPath);
  const hasPub = fs.existsSync(pubPath);

  if (!hasKey && hasPub) {
    // Anahtar yokken sessizce yenisini üretmek, istemcilerin sabitlediği kimliği bozar.
    throw new IdentityError(
      `${PUB_FILE} var ama ${KEY_FILE} yok; sunucu kimliği kaybolmuş. Yeni kimlik üretilmedi (${dir}).`
    );
  }

  if (!hasKey) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    // 'wx': dosya varsa hata verir, mevcut anahtarın üzerine asla yazılmaz.
    fs.writeFileSync(keyPath, pem, { flag: 'wx', mode: 0o600 });
    const pubB64 = spkiB64(publicKey);
    fs.writeFileSync(pubPath, pubB64 + '\n');
    return buildIdentity(privateKey, pubB64);
  }

  let privateKey;
  let pubB64;
  try {
    privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));
    pubB64 = spkiB64(crypto.createPublicKey(privateKey));
  } catch (err) {
    throw new IdentityError(
      `${KEY_FILE} okunamadı ya da bozuk; hiçbir dosyaya dokunulmadı, yeni kimlik üretilmedi (${keyPath}).`,
      { cause: err }
    );
  }

  let current = null;
  if (hasPub) {
    try {
      current = fs.readFileSync(pubPath, 'utf8').trim();
    } catch {
      current = null;
    }
  }
  if (current !== pubB64) fs.writeFileSync(pubPath, pubB64 + '\n');

  return buildIdentity(privateKey, pubB64);
}
