import dgram from 'node:dgram';
import os from 'node:os';

export const DISCOVERY_PORT = 41234;
const QUERY = 'IPCHAT_DISCOVER';

export function answerQuery(socket, reply, msg, rinfo) {
  if (msg.toString().trim() !== QUERY) return;
  if (!rinfo.port) return;
  try {
    socket.send(reply, rinfo.port, rinfo.address, () => {});
  } catch {
    /* gecersiz kaynak: yok say, sunucuyu dusurme */
  }
}

export function startDiscovery(httpPort, { udpPort = DISCOVERY_PORT, name = os.hostname() } = {}) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const reply = Buffer.from(JSON.stringify({ app: 'ipchat', port: httpPort, name }));
    let listening = false;

    socket.on('message', (msg, rinfo) => answerQuery(socket, reply, msg, rinfo));
    socket.on('error', (err) => {
      if (!listening) {
        console.warn(`Uyari: sunucu kesfi (UDP ${udpPort}) baslatilamadi: ${err.message}`);
        socket.close();
        resolve({ close() {}, port: null });
      } else {
        console.warn(`Uyari: sunucu kesfi hatasi: ${err.message}`);
      }
    });
    socket.bind(udpPort, '0.0.0.0', () => {
      listening = true;
      resolve({ close: () => socket.close(), port: socket.address().port });
    });
  });
}
