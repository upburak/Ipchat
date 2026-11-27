// "Sunucu bulundu" bilgi ekranı kararı (saf mantık; tasarım 2026-11-27 §6.1).
// result: resolveServer'ın 'ok' sonucu. dismissedUrl: kullanıcının "Başka bir adres yaz" dediği
// adres (oturum boyunca bilgi ekranı için unutulur). shownUrl: şu an ekranda gösterilen bilgi
// ekranının adresi (10 sn'lik arka plan denemesi aynı ekranı yeniden kurmasın, geri sayım sıfırlanmasın).
// Dönüş: 'show' bilgi ekranını göster (kaydetme/açma yok), 'skip' hiçbir şey yapma,
// 'open' bugünkü yol (kaydet + aç). Garip/eksik girdide 'open' (bugünkü davranış); hata atmaz.
export function decideFound(result, state) {
  if (!result || typeof result !== 'object') return 'open';
  if (result.status !== 'ok' || result.autoPicked !== true) return 'open';
  if (typeof result.url !== 'string' || result.url === '') return 'open';
  const { dismissedUrl = null, shownUrl = null } = state && typeof state === 'object' ? state : {};
  if (result.url === dismissedUrl || result.url === shownUrl) return 'skip';
  return 'show';
}
