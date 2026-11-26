// Bağlanma kararı (saf mantık): verifyServer sonucuna göre ne yapılacağını söyler.
// Arayüz/ana süreç bu kararları olduğu gibi uygular; kendi başına karar vermez.
import { shortFingerprint } from './identity.js';

const MSG_INVALID = 'Bu sunucunun kimliği doğrulanamadı';
const MSG_UNREACHABLE = 'Bu adreste Ipchat sunucusu bulunamadı';
const MSG_CHANGED = 'Sunucu kimliği az önce değişti. Yeniden dene.';

const error = (message) => ({ action: 'error', message });
const hasIdentity = (r) =>
  typeof r?.identity?.publicKey === 'string' && typeof r?.identity?.fingerprint === 'string';

// Adrese bağlanırken: açılsın mı, kullanıcıya sorulsun mu, hata mı.
export function connectAction(result) {
  switch (result?.state) {
    case 'known':
    case 'new':
      // Kimliksiz "known/new" olmamalı; olursa güvenli yön: bağlanma.
      return hasIdentity(result) ? { action: 'open', identity: result.identity } : error(MSG_INVALID);
    case 'unsupported':
      // Eski sunucu, daha önce sabitlenmemiş: kimlik anahtarı bilerek yok.
      return { action: 'open' };
    case 'changed':
      if (result.legacy === true) return { action: 'confirm', info: { fingerprint: '', legacy: true } };
      return hasIdentity(result)
        ? { action: 'confirm', info: { fingerprint: shortFingerprint(result.identity.fingerprint), legacy: false } }
        : error(MSG_INVALID);
    case 'unreachable':
      return error(MSG_UNREACHABLE);
    case 'invalid':
    default:
      return error(MSG_INVALID);
  }
}

// Kullanıcı onayladıktan sonra yeniden doğrulanan sonuç için: yalnızca kullanıcının
// GÖRDÜĞÜ kimlikle (shown, kısa parmak izi; legacy için '') hâlâ aynıysa bağlan.
export function confirmAction(result, shown) {
  if (typeof shown !== 'string') return error(MSG_CHANGED);
  if (shown === '') {
    // Kullanıcıya parmak izi gösterilmedi (eski sunucu): yalnızca hâlâ eski sunucuysa.
    if (result?.state === 'changed' && result.legacy === true && !hasIdentity(result)) {
      return { action: 'open', identity: null };
    }
    return error(MSG_CHANGED);
  }
  if (
    (result?.state === 'changed' || result?.state === 'known' || result?.state === 'new') &&
    hasIdentity(result) &&
    shortFingerprint(result.identity.fingerprint) === shown
  ) {
    return { action: 'open', identity: result.identity };
  }
  return error(MSG_CHANGED);
}

// Kendi sunucumuza bağlanırken: yalnızca sabitlenmiş kimlikle tam eşleşme (known) kabul.
export function ownServerAction(result) {
  if (result?.state === 'known' && hasIdentity(result)) return { action: 'open', identity: result.identity };
  return { action: 'fail' };
}

// Arka planda başlayan bir bağlanma denemesinin sonucu hâlâ uygulanabilir mi?
// Deneme başlarken alınan nesil (startedGeneration) kullanıcı bağlantıyı değiştirince artar;
// değiştiyse, pencere kapandıysa ya da (needsConnectPage) artık bağlantı sayfasında değilsek
// sonuç atılır: kullanıcının kararı arka plan sonucuyla geri alınmasın.
export function isResultCurrent(state) {
  const { startedGeneration, currentGeneration, alive, needsConnectPage = false, onConnectPage = false } = state ?? {};
  if (!Number.isInteger(startedGeneration) || startedGeneration !== currentGeneration) return false;
  if (alive !== true) return false;
  return !needsConnectPage || onConnectPage === true;
}

// Süren bir bağlanma (connectToServer/retryInBackground) bitince, o sürerken gelen ve
// "connecting" yüzünden ertelenen yeniden bağlanma isteği şimdi çalıştırılsın mı?
// Yalnızca gerçekten bekleyen istek varsa, pencere açıksa ve uygulama kapanmıyorsa.
export function shouldReconnect(state) {
  const { pending, alive, quitting } = state ?? {};
  return pending === true && alive === true && quitting === false;
}
