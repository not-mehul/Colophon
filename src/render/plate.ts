// Typographic cover plates, 1200 × 1800 (2:3). A plate is artwork that
// outlives the app's theme, so each style reads a fixed palette (Dusk or
// Dawn) from a probe element, never a literal colour (style.md §2, §10).
//
// Noir and E-ink also take a palette from the book itself: Noir tints its
// glow with the edition's current cover, and E-ink is drawn in greys only,
// for the screens it is named after.

import { MONO, readPalette, SERIF, type Palette } from './card-frame';

export type PlateStyle = 'classic' | 'minimal' | 'noir' | 'eink';

export const PLATE_STYLES: { id: PlateStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'noir', label: 'Noir' },
  { id: 'eink', label: 'E-ink' },
];

export const PLATE_W = 1200;
export const PLATE_H = 1800;

export interface PlateText {
  title: string;
  /** The line above the title. */
  subtitle: string;
  author: string;
}

/** "r, g, b" of an image's average colour, lifted towards mid-tone so it glows. */
export async function coverTint(bytes: Uint8Array | null, mediaType: string): Promise<string | null> {
  if (!bytes?.length) return null;
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: mediaType }));
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 36;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0, 24, 36);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, 24, 36);
    // Weight saturated pixels, so a dark cover with one bright mark still has a hue.
    let r = 0;
    let g = 0;
    let b = 0;
    let weight = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [pr, pg, pb] = [data[i]!, data[i + 1]!, data[i + 2]!];
      const w = 1 + (Math.max(pr, pg, pb) - Math.min(pr, pg, pb)) / 16;
      r += pr * w;
      g += pg * w;
      b += pb * w;
      weight += w;
    }
    const avg = [r / weight, g / weight, b / weight];
    const peak = Math.max(...avg, 1);
    const lift = Math.min(3, 200 / peak);
    return avg.map((c) => Math.round(Math.min(255, c * lift))).join(', ');
  } catch {
    return null;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 5): number {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + Math.min(lines.length, maxLines) * lineHeight;
}

/** Shrinks the title until its longest word fits. */
function titleSize(ctx: CanvasRenderingContext2D, text: string, start: number, maxWidth: number, italic = false): number {
  const longest = text.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
  let size = start;
  for (; size > 48; size -= 4) {
    ctx.font = `${italic ? 'italic ' : ''}400 ${size}px ${SERIF}`;
    if (ctx.measureText(longest).width <= maxWidth) break;
  }
  return size;
}

function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.font = `400 ${size}px ${MONO}`;
  ctx.letterSpacing = `${size * 0.25}px`;
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.letterSpacing = '0px';
}

function gradient(ctx: CanvasRenderingContext2D, p: Palette) {
  const g = ctx.createLinearGradient(0, 0, 0, PLATE_H);
  g.addColorStop(0, p['bg-grad-top']);
  g.addColorStop(0.5, p['bg-grad-mid']);
  g.addColorStop(1, p['bg-grad-bot']);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PLATE_W, PLATE_H);
}

export function drawPlate(canvas: HTMLCanvasElement, style: PlateStyle, text: PlateText, tint: string | null = null): void {
  canvas.width = PLATE_W;
  canvas.height = PLATE_H;
  const ctx = canvas.getContext('2d')!;
  const W = PLATE_W;
  const H = PLATE_H;
  const dusk = readPalette('dark');
  const dawn = readPalette('light');
  const title = text.title.trim() || 'Untitled';
  const subtitle = text.subtitle.trim();
  const author = text.author.trim();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.filter = 'none';

  if (style === 'classic') {
    gradient(ctx, dusk);
    ctx.strokeStyle = dusk['accent-amber'];
    ctx.lineWidth = 4;
    ctx.strokeRect(72, 72, W - 144, H - 144);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(92, 92, W - 184, H - 184);
    ctx.fillStyle = dusk['accent-amber'];
    if (subtitle) tracked(ctx, subtitle, W / 2, 250, 30);
    ctx.fillStyle = dusk['text-heading'];
    const size = titleSize(ctx, title, 104, W - 300);
    const end = wrap(ctx, title, W / 2, 620, W - 300, size * 1.15);
    ctx.strokeStyle = dusk['accent-amber'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 140, end + 60);
    ctx.lineTo(W / 2 + 140, end + 60);
    ctx.stroke();
    ctx.fillStyle = dusk['text-heading'];
    ctx.font = `italic 400 56px ${SERIF}`;
    ctx.fillText(author, W / 2, 1540);
    return;
  }

  if (style === 'minimal') {
    gradient(ctx, dawn);
    ctx.textAlign = 'left';
    ctx.fillStyle = dawn['accent-amber'];
    ctx.fillRect(120, 180, 120, 6);
    ctx.fillStyle = dawn['text-heading'];
    const size = titleSize(ctx, title, 108, W - 240);
    const end = wrap(ctx, title, 120, 400, W - 240, size * 1.12);
    ctx.fillStyle = dawn['accent-amber'];
    ctx.font = `italic 400 44px ${SERIF}`;
    if (subtitle) wrap(ctx, subtitle, 120, end + 40, W - 240, 56, 2);
    ctx.fillStyle = dawn['text-dim'];
    ctx.font = `400 52px ${SERIF}`;
    ctx.fillText(author, 120, 1600);
    return;
  }

  if (style === 'noir') {
    // The glow takes the book's own colour when it has a cover; amber otherwise.
    const glow = tint ?? dusk['accent-amber-rgb'];
    ctx.fillStyle = dusk['bg-grad-bot'];
    ctx.fillRect(0, 0, W, H);
    for (const [x, y, r, a] of [
      [W * 0.8, H * 0.18, 980, 0.34],
      [W * 0.1, H * 0.95, 900, 0.16],
    ] as const) {
      const rad = ctx.createRadialGradient(x, y, 40, x, y, r);
      rad.addColorStop(0, `rgba(${glow}, ${a})`);
      rad.addColorStop(1, `rgba(${glow}, 0)`);
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.strokeStyle = `rgba(${glow}, 0.45)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(64, 64, W - 128, H - 128);
    ctx.fillStyle = dusk['accent-sage'];
    if (subtitle) tracked(ctx, subtitle, W / 2, 270, 30);
    ctx.fillStyle = dusk['text-heading'];
    const size = titleSize(ctx, title, 112, W - 260);
    wrap(ctx, title, W / 2, 680, W - 260, size * 1.15);
    ctx.fillStyle = `rgb(${glow})`;
    ctx.font = `italic 400 58px ${SERIF}`;
    ctx.fillText(author, W / 2, 1560);
    return;
  }

  // E-ink: Dawn's paper and ink, then every pixel to grey, so the plate looks
  // on an e-reader the way it looks here.
  ctx.fillStyle = dawn['bg-grad-top'];
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = dawn['text-heading'];
  ctx.lineWidth = 8;
  ctx.strokeRect(64, 64, W - 128, H - 128);
  ctx.lineWidth = 2;
  ctx.strokeRect(86, 86, W - 172, H - 172);
  ctx.fillStyle = dawn['text-heading'];
  ctx.fillRect(86, 86, W - 172, 150);
  ctx.fillStyle = dawn['bg-grad-top'];
  tracked(ctx, subtitle || 'A digital edition', W / 2, 176, 32);
  ctx.fillStyle = dawn['text-heading'];
  const size = titleSize(ctx, title, 104, W - 280);
  wrap(ctx, title, W / 2, 600, W - 280, size * 1.12);
  ctx.font = `400 56px ${SERIF}`;
  ctx.fillText(author, W / 2, 1540);
  const image = ctx.getImageData(0, 0, W, H);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const grey = d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114;
    d[i] = d[i + 1] = d[i + 2] = grey;
  }
  ctx.putImageData(image, 0, 0);
}

export function canvasJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject) : reject(new Error('Could not draw the image.'))),
      'image/jpeg',
      quality,
    ),
  );
}

/** The sample edition's deliberately small cover. */
export async function sampleCover(): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 450;
  const ctx = canvas.getContext('2d')!;
  const p = readPalette('dark');
  ctx.fillStyle = p['bg-grad-top'];
  ctx.fillRect(0, 0, 300, 450);
  ctx.strokeStyle = p['accent-amber'];
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 260, 410);
  ctx.fillStyle = p['text-heading'];
  ctx.textAlign = 'center';
  ctx.font = `22px ${SERIF}`;
  ctx.fillText('THE ART OF', 150, 150);
  ctx.fillText('DIGITAL', 150, 182);
  ctx.fillText('BOOKMAKING', 150, 214);
  ctx.fillStyle = p['accent-amber'];
  ctx.font = `italic 13px ${SERIF}`;
  ctx.fillText('Low-resolution proof (300 × 450)', 150, 275);
  ctx.fillStyle = p['text-dim'];
  ctx.font = `15px ${SERIF}`;
  ctx.fillText('Clara Vance', 150, 380);
  return canvasJpeg(canvas, 0.85);
}
