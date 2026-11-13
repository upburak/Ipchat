import fs from 'node:fs';
import path from 'node:path';

const file = (dir) => path.join(dir, 'config.json');

export function loadConfig(dir) {
  try {
    const data = JSON.parse(fs.readFileSync(file(dir), 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function saveConfig(dir, config) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file(dir), JSON.stringify(config, null, 2));
}
