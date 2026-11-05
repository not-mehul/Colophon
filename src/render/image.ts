// Cover images: cropping and resizing to 1600 × 2400 (2:3), and the small
// thumbnail kept for the library bench.

import { canvasJpeg } from './plate';

export const COVER_W = 1600;
export const COVER_H = 2400;

export interface Crop {
  /** Zoom over the smallest scale that fills the frame; 1 = fill. */
  zoom: number;
  /** Offset of the image centre from the frame centre, as a fraction of the frame (−0.5…0.5). */
  x: number;
  y: number;
}

export async function loadBitmap(bytes: Uint8Array, mediaType: string): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes as BlobPart], { type: mediaType }));
}

/**
 * Where the image lands in a frame of `fw × fh` for a crop: the drawn size and
 * its top-left corner. Shared by the crop sheet's preview and the output.
 */
export function placement(iw: number, ih: number, fw: number, fh: number, crop: Crop) {
  const fill = Math.max(fw / iw, fh / ih);
  const scale = fill * Math.max(1, crop.zoom);
  const w = iw * scale;
  const h = ih * scale;
  // Keep the frame covered: the offset can't pull an edge inside it.
  const maxX = Math.max(0, (w - fw) / 2);
  const maxY = Math.max(0, (h - fh) / 2);
  const dx = Math.max(-maxX, Math.min(maxX, crop.x * fw));
  const dy = Math.max(-maxY, Math.min(maxY, crop.y * fh));
  return { w, h, left: (fw - w) / 2 + dx, top: (fh - h) / 2 + dy, maxX, maxY };
}

/** Crops and resizes to a 1600 × 2400 JPEG. */
export async function cropCover(bitmap: ImageBitmap, crop: Crop): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const p = placement(bitmap.width, bitmap.height, COVER_W, COVER_H, crop);
  ctx.drawImage(bitmap, p.left, p.top, p.w, p.h);
  return canvasJpeg(canvas, 0.9);
}

/** A 160 × 240 JPEG for the bench, or null if the image won't decode. */
export async function thumbnail(bytes: Uint8Array, mediaType: string): Promise<Uint8Array | null> {
  try {
    const bitmap = await loadBitmap(bytes, mediaType);
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    const p = placement(bitmap.width, bitmap.height, 160, 240, { zoom: 1, x: 0, y: 0 });
    ctx.drawImage(bitmap, p.left, p.top, p.w, p.h);
    bitmap.close();
    return await canvasJpeg(canvas, 0.8);
  } catch {
    return null;
  }
}
