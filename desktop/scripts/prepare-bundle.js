import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.join(here, '..');
const root = path.join(desktop, '..');
const bundle = path.join(desktop, 'bundle');

const webDist = path.join(root, 'web', 'dist');
if (!fs.existsSync(path.join(webDist, 'index.html'))) {
  console.error('web/dist bulunamadi. Once "npm run build" calistirin.');
  process.exit(1);
}

fs.rmSync(bundle, { recursive: true, force: true });
fs.mkdirSync(path.join(bundle, 'server'), { recursive: true });
fs.cpSync(path.join(root, 'server', 'src'), path.join(bundle, 'server', 'src'), { recursive: true });
fs.cpSync(webDist, path.join(bundle, 'web-dist'), { recursive: true });
console.log('bundle hazir:', bundle);
