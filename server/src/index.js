import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

import { authRouter } from './routes/auth.js';
import { createAdminRouter } from './routes/admin.js';
import { startDiscovery } from './discovery.js';
import { messagesRouter } from './routes/messages.js';
import { uploadRouter } from './routes/upload.js';
import { unreadRouter } from './routes/unread.js';
import { attachSockets } from './sockets/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const uploadsDir =
  process.env.IPCHAT_UPLOADS_DIR ||
  (process.env.IPCHAT_DATA_DIR
    ? path.join(process.env.IPCHAT_DATA_DIR, 'uploads')
    : path.join(__dirname, '..', 'uploads'));

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'ipchat' }));

app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
attachSockets(io);

app.use('/api', authRouter);
app.use('/api', createAdminRouter(io));
app.use('/api', messagesRouter);
app.use('/api', uploadRouter);
app.use('/api', unreadRouter);

const webDist = process.env.IPCHAT_WEB_DIST || path.join(__dirname, '..', '..', 'web', 'dist');
app.use(express.static(webDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(webDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const parentPid = Number(process.env.IPCHAT_PARENT_PID);
if (parentPid) {
  setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      process.exit(0);
    }
  }, 2000).unref();
}

function lanAddresses() {
  const addrs = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        addrs.push(net.address);
      }
    }
  }
  return addrs;
}

server.listen(PORT, '0.0.0.0', () => {
  startDiscovery(Number(PORT));
  console.log('');
  console.log('======================================================');
  console.log('  Ipchat sunucusu calisiyor!');
  console.log('');
  console.log(`  Bu bilgisayarda:      http://localhost:${PORT}`);
  const addrs = lanAddresses();
  if (addrs.length > 0) {
    console.log('  Agdaki diger cihazlar su adresi kullanmali:');
    for (const addr of addrs) {
      console.log(`      http://${addr}:${PORT}`);
    }
  } else {
    console.log('  Uyari: LAN IP adresi bulunamadi, ag baglantisini kontrol edin.');
  }
  console.log('======================================================');
  console.log('');
});
