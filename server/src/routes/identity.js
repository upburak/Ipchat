import { Router } from 'express';

// 64 küçük harfli hex karakter (32 bayt).
const NONCE_RE = /^[0-9a-f]{64}$/;

// Sunucu kimliği ucu: istemci rastgele bir sınama değeri (nonce) yollar, sunucu bunu imzalar.
export function createIdentityRouter(identity) {
  const router = Router();
  router.get('/identity', (req, res) => {
    const { nonce } = req.query;
    if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) {
      return res.status(400).json({ error: 'Geçersiz sınama değeri' });
    }
    res.json({
      app: 'ipchat',
      publicKey: identity.publicKey,
      fingerprint: identity.fingerprint,
      signature: identity.sign(nonce),
    });
  });
  return router;
}
