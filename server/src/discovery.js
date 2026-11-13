import dgram from 'node:dgram';
import os from 'node:os';

export const DISCOVERY_PORT = 41234;
const QUERY = 'IPCHAT_DISCOVER';

export function startDiscovery(httpPort, { udpPort = DISCOVERY_PORT, name = os.hostname() } = {}) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const reply = Buffer.from(JSON.stringify({ app: 'ipchat', port: httpPort, name }));

    socket.on('message', (msg, rinfo) => {
      if (msg.toString().trim() !== QUERY) return;
      socket.send(reply, rinfo.port, rinfo.address);
    });
    socket.on('error', (err) => {
      console.warn(`Uyari: sunucu kesfi (UDP ${udpPort}) baslatilamadi: ${err.message}`);
      socket.close();
      resolve({ close() {}, port: null });
    });
    socket.bind(udpPort, '0.0.0.0', () => {
      resolve({ close: () => socket.close(), port: socket.address().port });
    });
  });
}
