// Sunucu kimliğini ağdan doğrular: /api/identity'yi nonce ile sorar, imzayı denetler ve
// sonucu (varsa) sabitlenmiş kimlikle karşılaştırıp sınıflandırır.
// Yanıt gövdesi düşman girdi sayılır: sınırlı okunur, hiçbir durumda hata fırlatılmaz.
// resolve-server.js'ten içe aktarma yapılmaz (o dosya bunu içe aktaracak: döngü olur).
import { makeNonce, verifyIdentityReply } from './identity.js';

// Kimlik yanıtı ~300 bayttır; 4 KB fazlasıyla yeter, aşan gövde akışın ortasında kesilir.
const MAX_BODY_BYTES = 4096;
const DEFAULT_TIMEOUT_MS = 1500;

class TooLargeError extends Error {}

// Gövdeyi en fazla MAX_BODY_BYTES kadar okur; aşarsa akışı iptal edip TooLargeError fırlatır.
async function readBounded(res) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw new TooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Gövdesi okunmayacak yanıtın bağlantısını serbest bırakır.
async function discard(res) {
  try {
    await res.body?.cancel();
  } catch {
    /* önemsiz */
  }
}

// 404 alınca: sunucu gerçekten eski bir Ipchat mı, yoksa başka bir web sunucusu mu?
// Yalnızca /api/health {app:'ipchat'} diyorsa eski Ipchat sayılır.
async function isLegacyIpchat(base, fetchImpl, signal) {
  try {
    const res = await fetchImpl(`${base}/api/health`, { signal, redirect: 'manual' });
    if (res.status !== 200) {
      await discard(res);
      return false;
    }
    const data = JSON.parse(await readBounded(res));
    return data !== null && typeof data === 'object' && data.app === 'ipchat';
  } catch {
    return false;
  }
}

async function run(url, pinned, { fetchImpl, nonce, signal }) {
  const base = String(url).replace(/\/+$/, '');
  const res = await fetchImpl(`${base}/api/identity?nonce=${encodeURIComponent(nonce)}`, {
    signal,
    redirect: 'manual',
  });

  if (res.status === 404) {
    await discard(res);
    if (!(await isLegacyIpchat(base, fetchImpl, signal))) return { state: 'unreachable' };
    // Eski sunucuda kimlik yok: pin varsa güvenli değil (changed), yoksa yalnızca desteklenmiyor.
    return pinned ? { state: 'changed', legacy: true } : { state: 'unsupported' };
  }
  if (res.status === 400) {
    await discard(res);
    return { state: 'invalid' };
  }
  if (res.status !== 200) {
    await discard(res);
    return { state: 'unreachable' };
  }

  let reply;
  try {
    reply = JSON.parse(await readBounded(res));
  } catch (err) {
    // Aşırı büyük gövde ve bozuk JSON geçersizdir; ağ/zaman aşımı hatası ise yukarıda yakalanır.
    if (err instanceof TooLargeError || err instanceof SyntaxError) return { state: 'invalid' };
    throw err;
  }

  const verified = verifyIdentityReply(reply, nonce);
  if (!verified.ok) return { state: 'invalid' };

  const identity = { publicKey: verified.publicKey, fingerprint: verified.fingerprint };
  if (!pinned) return { state: 'new', identity };
  return { state: pinned.fingerprint === identity.fingerprint ? 'known' : 'changed', identity };
}

export async function verifyServer(url, pinned, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const nonce = opts.nonce ?? makeNonce();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Tüm istek (kimlik + olası health sorgusu + gövde okuma) tek bir süre sınırına bağlıdır.
  const controller = new AbortController();
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ state: 'unreachable' });
    }, timeoutMs);
  });

  try {
    const work = run(url, pinned, { fetchImpl, nonce, signal: controller.signal }).catch(() => ({
      state: 'unreachable',
    }));
    return await Promise.race([work, timedOut]);
  } catch {
    return { state: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}
