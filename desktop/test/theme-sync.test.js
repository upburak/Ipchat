import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Masaustu sayfalari (connect.html, welcome.html) web paketinden ayri yerel dosyalardir;
// kendi ic CSS'lerinde kullandiklari belirteclerin KOPYASI durur. Bu test kopyalarin web ile
// birebir ayni kalmasini ve kopyalarla cizilen yazi/zemin ciftlerinin okunur olmasini denetler.

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

// Parantez sayarak :root[data-theme="..."] bloklarini bulur. rest = bloklar cikarilmis metin.
function extractThemeBlocks(source) {
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
const luminance = ({ r, g, b }) => {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const NAMED = ['white', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey'];
function findColourLiterals(cssText) {
  const re = new RegExp(
    `#[0-9a-f]{3,8}\\b|(?<![\\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\\(|(?<![\\w.#-])(?:${NAMED.join('|')})(?![\\w-])`,
    'gi',
  );
  return stripComments(cssText).match(re) ?? [];
}

const webCss = read('../../web/src/style.css');
const web = Object.fromEntries(extractThemeBlocks(webCss).themes.map((t) => [t.name, parseTokens(t.body)]));

const PAGES = ['connect.html', 'welcome.html'].map((file) => {
  const html = read(`../src/${file}`);
  const style = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const { themes, rest } = extractThemeBlocks(style);
  const inline = [...html.matchAll(/\sstyle=["']([^"']*)["']/gi)].map((m) => m[1]).join('\n');
  return { file, html, themes, rest, inline, tokens: Object.fromEntries(themes.map((t) => [t.name, parseTokens(t.body)])) };
});

const REQUIRED = ['bg', 'surface', 'border', 'text', 'muted', 'accent', 'on-accent', 'accent-soft', 'danger'];

// [yazi, zemin, en az oran]: yazi 4.5, bilesen kenari 3. Yalniz iki belirteci de sayfada tanimliysa uygulanir.
const PAIRS = [
  ['text', 'bg', 4.5], ['muted', 'bg', 4.5], ['text', 'surface', 4.5], ['muted', 'surface', 4.5],
  ['on-accent', 'accent', 4.5], ['accent', 'accent-soft', 4.5], ['accent', 'surface', 4.5], ['muted', 'accent-soft', 4.5],
  ['danger', 'surface', 4.5],
  ['text', 'input-bg', 4.5], ['placeholder', 'input-bg', 4.5],
  ['chip-wait-fg', 'chip-wait-bg', 4.5],
  ['input-border', 'surface', 3], ['input-border', 'bg', 3],
];

test('the web stylesheet declares a dark theme to compare against', () => {
  assert.ok(web.koyu && Object.keys(web.koyu).length > 20);
});

for (const page of PAGES) {
  test(`${page.file}: desktop pages declare the dark theme on the root element`, () => {
    assert.match(page.html, /<html\b[^>]*\sdata-theme=["']koyu["']/i);
    assert.ok(page.themes.length >= 1, 'iç CSS\'te :root[data-theme] blogu yok');
    for (const t of page.themes) {
      assert.match(t.body, /color-scheme:\s*dark\s*;/, `${t.name} blogunda color-scheme: dark yok`);
    }
  });

  test(`${page.file}: every token a desktop page declares has the same value as the web token`, () => {
    for (const [name, tokens] of Object.entries(page.tokens)) {
      assert.ok(web[name], `web'de "${name}" teması yok`);
      for (const [token, value] of Object.entries(tokens)) {
        if (token === 'color-scheme') continue;
        assert.ok(token in web[name], `--${token} web ${name} temasında yok`);
        assert.equal(value, web[name][token], `--${token} değeri web ile aynı değil (${name})`);
      }
    }
  });

  test(`${page.file}: desktop pages declare at least bg, surface, border, text, muted, accent, on-accent, accent-soft, danger`, () => {
    for (const [name, tokens] of Object.entries(page.tokens)) {
      for (const need of REQUIRED) assert.ok(need in tokens, `${name} temasında --${need} yok`);
    }
  });

  test(`${page.file}: every token used in var(--...) is declared in each theme block`, () => {
    const used = new Set([...page.rest.matchAll(/var\(\s*--([a-z0-9-]+)/gi)].map((m) => m[1]));
    assert.ok(used.size > 0, 'hiç var(--...) kullanılmıyor');
    for (const [name, tokens] of Object.entries(page.tokens)) {
      for (const u of used) assert.ok(u in tokens, `--${u} kullanılıyor ama ${name} bloğunda tanımlı değil`);
      for (const d of Object.keys(tokens)) {
        if (d === 'color-scheme') continue;
        assert.ok(used.has(d), `--${d} tanımlı ama sayfada kullanılmıyor (gereksiz belirteç)`);
      }
    }
  });

  test(`${page.file}: no colour literals outside the token block in the desktop pages`, () => {
    assert.deepEqual(findColourLiterals(page.rest), []);
    assert.deepEqual(findColourLiterals(page.inline), []);
    assert.ok(!/backdrop-filter|gradient/.test(page.rest), 'backdrop-filter / gradient kullanılmamalı');
    assert.ok(!/box-shadow\s*:\s*0\s+0\s+\d{2,}/.test(page.rest), 'parlama (glow) yasak');
  });

  test(`${page.file}: desktop text/background pairs pass 4.5:1 (borders 3:1)`, () => {
    let checked = 0;
    for (const [name, tokens] of Object.entries(page.tokens)) {
      for (const [fgName, bgName, min] of PAIRS) {
        if (!(fgName in tokens) || !(bgName in tokens)) continue;
        const fg = parseColour(tokens[fgName]);
        const bg = parseColour(tokens[bgName]);
        assert.ok(fg && bg && fg.a === 1 && bg.a === 1, `${fgName}/${bgName} okunamadı`);
        const r = ratio(fg, bg);
        assert.ok(r >= min, `${name}: --${fgName} / --${bgName} = ${r.toFixed(2)}:1 (en az ${min}:1)`);
        checked++;
      }
    }
    assert.ok(checked >= 6, `yeterli çift ölçülmedi (${checked})`);
  });
}

test('findColourLiterals catches deliberately bad css (self-check)', () => {
  assert.ok(findColourLiterals('a { color: #fff; }').length === 1);
  assert.ok(findColourLiterals('a { background: rgba(0,0,0,.1); }').length === 1);
  assert.ok(findColourLiterals('a { color: white; }').length === 1);
  assert.deepEqual(findColourLiterals('a { color: var(--text); border: 1px solid var(--border); }'), []);
});
