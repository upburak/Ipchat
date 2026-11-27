import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE } from '../src/lib/avatar.js';

// Temalar: renkler yalnizca :root[data-theme="..."] belirtec bloklarinda (ve
// avatar.js PALETTE'inde) durur. Bulunan HER tema blogu icin her yazi/zemin
// cifti WCAG ile olculur (yazi 4.5:1, bilesen kenari 3:1). Asagidaki denetim
// islevleri saf metin isler; dosyanin sonundaki "kendi kendini sinama"
// testleri bunlara bilerek bozuk CSS verip yakalandigini dogrular.

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../src');
const css = readFileSync(join(srcDir, 'style.css'), 'utf8');
const html = readFileSync(join(here, '../index.html'), 'utf8');

const REQUIRED = [
  'bg', 'surface', 'surface-raised', 'border', 'text', 'muted', 'accent', 'accent-hover',
  'accent-soft', 'on-accent', 'own-bubble', 'own-text', 'own-time', 'danger', 'danger-bg',
  'danger-bg-hover', 'danger-border', 'online', 'offline', 'unread', 'badge-bg', 'badge-fg',
  'chip-ok-bg', 'chip-ok-fg', 'chip-wait-bg', 'chip-wait-fg', 'chip-off-bg', 'chip-off-fg',
  'scrim', 'edge-light', 'avatar-fg',
  // Gorevin ekledigi belirtecler
  'input-bg', 'input-border', 'placeholder', 'hover', 'accent-wash', 'own-border',
];

// [on, zemin, en az oran]: yazi 4.5, bilesen kenari 3
const PAIRS = [
  ...['bg', 'surface', 'surface-raised'].flatMap((bg) => [['text', bg, 4.5], ['muted', bg, 4.5]]),
  ['accent', 'bg', 4.5], ['accent', 'surface', 4.5],
  ['on-accent', 'accent', 4.5], ['on-accent', 'accent-hover', 4.5],
  ['own-text', 'own-bubble', 4.5], ['own-time', 'own-bubble', 4.5],
  ['danger', 'surface', 4.5], ['danger', 'bg', 4.5], ['danger', 'danger-bg', 4.5], ['danger', 'danger-bg-hover', 4.5],
  ['online', 'surface', 4.5],
  ['badge-fg', 'badge-bg', 4.5],
  ['chip-ok-fg', 'chip-ok-bg', 4.5], ['chip-wait-fg', 'chip-wait-bg', 4.5], ['chip-off-fg', 'chip-off-bg', 4.5],
  ['text', 'accent-soft', 4.5], ['muted', 'accent-soft', 4.5],
  ['accent', 'accent-soft', 4.5], ['text', 'input-bg', 4.5], ['placeholder', 'input-bg', 4.5], ['muted', 'input-bg', 4.5],
  ['text', 'hover', 4.5], ['muted', 'hover', 4.5],
  ['danger', 'surface-raised', 4.5], ['accent', 'surface-raised', 4.5],
  // Metin alani kenari: tek ipucu, yazi olmayan bilesen kenari icin 3:1
  ['input-border', 'surface', 3], ['input-border', 'surface-raised', 3], ['input-border', 'bg', 3],
];

// ---------------------------------------------------------------- ayristirma

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

// Parantez sayarak tema bloklarini bulur (ilk '}' degil). Birden cok blok olabilir.
// Doner: { themes: [{ name, body }], rest } ; rest = bloklar cikarilmis css
export function extractThemeBlocks(source) {
  const text = stripComments(source);
  const themes = [];
  let rest = '';
  let pos = 0;
  const head = /:root\[data-theme=["']([^"']+)["']\]\s*\{/g;
  let m;
  while ((m = head.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) { end = i; break; }
    }
    assert.ok(end !== -1, `:root[data-theme="${m[1]}"] blogu kapanmiyor`);
    rest += text.slice(pos, m.index);
    themes.push({ name: m[1], body: text.slice(open + 1, end) });
    pos = end + 1;
    head.lastIndex = pos;
  }
  rest += text.slice(pos);
  return { themes, rest };
}

function parseTokens(body) {
  const tokens = {};
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

// ------------------------------------------------------------ denetim islevleri

const NAMED_BASE = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey', 'cyan', 'magenta',
  'brown', 'teal', 'navy', 'silver', 'gold', 'maroon', 'olive', 'lime', 'aqua', 'fuchsia', 'indigo',
  'violet', 'crimson', 'coral', 'salmon', 'tomato',
];
const NAMED = ['white', 'black', ...NAMED_BASE.flatMap((n) => [n, `light${n}`, `dark${n}`])];
const NAMED_ALT = NAMED.join('|');
const FUNCS = 'rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix';

// CSS'te renk degeri: hex, renk islevleri, adlandirilmis renkler (transparent/currentColor serbest)
export function findColourLiterals(cssText) {
  const text = stripComments(cssText);
  const re = new RegExp(`#[0-9a-f]{3,8}\\b|(?<![\\w-])(?:${FUNCS})\\(|(?<![\\w.#-])(?:${NAMED_ALT})(?![\\w-])`, 'gi');
  return text.match(re) ?? [];
}

// JS/JSX'te: hex, renk islevleri ve tirnak icinde adlandirilmis renk
export function findScriptColourLiterals(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const re = new RegExp(`['"\`]#[0-9a-f]{3,8}['"\`]|(?<![\\w-])(?:${FUNCS})\\(|['"\`](?:${NAMED_ALT})['"\`]`, 'gi');
  return text.match(re) ?? [];
}

// '(' ile baslayan yerden dengeli ')' ye kadar icerik
function balanced(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(openIdx + 1, i);
  }
  return text.slice(openIdx + 1);
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const px = (n, unit) => (unit === 'rem' || unit === 'em' ? n * 16 : n);

// Yasak efektler: [aciklama, ...]
export function findForbiddenEffects(cssText) {
  const text = stripComments(cssText);
  const problems = [];
  if (/backdrop-filter/.test(text)) problems.push('backdrop-filter kullanilmamali');
  if (/conic-gradient/.test(text)) problems.push('conic-gradient kullanilmamali');

  for (const m of text.matchAll(/(?:repeating-)?(?:linear|radial)-gradient\(/g)) {
    const args = splitTopLevel(balanced(text, m.index + m[0].length - 1));
    const first = args[0] ?? '';
    const hasDirection = /^(to\s|-?[\d.]+(deg|turn|rad|grad)|circle|ellipse|closest|farthest|at\s)/i.test(first);
    const stops = hasDirection ? args.length - 1 : args.length;
    if (stops > 2) problems.push(`gradient en fazla iki renk duraginda olmali (${stops} durak): ${m[0]}...)`);
  }

  for (const m of text.matchAll(/box-shadow\s*:\s*([^;}]*)/g)) {
    for (const shadow of splitTopLevel(m[1])) {
      // renk islevlerini cikar, kalan uzunluklari oku: x y blur [yayilma]
      const bare = shadow.replace(/[a-z-]+\([^)]*\)/gi, ' ');
      const lens = [...bare.matchAll(/(-?\d*\.?\d+)(px|rem|em)?/g)].map((l) => px(parseFloat(l[1]), l[2]));
      if (lens.length >= 3 && lens[0] === 0 && lens[1] === 0 && lens[2] >= 12) {
        problems.push(`parlama (glow) yasak: box-shadow ${shadow.trim()}`);
      }
    }
  }
  return problems;
}

// ------------------------------------------------------------ gercek dosyalar

const { themes, rest: cssOutsideBlocks } = extractThemeBlocks(css);

function walk(dir, ext, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

function themeColour(theme, tokens, name) {
  assert.ok(name in tokens, `[${theme}] belirtec tanimli degil: --${name}`);
  const c = parseColour(tokens[name]);
  assert.ok(c, `[${theme}] --${name} ayristirilamadi: "${tokens[name]}"`);
  return c;
}

function assertPair(theme, tokens, fgName, bgName, min) {
  const r = ratio(themeColour(theme, tokens, fgName), themeColour(theme, tokens, bgName));
  assert.ok(r >= min, `[${theme}] ${fgName} (${tokens[fgName]}) on ${bgName} (${tokens[bgName]}): ${r.toFixed(2)}:1, en az ${min}:1 olmali`);
}

const themeTokens = themes.map((t) => ({ name: t.name, tokens: parseTokens(t.body) }));

test('at least one theme block exists and each defines every required token', () => {
  assert.ok(themeTokens.length > 0, ':root[data-theme="..."] blogu style.css icinde yok');
  for (const { name, tokens } of themeTokens) {
    const missing = REQUIRED.filter((n) => !(n in tokens));
    assert.deepEqual(missing, [], `[${name}] eksik belirtecler: ${missing.join(', ')}`);
    for (const n of REQUIRED) {
      assert.ok(parseColour(tokens[n]), `[${name}] --${n} renk olarak ayristirilamadi: "${tokens[n]}"`);
    }
  }
});

test('text, muted and accent pass 4.5:1 on bg, surface, surface-raised (every theme)', () => {
  for (const { name, tokens } of themeTokens) {
    for (const [fg, bg, min] of PAIRS.slice(0, 8)) assertPair(name, tokens, fg, bg, min);
  }
});

test('component and form pairs pass their minimum (4.5:1 text, 3:1 input edge) (every theme)', () => {
  for (const { name, tokens } of themeTokens) {
    for (const [fg, bg, min] of PAIRS.slice(8)) assertPair(name, tokens, fg, bg, min);
  }
});

test('every avatar colour has 4.5:1 against avatar-fg (every theme)', () => {
  assert.equal(PALETTE.length, 8, 'PALETTE 8 renk olmali');
  for (const { name, tokens } of themeTokens) {
    const fg = themeColour(name, tokens, 'avatar-fg');
    for (const hex of PALETTE) {
      const c = parseColour(hex);
      assert.ok(c, `avatar rengi ayristirilamadi: ${hex}`);
      const r = ratio(fg, c);
      assert.ok(r >= 4.5, `[${name}] avatar-fg (${tokens['avatar-fg']}) on ${hex}: ${r.toFixed(2)}:1, en az 4.5:1 olmali`);
    }
  }
});

test('no colour literals outside the token blocks', () => {
  const hits = findColourLiterals(cssOutsideBlocks);
  assert.deepEqual(hits, [], `style.css'te belirtec bloklari disinda renk degeri var: ${hits.join(', ')}`);

  assert.deepEqual(findColourLiterals(html), [], 'index.html renk degeri iceriyor');
  assert.match(html, /<html[^>]*data-theme="koyu"/, 'index.html: <html data-theme="koyu"> yok');
  assert.match(html, /<meta name="color-scheme" content="dark"/, 'index.html: color-scheme meta yok');

  const files = walk(srcDir, ['.jsx', '.js']);
  assert.ok(files.some((f) => f.endsWith('.jsx')), '.jsx dosyasi bulunamadi');
  for (const f of files) {
    const rel = relative(srcDir, f);
    const src = readFileSync(f, 'utf8');
    // avatar.js PALETTE'i renk degerinin izinli tek yeri
    if (rel !== join('lib', 'avatar.js')) {
      const lits = findScriptColourLiterals(src);
      assert.deepEqual(lits, [], `${rel}: sabit renk degeri var: ${lits.join(', ')}`);
    }
    for (const m of src.matchAll(/style=\{\{([^}]*)\}\}/g)) {
      const body = m[1].replace(/avatarColor\([^)]*\)/g, '');
      assert.deepEqual(findScriptColourLiterals(body), [], `${rel}: style icinde sabit renk: ${m[0]}`);
    }
  }
});

test('forbidden effects absent', () => {
  assert.deepEqual(findForbiddenEffects(css), [], 'yasak efekt var');
});

// ---------------------------------------------------- kendi kendini sinama

test('self-check: colour literal finder flags bad CSS and allows good CSS', () => {
  for (const bad of [
    'a{color:#fff}', 'a{color:#1b2a3a}', 'a{color:rgb(1,2,3)}', 'a{color:rgba(1,2,3,.5)}',
    'a{color:hsl(10 20% 30%)}', 'a{color:hsla(10,20%,30%,.5)}', 'a{color:oklch(0.5 0.1 200)}',
    'a{color:color(srgb 1 0 0)}', 'a{color:white}', 'a{color:black}', 'a{color:red}',
    'a{background:Blue}', 'a{color:green}', 'a{color:yellow}', 'a{color:orange}', 'a{color:purple}',
    'a{color:pink}', 'a{color:gray}', 'a{color:grey}', 'a{color:lightgray}', 'a{color:darkgrey}',
    'a{border:1px solid red}',
  ]) {
    assert.ok(findColourLiterals(bad).length > 0, `renk degeri yakalanmadi: ${bad}`);
  }
  for (const good of [
    'a{color:var(--text)}', 'a{color:transparent}', 'a{color:currentColor}', 'a{white-space:nowrap}',
    '.btn-primary{background:var(--accent)}', '/* red #fff rgb(1,2,3) */ a{color:var(--text)}',
    'a{border:1px solid var(--border)}', '.contact-item{gap:10px}',
  ]) {
    assert.deepEqual(findColourLiterals(good), [], `yanlis alarm: ${good}`);
  }
  for (const bad of ["const c = '#fff';", 'const c = "red";', 'const c = `rgb(1,2,3)`;', "x = 'hsl(1 2% 3%)'"]) {
    assert.ok(findScriptColourLiterals(bad).length > 0, `JS renk degeri yakalanmadi: ${bad}`);
  }
  for (const good of ['const red = 1; // #fff', "const a = 'redundant';", 'const rgb = [1,2,3];']) {
    assert.deepEqual(findScriptColourLiterals(good), [], `JS yanlis alarm: ${good}`);
  }
});

test('self-check: forbidden effect finder flags glow, blur and wide gradients', () => {
  const bad = [
    'a{backdrop-filter:blur(4px)}',
    'a{background:conic-gradient(red,blue)}',
    'a{background:linear-gradient(var(--a),var(--b),var(--c))}',
    'a{background:linear-gradient(90deg,var(--a),var(--b),var(--c))}',
    'a{background:linear-gradient(to right,var(--a),var(--b),var(--c))}',
    'a{background:radial-gradient(circle at 50% 50%,var(--a),var(--b),var(--c))}',
    'a{background:radial-gradient(var(--a),var(--b),var(--c))}',
    'a{box-shadow:0 0 12px var(--accent)}',
    'a{box-shadow:0 0 24px 2px rgba(51,201,220,.4)}',
    'a{box-shadow:inset 0 1px 0 var(--edge-light), 0 0 1rem var(--accent)}',
  ];
  for (const b of bad) assert.ok(findForbiddenEffects(b).length > 0, `yasak efekt yakalanmadi: ${b}`);
  const good = [
    'a{box-shadow:inset 0 1px 0 var(--edge-light)}',
    'a{box-shadow:0 0 4px var(--border)}',
    'a{box-shadow:0 1px 2px var(--border)}',
    'a{background:linear-gradient(90deg,var(--a),var(--b))}',
    'a{background:linear-gradient(var(--a),var(--b))}',
    'a{background:linear-gradient(to right,var(--a),var(--b))}',
    'a{background:linear-gradient(rgba(1,2,3,.5),rgba(4,5,6,.5))}',
    '/* backdrop-filter */ a{color:var(--text)}',
  ];
  for (const g of good) assert.deepEqual(findForbiddenEffects(g), [], `yanlis alarm: ${g}`);
});

test('self-check: theme parser is brace-aware, comment-safe and multi-theme', () => {
  const sample = `
    /* :root[data-theme="gizli"] { --bg: #fff; } */
    :root[data-theme="a"] { /* } ayirici */ --bg: #000000; --x: rgb(1, 2, 3); }
    body { color: var(--bg); }
    :root[data-theme='b'] { --bg: #111111; }
    .after { margin: 0 }
  `;
  const { themes: ts, rest } = extractThemeBlocks(sample);
  assert.deepEqual(ts.map((t) => t.name), ['a', 'b']);
  assert.equal(parseTokens(ts[0].body).bg, '#000000');
  assert.equal(parseTokens(ts[0].body).x, 'rgb(1, 2, 3)');
  assert.equal(parseTokens(ts[1].body).bg, '#111111');
  assert.ok(rest.includes('body { color: var(--bg); }') && rest.includes('.after'), 'blok disi kurallar korunmali');
  assert.deepEqual(findColourLiterals(rest), [], 'blok icindeki renkler rest icine sizmamali');
});

test('self-check: pair checker names the pair and the ratio', () => {
  const tokens = { text: '#e6eef5', bg: '#0a1018', weak: '#101a25' };
  assertPair('t', tokens, 'text', 'bg', 4.5);
  assert.throws(
    () => assertPair('t', tokens, 'weak', 'bg', 3),
    /\[t\] weak \(#101a25\) on bg \(#0a1018\): 1\.\d\d:1, en az 3:1/,
  );
});
