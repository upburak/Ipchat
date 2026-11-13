import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServerProcess, lanUrls } from '../src/server-host.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, '..', '..', 'server', 'src', 'index.js');

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

test('starts the server with custom data dir and web dist, answers health, then stops', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-data-'));
  const webDist = fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-web-'));
  fs.writeFileSync(path.join(webDist, 'index.html'), '<title>ozel-web</title>');
  const port = await freePort();

  const host = await startServerProcess({ execPath: process.execPath, entry, port, dataDir, webDist });
  try {
    const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
    assert.equal(health.app, 'ipchat');
    assert.ok(fs.existsSync(path.join(dataDir, 'ipchat.db')), 'veritabani dataDir icinde olusmali');
    assert.ok(fs.existsSync(path.join(dataDir, 'uploads')), 'uploads dataDir icinde olusmali');
    assert.match(await (await fetch(`http://127.0.0.1:${port}/`)).text(), /ozel-web/);
  } finally {
    await host.stop();
  }
  await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`));
});

test('rejects when the server never becomes healthy', async () => {
  const port = await freePort();
  await assert.rejects(
    startServerProcess({ execPath: process.execPath, entry: '/yok/index.js', port, dataDir: os.tmpdir(), webDist: os.tmpdir(), timeoutMs: 1500 }),
    /başlatılamadı/
  );
});

test('lanUrls lists external IPv4 addresses with the port', () => {
  const ifaces = {
    en0: [{ family: 'IPv4', internal: false, address: '192.168.1.5', netmask: '255.255.255.0' }],
    lo0: [{ family: 'IPv4', internal: true, address: '127.0.0.1', netmask: '255.0.0.0' }],
    v6: [{ family: 'IPv6', internal: false, address: 'fe80::1', netmask: 'ffff::' }],
  };
  assert.deepEqual(lanUrls(3000, ifaces), ['http://192.168.1.5:3000']);
});

test('the server exits by itself when the parent process disappears', async () => {
  const { spawn } = await import('node:child_process');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipchat-data-'));
  const port = await freePort();
  const fakeParent = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  const server = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(port), IPCHAT_DATA_DIR: dataDir, IPCHAT_PARENT_PID: String(fakeParent.pid) },
    stdio: 'ignore',
  });
  try {
    let up = false;
    for (let i = 0; i < 30 && !up; i++) {
      up = await fetch(`http://127.0.0.1:${port}/api/health`).then(() => true, () => false);
      if (!up) await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(up, 'sunucu acilmali');
    fakeParent.kill('SIGKILL');
    const exited = await Promise.race([
      new Promise((r) => server.once('exit', () => r(true))),
      new Promise((r) => setTimeout(() => r(false), 8000)),
    ]);
    assert.equal(exited, true, 'ebeveyn olunce sunucu kendiliginden kapanmali');
  } finally {
    server.kill();
    fakeParent.kill();
  }
});
