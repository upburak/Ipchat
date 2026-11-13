const DEFAULT_PORT = 3000;

export function normalizeServerUrl(input) {
  const value = String(input ?? '').trim();
  const invalid = () => new Error('Geçersiz sunucu adresi');
  if (!value) throw invalid();

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw invalid();
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw invalid();
    return url.origin;
  }

  if (/^[^\s/:]+:\d{1,5}$/.test(value)) return `http://${value}`;
  if (/^[^\s/:]+$/.test(value)) return `http://${value}:${DEFAULT_PORT}`;
  throw invalid();
}
