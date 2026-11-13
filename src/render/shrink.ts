// Draws an oversized picture smaller (src/epub/images.ts), in its own
// format. Resolves with null when the smaller copy wouldn't be smaller.

import { shrunkSize } from '../epub/images';
import { loadBitmap } from './image';

export async function shrinkImage(bytes: Uint8Array, mediaType: string): Promise<Uint8Array | null> {
  const bitmap = await loadBitmap(bytes, mediaType);
  try {
    const size = shrunkSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mediaType, 0.85));
    if (!blob || blob.type !== mediaType) return null;
    const out = new Uint8Array(await blob.arrayBuffer());
    return out.byteLength < bytes.byteLength ? out : null;
  } finally {
    bitmap.close();
  }
}
