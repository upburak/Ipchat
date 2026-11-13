import dgram from 'node:dgram';
import os from 'node:os';

export const DISCOVERY_PORT = 41234;
const MAX_SERVERS = 20;
const MAX_NAME = 64;

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, part) => ((acc << 8) | Number(part)) >>> 0, 0);
}

function intToIpv4(n) {
  return [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');
}

export function localAddressSet(interfaces = os.networkInterfaces()) {
  const addresses = new Set();
  for (const list of Object.values(interfaces)) {
    for (const net of list || []) {
      if (net.family === 'IPv4') addresses.add(net.address);
    }
  }
  return addresses;
}

export function broadcastAddresses(interfaces = os.networkInterfaces()) {
  const result = new Set();
  for (const list of Object.values(interfaces)) {
    for (const net of list || []) {
      if (net.family !== 'IPv4' || net.internal || !net.netmask) continue;
      const mask = ipv4ToInt(net.netmask);
      result.add(intToIpv4((ipv4ToInt(net.address) | (~mask >>> 0)) >>> 0));
    }
  }
  return [...result];
}

export function addReply(found, msg, rinfo, localAddresses = localAddressSet()) {
  let reply;
  try {
    reply = JSON.parse(msg.toString());
  } catch {
    return;
  }
  if (!reply || reply.app !== 'ipchat') return;
  const port = reply.port;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return;

  const name = String(reply.name ?? '').slice(0, MAX_NAME);
  const fromSelf = rinfo.address === '127.0.0.1' || localAddresses.has(rinfo.address);
  const key = fromSelf ? `self:${name}:${port}` : `http://${rinfo.address}:${port}`;
  const url = `http://${rinfo.address}:${port}`;

  const existing = found.get(key);
  if (!existing) {
    if (found.size >= MAX_SERVERS) return;
    found.set(key, { url, name });
  } else if (fromSelf && rinfo.address === '127.0.0.1') {
    found.set(key, { url, name });
  }
}

export function discoverServers({
  udpPort = DISCOVERY_PORT,
  timeoutMs = 2000,
  broadcastAddress,
  localAddresses = localAddressSet(),
} = {}) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const found = new Map();
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* zaten kapali */
      }
      resolve([...found.values()]);
    };
    const timer = setTimeout(finish, timeoutMs);

    socket.on('message', (msg, rinfo) => addReply(found, msg, rinfo, localAddresses));
    socket.on('error', finish);
    socket.bind(0, () => {
      socket.setBroadcast(true);
      const targets = broadcastAddress
        ? [broadcastAddress]
        : [...broadcastAddresses(), '255.255.255.255'];
      for (const address of new Set([...targets, '127.0.0.1'])) {
        socket.send('IPCHAT_DISCOVER', udpPort, address, () => {});
      }
    });
  });
}
