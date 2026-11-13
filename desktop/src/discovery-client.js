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
        const url = `http://${rinfo.address}:${reply.port}`;
        if (!found.has(url)) found.set(url, { url, name: String(reply.name ?? '') });
      } catch {
        /* ilgisiz paket */
      }
    });
    socket.on('error', finish);
    socket.bind(0, () => {
      socket.setBroadcast(true);
      socket.send('IPCHAT_DISCOVER', udpPort, broadcastAddress, (err) => {
        if (err) finish();
      });
    });
  });
}
