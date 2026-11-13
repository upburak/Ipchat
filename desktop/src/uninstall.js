export function appBundlePath(execPath) {
  const match = /^(.*\.app)\/Contents\/MacOS\/[^/]+$/.exec(String(execPath ?? ''));
  return match ? match[1] : null;
}
