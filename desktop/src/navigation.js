export function isTrustedSender(senderUrl, connectFileUrl) {
  return typeof senderUrl === 'string' && senderUrl.startsWith(connectFileUrl);
}

export function shouldAllowNavigation(targetUrl, serverUrl, connectFileUrl) {
  if (typeof targetUrl === 'string' && targetUrl.startsWith(connectFileUrl)) return true;
  if (!serverUrl) return false;
  try {
    return new URL(targetUrl).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}

export function isServerSender(senderUrl, serverUrl) {
  if (typeof senderUrl !== 'string' || typeof serverUrl !== 'string') return false;
  try {
    return new URL(senderUrl).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}
