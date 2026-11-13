// Oversized images: pictures in the text far bigger than any reading screen
// needs, which make the file slow to open and to send. A picture is
// oversized when its longest side is over 2000 px or it is over 1 MB; it is
// shrunk (src/render/shrink.ts) to 1600 px on the longest side, in the same
// format and at the same path, so nothing that points to it changes. The
// cover is left alone: it has its own size check and its own replacement.

import { imageSize } from './image-size';
import type { Draft, Edition } from './types';

export const MAX_SIDE = 2000;
export const MAX_BYTES = 1_000_000;
export const TARGET_SIDE = 1600;
const SHRINKABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface Oversized {
  path: string;
  mediaType: string;
  width: number;
  height: number;
  size: number;
}

export function oversizedImages(edition: Edition, draft: Draft): Oversized[] {
  const removed = new Set(draft.removed);
  const out: Oversized[] = [];
  for (const item of edition.manifest) {
    if (!SHRINKABLE.has(item.mediaType) || !item.exists || removed.has(item.path)) continue;
    if (edition.cover && item.path === edition.cover.path) continue;
    if (draft.images?.[item.path]) continue;
    const bytes = edition.files.get(item.path);
    if (!bytes) continue;
    const { width, height } = imageSize(bytes);
    if (Math.max(width, height) > MAX_SIDE || bytes.byteLength > MAX_BYTES) {
      out.push({ path: item.path, mediaType: item.mediaType, width, height, size: bytes.byteLength });
    }
  }
  return out;
}

/** The size to draw a picture at so its longest side is at most `target`. */
export function shrunkSize(width: number, height: number, target = TARGET_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!longest || longest <= target) return { width, height };
  const scale = target / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
