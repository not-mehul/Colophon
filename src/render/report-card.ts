// The edition report as a 1080 × 1350 share card (style.md §8.16): the cover,
// the title, the score dial as the hero figure, and a meter per check.

import type { Audit } from '../epub/audit';
import { tierOf } from '../epub/audit';
import {
  CARD_FORMATS,
  CONTENT_INSET,
  MONO,
  SERIF,
  canvasToBlob,
  cardFontsReady,
  clipText,
  createCard,
  currentCardTheme,
  drawEyebrow,
  drawFooter,
  drawFrame,
  drawTracked,
  fitSerif,
  readPalette,
  type CardToken,
  type Palette,
} from './card-frame';

export interface ReportCardData {
  title: string;
  creator: string;
  /** "EPUB 3.0 · 12 chapters · 84,210 words" */
  facts: string;
  audit: Audit;
  cover: { bytes: Uint8Array; mediaType: string } | null;
  date: string;
}

const { width: W, height: H } = CARD_FORMATS.post;

const tierColor = (p: Palette, score: number) => p[tierOf(score).cssVar.slice(2) as CardToken];

export async function renderReportCard(data: ReportCardData): Promise<Blob> {
  const p = readPalette(currentCardTheme());
  await cardFontsReady();
  const { canvas, ctx } = createCard(W, H);
  drawFrame(ctx, p);
  let y = drawEyebrow(ctx, p, `Colophon · ${data.date}`);

  // The cover at the left, 2:3, and the title beside it.
  const coverW = 260;
  const coverH = 390;
  y += 56;
  let textX = CONTENT_INSET;
  if (data.cover) {
    try {
      const bitmap = await createImageBitmap(new Blob([data.cover.bytes as BlobPart], { type: data.cover.mediaType }));
      const scale = Math.max(coverW / bitmap.width, coverH / bitmap.height);
      const sw = coverW / scale;
      const sh = coverH / scale;
      ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, CONTENT_INSET, y, coverW, coverH);
      bitmap.close();
      ctx.strokeStyle = p['border-faint'];
      ctx.lineWidth = 2;
      ctx.strokeRect(CONTENT_INSET, y, coverW, coverH);
      textX = CONTENT_INSET + coverW + 48;
    } catch {
      // No cover on the card.
    }
  }
  const textW = W - CONTENT_INSET - textX;
  ctx.fillStyle = p['text-heading'];
  const size = fitSerif(ctx, data.title, textW, 76, 44);
  const words = data.title.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > textW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  lines.push(line);
  let ty = y + size;
  for (const l of lines.slice(0, 3)) {
    ctx.fillText(clipText(ctx, l, textW), textX, ty);
    ty += size * 1.1;
  }
  ctx.fillStyle = p['text-dim'];
  ctx.font = `italic 400 36px ${SERIF}`;
  ctx.fillText(clipText(ctx, data.creator || 'Unknown author', textW), textX, ty + 12);
  ctx.fillStyle = p['text-muted'];
  ctx.font = `400 24px ${MONO}`;
  ctx.fillText(clipText(ctx, data.facts, textW), textX, ty + 64);

  // The hero figure: the dial and the tier.
  y += coverH + 110;
  const r = 110;
  const cx = CONTENT_INSET + r + 10;
  const cy = y + r;
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = 'round';
  ctx.strokeStyle = p['chart-track'];
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + sweep);
  ctx.stroke();
  ctx.strokeStyle = tierColor(p, data.audit.score);
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + (sweep * data.audit.score) / 100);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = p['text-heading'];
  ctx.textAlign = 'center';
  ctx.font = `400 ${Math.round(r * 0.78)}px ${SERIF}`;
  ctx.fillText(String(data.audit.score), cx, cy + r * 0.26);
  ctx.textAlign = 'left';
  ctx.fillStyle = tierColor(p, data.audit.score);
  drawTracked(ctx, tierOf(data.audit.score).name, cx, cy + r + 56, 22, 0.2, 'center');

  // A meter per check beside it.
  const barX = cx + r + 80;
  const barW = W - CONTENT_INSET - barX;
  data.audit.checks.forEach((check, i) => {
    const by = y - 6 + i * 50;
    ctx.fillStyle = p['text-muted'];
    ctx.font = `400 26px ${SERIF}`;
    ctx.fillText(clipText(ctx, check.title, barW - 110), barX, by);
    ctx.fillStyle = p['text-heading'];
    ctx.font = `400 22px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${check.score}/${check.max}`, barX + barW, by);
    ctx.textAlign = 'left';
    ctx.fillStyle = p['chart-track'];
    ctx.fillRect(barX, by + 12, barW, 4);
    ctx.fillStyle = check.score === check.max ? p['accent-sage'] : p['accent-amber'];
    ctx.fillRect(barX, by + 12, (barW * check.score) / check.max, 4);
  });

  drawFooter(ctx, p, 'Colophon', 'Edition report');
  return canvasToBlob(canvas);
}
