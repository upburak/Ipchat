import dgram from 'node:dgram';

export const DISCOVERY_PORT = 41234;

export function discoverServers({
  udpPort = DISCOVERY_PORT,
  timeoutMs = 2000,
  broadcastAddress = '255.255.255.255',
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

    socket.on('message', (msg, rinfo) => {
      try {
        const reply = JSON.parse(msg.toString());
        if (reply.app !== 'ipchat' || !Number.isInteger(reply.port)) return;
        const name = String(reply.name ?? '');
        const url = `http://${rinfo.address}:${reply.port}`;
        const key = `${name}:${reply.port}`;
        const existing = found.get(key);
        if (!existing || (rinfo.address === '127.0.0.1' && !existing.url.includes('//127.0.0.1:'))) {
          found.set(key, { url, name });
        }
      } catch {
        /* ilgisiz paket */
      }
    });
    socket.on('error', finish);
    socket.bind(0, () => {
      socket.setBroadcast(true);
      for (const address of new Set([broadcastAddress, '127.0.0.1'])) {
        socket.send('IPCHAT_DISCOVER', udpPort, address, () => {});
      }
    });
  });
}
