#!/usr/bin/env node
// Editorial Dusk & Dawn: the design package's command line.
//
//   dusk-dawn check                     contrast of every pair in tokens.json, both themes
//   dusk-dawn colours [paths…]          no literal colours in an app's source (default: index.html src)
//       --skip <regex>                  also skip files whose name matches (e.g. "^icons\.ts$")
//   dusk-dawn css <out.css>             write the theme file (the package ships css/tokens.css)
//   dusk-dawn kotlin <out.kt> --package <pkg>
//                                       write Compose colour objects, for native widgets
//   dusk-dawn build                     regenerate css/tokens.css inside the package
//   dusk-dawn verify                    fail if css/tokens.css is out of date (package CI)
//
// Every command except `colours` runs the contrast check first and exits
// non-zero if a pair falls below its minimum. No dependencies.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(pkg, 'tokens.json'), 'utf8'));
const { version } = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
const THEMES = Object.keys(tokens.themes);
const HEADER = `Generated from tokens.json by dusk-dawn ${version}. Do not edit.`;
const TOKENS_CSS = join(pkg, 'css', 'tokens.css');

const [command = 'check', ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(name);
  if (i === -1) return undefined;
  const [, value] = rest.splice(i, 2);
  return value;
};

// ---------- colour maths ----------

function parse(value) {
  const v = value.trim();
  if (v.startsWith('#')) {
    let h = v.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (!m) throw new Error(`Unsupported colour: ${value}`);
  const [r, g, b, a = 1] = m[1].split(',').map((s) => parseFloat(s));
  return { r, g, b, a };
}

const over = (top, under) => ({
  r: top.r * top.a + under.r * (1 - top.a),
  g: top.g * top.a + under.g * (1 - top.a),
  b: top.b * top.a + under.b * (1 - top.a),
  a: 1,
});

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ---------- contrast check (style.md §15) ----------

function contrast() {
  const { surfaces, checks } = tokens.contrast;
  const page = ['bg-grad-top', 'bg-grad-mid', 'bg-grad-bot'];
  const failures = [];
  let count = 0;
  for (const theme of THEMES) {
    const col = (name) => {
      const t = tokens.color[name];
      if (!t) throw new Error(`contrast check names unknown token "${name}"`);
      return parse(t[theme]);
    };
    // A translucent background is judged over every page stop it can sit on.
    const grounds = (name) => {
      const c = col(name);
      return c.a < 1 ? page.map((p) => ({ name: `${name} over ${p}`, c: over(c, col(p)) })) : [{ name, c }];
    };
    for (const { fg, bg, min } of checks) {
      for (const f of fg) {
        for (const b of bg === 'surfaces' ? surfaces : bg) {
          for (const g of grounds(b)) {
            const fc = col(f);
            const r = ratio(fc.a < 1 ? over(fc, g.c) : fc, g.c);
            count++;
            if (r < min) failures.push(`${theme}: ${f} on ${g.name} is ${r.toFixed(2)}:1, needs ${min}:1`);
          }
        }
      }
    }
  }
  if (failures.length) {
    console.error(`Contrast check failed (${failures.length} of ${count} pairs):\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Contrast check passed: ${count} pairs in ${THEMES.length} themes.`);
}

// ---------- springs (style.md §11) ----------
// A Material 3 Expressive spring (unit mass, a damping ratio and a stiffness)
// becomes a CSS linear() easing sampled over the time it takes to settle
// within 0.1% of its target, so CSS, Svelte and Compose all move alike.

const entries = (group = {}) => Object.entries(group).filter(([k]) => !k.startsWith('$'));

function springAt(t, zeta, w0) {
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

export function spring(zeta, stiffness) {
  const w0 = Math.sqrt(stiffness);
  // Settling time: the last moment the spring is more than 0.1% from rest.
  const step = 0.001;
  let settle = 0;
  for (let t = 0; t < 5; t += step) if (Math.abs(1 - springAt(t, zeta, w0)) > 0.001) settle = t;
  const duration = Math.max(10, Math.ceil((settle * 1000) / 10) * 10);
  const samples = 32;
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const v = i === samples ? 1 : springAt((i / samples) * (duration / 1000), zeta, w0);
    points.push(String(Math.round(v * 1000) / 1000));
  }
  return { easing: `linear(${points.join(', ')})`, duration };
}

// ---------- CSS ----------

function css() {
  const out = [`/* ${HEADER} */`, ''];
  for (const f of tokens.fontFaces) {
    out.push(
      '@font-face {',
      `  font-family: "${f.family}";`,
      `  src: url("../fonts/${f.file}") format("woff2");`,
      `  font-style: ${f.style};`,
      `  font-weight: ${f.weight};`,
      '  font-display: swap;',
      '}',
      '',
    );
  }
  out.push(':root {');
  for (const [k, v] of Object.entries(tokens.font)) out.push(`  --font-${k}: ${v};`);
  for (const group of ['space', 'radius', 'shape', 'weight', 'motion', 'layout']) {
    for (const [k, v] of entries(tokens[group])) out.push(`  --${k}: ${v};`);
  }
  for (const [k, { dampingRatio, stiffness }] of entries(tokens.spring)) {
    const { easing, duration } = spring(dampingRatio, stiffness);
    out.push(`  --spring-${k}: ${easing};`, `  --spring-${k}-dur: ${duration}ms;`);
  }
  out.push('}', '');
  for (const theme of THEMES) {
    const { selector, colorScheme } = tokens.themes[theme];
    out.push(`${selector} {`, `  color-scheme: ${colorScheme};`);
    for (const group of ['color', 'rgb', 'number']) {
      for (const [k, v] of Object.entries(tokens[group])) out.push(`  --${k}: ${v[theme]};`);
    }
    out.push('}', '');
  }
  return out.join('\n');
}

// ---------- Kotlin (native widgets) ----------

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
// ktlint and detekt: a constant is a const val in SCREAMING_SNAKE_CASE.
const screaming = (s) => s.replace(/-/g, '_').toUpperCase();

function argb(value) {
  const { r, g, b, a } = parse(value);
  const hex = (n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
  return `0x${hex(a * 255)}${hex(r)}${hex(g)}${hex(b)}`;
}

function kotlin(name) {
  const out = [`// ${HEADER}`, `package ${name}`, '', 'import androidx.compose.ui.graphics.Color', ''];
  for (const theme of THEMES) {
    out.push(`internal object ${theme[0].toUpperCase() + theme.slice(1)}Tokens {`);
    for (const [k, v] of Object.entries(tokens.color)) out.push(`    val ${camel(k)} = Color(${argb(v[theme])})`);
    for (const [k, v] of Object.entries(tokens.rgb)) out.push(`    val ${camel(k)} = Color(${argb(`rgb(${v[theme]})`)})`);
    for (const [k, v] of Object.entries(tokens.number)) out.push(`    const val ${screaming(k)} = ${v[theme]}f`);
    out.push('}', '');
  }
  out.push('// Material 3 Expressive springs: spring(dampingRatio, stiffness) in Compose.');
  out.push('internal object SpringTokens {');
  for (const [k, { dampingRatio, stiffness }] of entries(tokens.spring)) {
    out.push(`    const val ${screaming(k)}_DAMPING = ${dampingRatio}f`, `    const val ${screaming(k)}_STIFFNESS = ${stiffness}f`);
  }
  out.push('}', '');
  return out.join('\n');
}

// ---------- literal colour check (style.md §1) ----------
// Every colour is a token. Fails if a hex, rgb() or hsl() literal, or a named
// colour in a colour property, appears in an app's source. rgba(var(--x-rgb), a)
// is fine: the colour is still a token.

function colours(paths, skip) {
  const cwd = process.cwd();
  const exts = /\.(ts|js|mjs|svelte|css|html)$/;
  const skipName = skip ? new RegExp(skip) : null;
  const walk = (path) => {
    if (!existsSync(path)) return [];
    if (statSync(path).isDirectory()) {
      return readdirSync(path)
        .filter((n) => n !== 'node_modules' && !n.startsWith('.'))
        .flatMap((n) => walk(join(path, n)));
    }
    const name = path.split(/[\\/]/).pop();
    return exts.test(name) && !(skipName && skipName.test(name)) ? [path] : [];
  };
  const files = (paths.length ? paths : ['index.html', 'src']).flatMap((p) => walk(resolve(cwd, p)));

  const patterns = [
    { re: /#[0-9a-fA-F]{3,8}\b(?![-\w])/g, what: 'hex colour' },
    { re: /\b(?:rgba?|hsla?)\(\s*\d/g, what: 'literal rgb()/hsl()' },
    {
      re: /(?:color|background|border(?:-[a-z]+)?|fill|stroke|fillStyle|strokeStyle)\s*[:=]\s*['"]?(?:white|black|red|green|blue|gray|grey)\b/g,
      what: 'named colour',
    },
  ];
  // Expected literals: the theme-color meta tag's first-paint value (replaced
  // from --bg-grad-mid at startup), HTML entities, URL fragments, an SVG used
  // as a CSS mask (only its alpha counts; the fill is a token), and any line
  // marked `dusk-dawn-allow-colour` with a reason.
  const allowed = [
    /<meta name="theme-color" content="#[0-9a-f]+"/i,
    /&#\d+;/,
    /href="#/,
    /mask(?:-image)?:\s*url\(["']?data:image\/svg/,
    /dusk-dawn-allow-colour/,
  ];

  let failures = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    // A generated theme file is where the literals belong.
    if (text.includes('Do not edit.') && /Generated from (design\/)?tokens\.json/.test(text.slice(0, 200))) continue;
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (allowed.some((a) => a.test(line))) return;
      for (const { re, what } of patterns) {
        for (const m of line.matchAll(re)) {
          // Entity-like and escaped strings (sample documents, XML) are not colours.
          if (what === 'hex colour' && /&#|\\u|x[0-9a-f]{2}/i.test(line.slice(Math.max(0, m.index - 2), m.index + 1))) continue;
          failures++;
          console.error(`${relative(cwd, file)}:${i + 1}: ${what} "${m[0]}"`);
        }
      }
    });
  }
  if (failures) {
    console.error(`\n${failures} literal colour(s) found. Use a token from dusk-dawn's tokens.json instead.`);
    process.exit(1);
  }
  console.log(`Colour check passed: no literal colours in ${files.length} files.`);
}

// ---------- run ----------

switch (command) {
  case 'check':
    contrast();
    break;
  case 'colours':
  case 'colors': {
    const skip = flag('--skip');
    colours(rest, skip);
    break;
  }
  case 'css': {
    contrast();
    if (!rest[0]) throw new Error('css needs an output path');
    writeFileSync(rest[0], css());
    console.log(`Wrote ${rest[0]}`);
    break;
  }
  case 'kotlin': {
    contrast();
    const name = flag('--package');
    if (!rest[0] || !name) throw new Error('kotlin needs an output path and --package');
    writeFileSync(rest[0], kotlin(name));
    console.log(`Wrote ${rest[0]}`);
    break;
  }
  case 'build':
    contrast();
    writeFileSync(TOKENS_CSS, css());
    console.log(`Wrote ${relative(process.cwd(), TOKENS_CSS)}`);
    break;
  case 'verify':
    contrast();
    if (!existsSync(TOKENS_CSS) || readFileSync(TOKENS_CSS, 'utf8') !== css()) {
      console.error('css/tokens.css is out of date. Run `npm run build` in the package and commit it.');
      process.exit(1);
    }
    console.log('css/tokens.css matches tokens.json.');
    break;
  default:
    console.error(`Unknown command "${command}". See the top of bin/dusk-dawn.mjs.`);
    process.exit(2);
}
