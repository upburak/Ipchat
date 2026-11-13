export function appBundlePath(execPath) {
  const match = /^(.*\.app)\/Contents\/MacOS\/[^/]+$/.exec(String(execPath ?? ''));
  return match ? match[1] : null;
}

export function uninstallBlockedReason({ platform, isPackaged, bundle }) {
  if (platform === 'win32') return null;
  if (!isPackaged) return 'Geliştirme sürümünde kullanılamaz.';
  if (!bundle) return 'Uygulama paketi bulunamadı.';
  return null;
}
