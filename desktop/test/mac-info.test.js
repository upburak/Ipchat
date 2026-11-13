import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('mac app declares why it needs the local network so macOS shows the permission prompt', () => {
  const info = pkg.build.mac.extendInfo;
  assert.equal(typeof info.NSLocalNetworkUsageDescription, 'string');
  assert.ok(info.NSLocalNetworkUsageDescription.length > 20);
});
