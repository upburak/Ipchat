import { discoverServers } from './discovery-client.js';
import { loadConfig } from './config.js';
import { verifyServer } from './verify-server.js';
import { getPinned } from './identity-store.js';
import { shortFingerprint } from './identity.js';

// Eski yol: yalnızca main.js kullanıyor (Task 7'de kalkacak). Davranışı değişmedi.
export async function isReachable(url, timeoutMs = 1500) {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
    const data = await res.json();
    return data?.app === 'ipchat';
  } catch {
    return false;
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return String(url);
  }
}

// Doğrulama hata fırlatırsa o aday ulaşılamaz sayılır; resolveServer hiçbir zaman fırlatmaz.
async function safeVerify(verify, url, pinned) {
  try {
    const result = await verify(url, pinned);
    return result && typeof result === 'object' ? result : { state: 'unreachable' };
  } catch {
    return { state: 'unreachable' };
  }
}

async function safeDiscover(discover) {
  try {
    const list = await discover();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Sunucuyu seçer. Ayar dosyasına HİÇBİR ŞEY yazmaz (adresi ve kimliği main.js kaydeder).
// Sıra: kayıtlı adres -> (en çok bir kez) keşif -> sabitlenmiş kimliği taşıyan sunucu -> uyarı/seçim.
export async function resolveServer({ configDir, discover = discoverServers, verify = verifyServer }) {
  const config = loadConfig(configDir);
  const remembered = config.lastServer;
  const pinned = getPinned(config);

  // 1) Kayıtlı adres.
  let rememberedChanged; // adres başka bir sunucuya geçmiş olabilir: keşfe devam, uyarıyı sona sakla
  if (remembered) {
    const r = await safeVerify(verify, remembered, pinned);
    if (r.state === 'known' || r.state === 'new') return { status: 'ok', url: remembered, identity: r.identity };
    if (r.state === 'unsupported') return { status: 'ok', url: remembered };
    if (r.state === 'changed') rememberedChanged = r;
    // unreachable | invalid: bu adrese bağlanılmaz, keşfe devam.
  }

  // 2) Keşif (en çok bir kez); kayıtlı adres zaten denendi, tekrar doğrulanmaz.
  const discovered = await safeDiscover(discover);
  const candidates = discovered.filter((s) => s && s.url !== remembered);
  const results = await Promise.all(candidates.map((s) => safeVerify(verify, s.url, pinned)));

  // 3) Sabitlenmiş kimliği taşıyan sunucu varsa adres değişmiş demektir: uyarısız bağlan.
  const knownIdx = results.findIndex((r) => r.state === 'known');
  if (knownIdx !== -1) return { status: 'ok', url: candidates[knownIdx].url, identity: results[knownIdx].identity };

  const nameOf = (url) => discovered.find((s) => s && s.url === url)?.name || hostnameOf(url);

  if (pinned) {
    // 4) Sabitlenmiş kimlik yok edilemedi: kimliği tanınmayanlar (kayıtlı adres dahil).
    const unfamiliar = [];
    if (rememberedChanged) unfamiliar.push({ url: remembered, name: nameOf(remembered), result: rememberedChanged });
    candidates.forEach((s, i) => {
      if (results[i].state === 'changed') unfamiliar.push({ url: s.url, name: s.name || hostnameOf(s.url), result: results[i] });
    });
    if (unfamiliar.length === 1) {
      const { url, name, result } = unfamiliar[0];
      return {
        status: 'changed',
        url,
        name,
        fingerprint: result.identity ? shortFingerprint(result.identity.fingerprint) : '',
        legacy: result.legacy === true,
      };
    }
    if (unfamiliar.length > 1) {
      return { status: 'choose', servers: unfamiliar.map(({ url, name }) => ({ url, name, unfamiliar: true })) };
    }
    return { status: 'manual' };
  }

  // 5) Sabitleme yok: yeni/desteklenmeyen adaylar kullanıcıya sorulur (tek olsa da).
  const servers = candidates.filter((_, i) => results[i].state === 'new' || results[i].state === 'unsupported');
  if (servers.length > 0) return { status: 'choose', servers };

  // 6) Hiçbiri.
  return { status: 'manual' };
}
