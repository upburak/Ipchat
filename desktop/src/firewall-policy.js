import { execFile } from 'node:child_process';

const PROFILES = ['DomainProfile', 'PrivateProfile', 'PublicProfile'];

export function parseRegQuery(output) {
  const match = /AllowLocalPolicyMerge\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(String(output));
  return match ? parseInt(match[1], 16) : null;
}

export function policyRestricted(values) {
  return values.some((value) => value === 0);
}

function queryProfile(profile) {
  return new Promise((resolve) => {
    execFile(
      'reg',
      ['query', `HKLM\\SOFTWARE\\Policies\\Microsoft\\WindowsFirewall\\${profile}`, '/v', 'AllowLocalPolicyMerge'],
      { windowsHide: true, timeout: 5000 },
      (_error, stdout) => resolve(parseRegQuery(stdout))
    );
  });
}

export async function readFirewallPolicy() {
  if (process.platform !== 'win32') return { restricted: false };
  try {
    const values = await Promise.all(PROFILES.map(queryProfile));
    return { restricted: policyRestricted(values) };
  } catch {
    return { restricted: false };
  }
}
