import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRegQuery, policyRestricted, readFirewallPolicy } from '../src/firewall-policy.js';

test('parseRegQuery reads 0x0 as 0 and 0x1 as 1', () => {
  const out = (v) => `\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\WindowsFirewall\\PublicProfile\r\n    AllowLocalPolicyMerge    REG_DWORD    ${v}\r\n`;
  assert.equal(parseRegQuery(out('0x0')), 0);
  assert.equal(parseRegQuery(out('0x1')), 1);
});

test('parseRegQuery returns null when the value is absent', () => {
  assert.equal(parseRegQuery('ERROR: The system was unable to find the specified registry key or value.'), null);
  assert.equal(parseRegQuery(''), null);
});

test('policyRestricted is true if any profile is 0', () => {
  assert.equal(policyRestricted([null, 1, 0]), true);
});

test('policyRestricted ignores null and 1', () => {
  assert.equal(policyRestricted([null, 1, null]), false);
  assert.equal(policyRestricted([]), false);
});

test('readFirewallPolicy never throws and is not restricted off Windows', async () => {
  const r = await readFirewallPolicy();
  assert.equal(typeof r.restricted, 'boolean');
  if (process.platform !== 'win32') assert.equal(r.restricted, false);
});
