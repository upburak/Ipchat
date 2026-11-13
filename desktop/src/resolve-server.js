import { discoverServers } from './discovery-client.js';
import { loadConfig } from './config.js';

export async function isReachable(url, timeoutMs = 1500) {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
    const data = await res.json();
    return data?.app === 'ipchat';
  } catch {
    return false;
  }
}

export async function resolveServer({ configDir, discover = discoverServers, reachable = isReachable }) {
  const config = loadConfig(configDir);
  const remembered = config.lastServer;

  if (remembered && (await reachable(remembered))) {
    return { status: 'ok', url: remembered };
  }

  const discovered = await discover();
  const checks = await Promise.all(discovered.map((server) => reachable(server.url)));
  const servers = discovered.filter((_, i) => checks[i]);

  if (remembered && servers.some((s) => s.url === remembered)) return { status: 'ok', url: remembered };
  if (servers.length > 0) return { status: 'choose', servers };
  return { status: 'manual' };
}
