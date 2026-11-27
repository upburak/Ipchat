import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE } from '../src/lib/avatar.js';

// Koyu tema: renkler yalnizca :root[data-theme="koyu"] belirtec blogunda durur
// (ve avatar.js PALETTE'inde). Her yazi/zemin cifti WCAG 4.5:1 olculur.

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../src/style.css'), 'utf8');
const html = readFileSync(join(here, '../index.html'), 'utf8');

const REQUIRED = [
  'bg', 'surface', 'surface-raised', 'border', 'text', 'muted', 'accent', 'accent-hover',
  'accent-soft', 'on-accent', 'own-bubble', 'own-text', 'own-time', 'danger', 'danger-bg',
  'danger-bg-hover', 'danger-border', 'online', 'offline', 'unread', 'badge-bg', 'badge-fg',
  'chip-ok-bg', 'chip-ok-fg', 'chip-wait-bg', 'chip-wait-fg', 'chip-off-bg', 'chip-off-fg',
  'scrim', 'edge-light', 'avatar-fg',
  // Gorevin ekledigi belirtecler
  'input-bg', 'placeholder', 'hover', 'accent-wash', 'own-border',
];

// :root[data-theme="koyu"] { ... } blogunu bulur; [blok govdesi, blok cikarilmis css]
function splitTokenBlock(source) {
  const start = source.search(/:root\[data-theme=["']koyu["']\]\s*\{/);
  if (start === -1) return [null, source];
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return [source.slice(open + 1, close), source.slice(0, start) + source.slice(close + 1)];
}

function parseTokens(body) {
  const tokens = {};
  if (!body) return tokens;
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) tokens[m[1]] = m[2].trim();
  return tokens;
}

// '#rrggbb' | 'rgb(r, g, b)' | 'rgba(r, g, b, a)' -> {r,g,b,a} ya da null
function parseColour(value) {
  let m = /^#([0-9a-f]{6})$/i.exec(value);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const [blockBody, cssOutsideBlock] = splitTokenBlock(css);
const tokens = parseTokens(blockBody);

function colourOf(name) {
  assert.ok(name in tokens, `belirtec tanimli degil: --${name}`);
  const c = parseColour(tokens[name]);
  assert.ok(c, `--${name} ayristirilamadi: "${tokens[name]}"`);
  return c;
}

function assertPair(fgName, bgName, min = 4.5) {
  const r = ratio(colourOf(fgName), colourOf(bgName));
  assert.ok(r >= min, `${fgName} (${tokens[fgName]}) on ${bgName} (${tokens[bgName]}): ${r.toFixed(2)}:1, en az ${min}:1 olmali`);
}

test('every required token is defined', () => {
  assert.ok(blockBody !== null, ':root[data-theme="koyu"] blogu style.css icinde yok');
  const missing = REQUIRED.filter((n) => !(n in tokens));
  assert.deepEqual(missing, [], `eksik belirtecler: ${missing.join(', ')}`);
  for (const n of REQUIRED) {
    assert.ok(parseColour(tokens[n]), `--${n} renk olarak ayristirilamadi: "${tokens[n]}"`);
  }
});

test('text, muted and accent pass 4.5:1 on bg, surface, surface-raised', () => {
  for (const bg of ['bg', 'surface', 'surface-raised']) {
    assertPair('text', bg);
    assertPair('muted', bg);
  }
  assertPair('accent', 'bg');
  assertPair('accent', 'surface');
});

test('component pairs pass 4.5:1', () => {
  assertPair('on-accent', 'accent');
  assertPair('on-accent', 'accent-hover');
  assertPair('own-text', 'own-bubble');
  assertPair('own-time', 'own-bubble');
  assertPair('danger', 'surface');
  assertPair('danger', 'bg');
  assertPair('danger', 'danger-bg');
  assertPair('danger', 'danger-bg-hover');
  assertPair('online', 'surface');
  assertPair('badge-fg', 'badge-bg');
  for (const k of ['ok', 'wait', 'off']) assertPair(`chip-${k}-fg`, `chip-${k}-bg`);
  assertPair('text', 'accent-soft');
  assertPair('muted', 'accent-soft');
});

test('interaction and form pairs pass 4.5:1', () => {
  assertPair('accent', 'accent-soft'); // .link:hover
  assertPair('text', 'input-bg');
  assertPair('placeholder', 'input-bg');
  assertPair('muted', 'input-bg');
  assertPair('text', 'hover');
  assertPair('muted', 'hover');
  assertPair('danger', 'surface-raised'); // hata satiri pencerede
  assertPair('accent', 'surface-raised');
  assertPair('muted', 'surface-raised');
});

test('every avatar colour has 4.5:1 against avatar-fg', () => {
  assert.equal(PALETTE.length, 8, 'PALETTE 8 renk olmali');
  const fg = colourOf('avatar-fg');
  for (const hex of PALETTE) {
    const c = parseColour(hex);
    assert.ok(c, `avatar rengi ayristirilamadi: ${hex}`);
    const r = ratio(fg, c);
    assert.ok(r >= 4.5, `avatar-fg (${tokens['avatar-fg']}) on ${hex}: ${r.toFixed(2)}:1, en az 4.5:1 olmali`);
  }
});

test('no colour literals outside the token block', () => {
  const literal = /#[0-9a-f]{3,8}\b|rgba?\(|(?<![\w-])(?:white|black)(?![\w-])/gi;
  const stripped = cssOutsideBlock.replace(/\/\*[\s\S]*?\*\//g, '');
  const hits = stripped.match(literal) ?? [];
  assert.deepEqual(hits, [], `style.css'te belirtec blogu disinda renk degeri var: ${hits.join(', ')}`);

  assert.ok(!new RegExp(literal.source, 'i').test(html), 'index.html renk degeri iceriyor');
  assert.match(html, /<html[^>]*data-theme="koyu"/, 'index.html: <html data-theme="koyu"> yok');
  assert.match(html, /<meta name="color-scheme" content="dark"/, 'index.html: color-scheme meta yok');

  const files = [];
  (function walk(dir) {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.jsx')) files.push(p);
    }
  })(join(here, '../src'));
  assert.ok(files.length > 0, '.jsx dosyasi bulunamadi');
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/style=\{\{([^}]*)\}\}/g)) {
      const body = m[1].replace(/avatarColor\([^)]*\)/g, '');
      assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|(?<![\w-])(?:white|black)(?![\w-])/i.test(body), `${f}: style icinde sabit renk: ${m[0]}`);
    }
    assert.ok(!/['"`]#[0-9a-f]{3,8}['"`]/i.test(src), `${f}: sabit renk degeri var`);
  }
});

test('forbidden effects absent', () => {
  const all = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/backdrop-filter/.test(all), 'backdrop-filter kullanilmamali');
  assert.ok(!/conic-gradient/.test(all), 'conic-gradient kullanilmamali');
  for (const m of all.matchAll(/linear-gradient\(([^;]*)\)/g)) {
    const stops = m[1].split(',').length - 1;
    assert.ok(stops <= 2, `linear-gradient en fazla iki durakli olmali: ${m[0]}`);
  }
  assert.ok(!/radial-gradient/.test(all), 'radial-gradient kullanilmamali');
});
