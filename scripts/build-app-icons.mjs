#!/usr/bin/env node
// Draws Colophon's app icon and splash screens: a printer's device (an orb
// and cross with a pennant, the mark early printers set in their colophons)
// holding a serif "C", in amber inside a 1px hairline frame, on Dusk's
// --bg-grad-mid under a soft amber glow (style.md §4, §14).
//
//   npm run assets
//
// Colours come from the dusk-dawn package's tokens.json. The C is Fraunces (opsz 72, wght 400),
// the UI's own serif, outlined once so the drawing doesn't depend on the
// fonts installed where this runs.

import { mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('dusk-dawn/tokens.json')), 'utf8')).color;
const BG = tokens['bg-grad-mid'].dusk;
const AMBER = tokens['accent-amber'].dusk;

// Fraunces "C", units per em 2000; bounds x 49…1337, y -35…1433 (y up).
const C = 'M1337 431.8Q1333.7 341.1 1290.4 257.3Q1247 173.5 1169.7 107.3Q1092.4 41.2 986.1 2.9Q879.9 -35.3 750.3 -35.3Q533.7 -35.3 376.5 55.6Q219.3 146.5 134.1 308.8Q48.8 471 48.8 685.1Q48.8 848.4 100.6 985.1Q152.5 1121.8 246.8 1222.3Q341.1 1322.9 469.6 1378.2Q598 1433.5 750.7 1433.5Q841.3 1433.5 901.4 1416.5Q961.5 1399.6 997.4 1382.2Q1033.3 1364.7 1051.3 1364.7Q1073.8 1364.7 1098.6 1381.4Q1123.4 1398.1 1147.8 1414.5Q1172.2 1430.9 1191.9 1430.9Q1207.6 1430.9 1218.3 1420.2Q1228.9 1409.6 1235.7 1384.2L1331.3 990.5Q1337 969.3 1327.5 953.7Q1318 938.1 1297.7 932.9Q1276.3 928.1 1259.3 936.7Q1242.3 945.2 1231.9 969Q1176.7 1107.7 1111.3 1186.3Q1045.9 1264.9 976.1 1297.5Q906.3 1330.1 837.3 1330.1Q765.7 1330.1 706.6 1294.1Q647.5 1258.2 604 1189.2Q560.5 1120.1 536.9 1020.3Q513.3 920.5 513.3 792.3Q513.3 582.2 565.3 444.7Q617.2 307.1 709.1 240.1Q801 173.1 920.9 173.1Q1035.7 173.1 1127.1 239.7Q1218.5 306.3 1262.5 440.1Q1272.5 460.5 1284.1 467.4Q1295.7 474.4 1310.3 471.7Q1324.9 469.6 1331.2 459Q1337.5 448.4 1337 431.8Z';
const C_BOX = { x: 49, y: -35, w: 1288, h: 1468 };

// The device, drawn in a 100 × 100 box: an orb with the C in it, a staff
// rising from it with one cross bar, and a pennant at the top.
function device(color) {
  const c = 27 / C_BOX.h;
  const cx = 50 - (C_BOX.x + C_BOX.w / 2) * c;
  const cy = 61 + (C_BOX.y + C_BOX.h / 2) * c;
  return `<g fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
<circle cx="50" cy="61" r="23"/>
<path d="M50 38V9M40 20H60"/>
<path d="M50 9L62 12.5L50 16" fill="${color}" stroke-width="1.6"/>
</g>
<path d="${C}" fill="${color}" transform="translate(${cx} ${cy}) scale(${c} ${-c})"/>`;
}

/**
 * An SVG of the mark: the device, `glyph` tall, centred in a size × size
 * square; the frame sits `inset` in from the edge. `stroke` is the hairline in px.
 */
function mark(size, { glyph, inset, stroke = 1, background = true, round = 0 }) {
  const k = glyph / 100;
  // The device spans y 7.6…84; centre that span.
  const tx = size / 2 - 50 * k;
  const ty = size / 2 - 45.8 * k;
  const frame = inset > 0 ? `<rect x="${inset + stroke / 2}" y="${inset + stroke / 2}" width="${size - 2 * inset - stroke}" height="${size - 2 * inset - stroke}" fill="none" stroke="${AMBER}" stroke-opacity="0.6" stroke-width="${stroke}" rx="${round}"/>` : '';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><radialGradient id="glow" cx="50%" cy="42%" r="55%"><stop offset="0" stop-color="${AMBER}" stop-opacity="0.22"/><stop offset="0.6" stop-color="${AMBER}" stop-opacity="0.04"/><stop offset="1" stop-color="${AMBER}" stop-opacity="0"/></radialGradient></defs>
${background ? `<rect width="${size}" height="${size}" fill="${BG}"/><rect width="${size}" height="${size}" fill="url(#glow)"/>` : ''}
${frame}
<g transform="translate(${tx} ${ty}) scale(${k})">${device(AMBER)}</g>
</svg>`);
}

/** The same device as a standalone SVG, for the favicon. */
export function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${BG}"/><rect x="4.5" y="4.5" width="55" height="55" rx="8" fill="none" stroke="${AMBER}" stroke-opacity=".55"/><g transform="translate(9 5.3) scale(.46)">${device(AMBER)}</g></svg>\n`;
}

const png = (svg, file) => {
  mkdirSync(dirname(file), { recursive: true });
  return sharp(svg).png().toFile(file);
};

const jobs = [];
const res = join(root, 'android/app/src/main/res');
if (existsSync(res)) {
  // Legacy and round icons (48dp) and the adaptive foreground (108dp, 72dp safe zone).
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [name, d] of Object.entries(densities)) {
    const s = Math.round(48 * d);
    const icon = mark(s, { glyph: s * 0.66, inset: s * 0.12, stroke: Math.max(1, d) });
    jobs.push(png(icon, join(res, `mipmap-${name}/ic_launcher.png`)), png(icon, join(res, `mipmap-${name}/ic_launcher_round.png`)));
    const f = Math.round(108 * d);
    jobs.push(png(mark(f, { glyph: f * 0.42, inset: f * 0.27, stroke: Math.max(1, d), background: false }), join(res, `mipmap-${name}/ic_launcher_foreground.png`)));
  }
  // Splash screens: every size the template ships, the mark at a quarter of the short side.
  for (const dir of readdirSync(res).filter((d) => d.startsWith('drawable'))) {
    const file = join(res, dir, 'splash.png');
    if (!existsSync(file)) continue;
    jobs.push(
      sharp(file)
        .metadata()
        .then(async ({ width, height }) => {
          const side = Math.round(Math.min(width, height) * 0.28);
          const logo = await sharp(mark(side, { glyph: side * 0.62, inset: side * 0.1, stroke: Math.max(1, Math.round(side / 240)) })).png().toBuffer();
          return sharp({ create: { width, height, channels: 3, background: BG } })
            .composite([{ input: logo, gravity: 'centre' }])
            .png()
            .toFile(file);
        }),
    );
  }
}

const ios = join(root, 'ios/App/App/Assets.xcassets');
if (existsSync(ios)) {
  jobs.push(png(mark(1024, { glyph: 640, inset: 124, stroke: 3 }), join(ios, 'AppIcon.appiconset/AppIcon-512@2x.png')));
  const logo = await sharp(mark(640, { glyph: 400, inset: 64, stroke: 3 })).png().toBuffer();
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    jobs.push(sharp({ create: { width: 2732, height: 2732, channels: 3, background: BG } }).composite([{ input: logo, gravity: 'centre' }]).png().toFile(join(ios, 'Splash.imageset', name)));
  }
}

jobs.push(png(mark(512, { glyph: 320, inset: 48, stroke: 2, round: 8 }), join(root, 'public/icon-512.png')));
jobs.push(writeFile(join(root, 'public/favicon.svg'), faviconSvg()));
await Promise.all(jobs);
console.log(`Wrote ${jobs.length} images.`);
