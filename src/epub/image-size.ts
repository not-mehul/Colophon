// Pixel size of a JPEG, PNG, GIF or WebP read from its header, so an EPUB's
// cover can be measured without decoding it (and in tests, without a canvas).

export interface Size {
  width: number;
  height: number;
}

const ZERO: Size = { width: 0, height: 0 };

function jpeg(view: DataView): Size {
  let offset = 2;
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset++;
      continue;
    }
    const marker = view.getUint8(offset + 1);
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    offset += 2 + length;
  }
  return ZERO;
}

function webp(view: DataView, bytes: Uint8Array): Size {
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === 'VP8 ' && bytes.length >= 30) {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (chunk === 'VP8L' && bytes.length >= 25) {
    const b = view.getUint32(21, true);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X' && bytes.length >= 30) {
    const w = bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16);
    const h = bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16);
    return { width: w + 1, height: h + 1 };
  }
  return ZERO;
}

export function imageSize(bytes: Uint8Array): Size {
  if (bytes.length < 16) return ZERO;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes.length >= 24) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(view);
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') {
    return webp(view, bytes);
  }
  return ZERO;
}

export function imageMime(bytes: Uint8Array, fallback = 'image/jpeg'): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[8] === 0x57) return 'image/webp';
  return fallback;
}
