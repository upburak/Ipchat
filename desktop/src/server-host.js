import { spawn } from 'node:child_process';
import os from 'node:os';

export function lanUrls(port, interfaces = os.networkInterfaces()) {
  const urls = [];
  for (const list of Object.values(interfaces)) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

async function healthy(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) });
    return (await res.json())?.app === 'ipchat';
  } catch {
    return false;
  }
}

export function startServerProcess({ execPath, entry, port, dataDir, webDist, timeoutMs = 10000, onExit }) {
  return new Promise((resolve, reject) => {
    const child = spawn(execPath, [entry], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(port),
        IPCHAT_DATA_DIR: dataDir,
        IPCHAT_WEB_DIST: webDist,
      },
      stdio: 'ignore',
      windowsHide: true,
    });

    let exited = false;
    let settled = false;
    const failStart = () => {
      if (settled) return;
      settled = true;
      if (!exited) child.kill();
      reject(new Error('Sunucu başlatılamadı'));
    };

    child.on('error', failStart);
    child.on('exit', (code) => {
      exited = true;
      if (!settled) failStart();
      else onExit?.(code);
    });

    const deadline = Date.now() + timeoutMs;
    (async () => {
      while (!settled && Date.now() < deadline) {
        if (exited) return;
        if (await healthy(port)) {
          settled = true;
          resolve({
            port,
            stop: () =>
              new Promise((done) => {
                if (exited) return done();
                child.once('exit', () => done());
                child.kill();
              }),
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      failStart();
    })();
  });
}
