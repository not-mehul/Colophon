// Scanning a book's ISBN barcode.
//
// In the Android app, Google's Code Scanner through the Colophon plugin
// (android/.../ColophonPlugin.kt): Play services draws the camera UI, so the
// app needs no camera permission. Elsewhere (iOS, browsers) a camera modal
// reads frames with the Shape Detection API, or with ZXing where that is missing.

import { registerPlugin } from '@capacitor/core';
import { mount, unmount } from 'svelte';
import CameraScanner from '../components/CameraScanner.svelte';
import { platform } from './native';

interface ColophonPlugin {
  scanBarcode(): Promise<{ value?: string }>;
}
const Colophon = registerPlugin<ColophonPlugin>('Colophon');

export function canScanBarcodes(): boolean {
  return platform === 'android' || !!navigator.mediaDevices?.getUserMedia;
}

/** Resolves with the scanned code, or null if the reader cancelled. */
export async function scanBarcode(): Promise<string | null> {
  if (platform === 'android') {
    const { value } = await Colophon.scanBarcode();
    return value?.trim() || null;
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch {
    throw new Error('Camera access was denied, or there is no camera.');
  }
  return new Promise((resolve) => {
    const scanner = mount(CameraScanner, {
      target: document.body,
      props: {
        stream,
        onDone: (result: string | null) => {
          stream.getTracks().forEach((t) => t.stop());
          void unmount(scanner);
          resolve(result);
        },
      },
    });
  });
}

type Decoder = (frame: HTMLCanvasElement | HTMLVideoElement) => Promise<string | null>;

/** BarcodeDetector where the browser has it (Chrome, Android WebView), ZXing elsewhere (Safari). */
export async function makeDecoder(): Promise<Decoder> {
  const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
  if ('BarcodeDetector' in globalThis) {
    const supported = await BarcodeDetector.getSupportedFormats().catch(() => [] as string[]);
    const usable = formats.filter((f) => supported.includes(f));
    if (usable.length) {
      const detector = new BarcodeDetector({ formats: usable });
      return async (frame) => (await detector.detect(frame))[0]?.rawValue ?? null;
    }
  }
  const zxing = await import('@zxing/library');
  const reader = new zxing.MultiFormatReader();
  const hints = new Map();
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.EAN_13, zxing.BarcodeFormat.EAN_8, zxing.BarcodeFormat.UPC_A, zxing.BarcodeFormat.UPC_E]);
  hints.set(zxing.DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  const canvas = document.createElement('canvas');
  return async (frame) => {
    if (!(frame instanceof HTMLVideoElement)) return null;
    canvas.width = frame.videoWidth;
    canvas.height = frame.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !canvas.width) return null;
    ctx.drawImage(frame, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const luminance = new Uint8ClampedArray(width * height);
    for (let i = 0; i < luminance.length; i++) luminance[i] = (data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114) | 0;
    try {
      const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(luminance, width, height)));
      return reader.decode(bitmap).getText();
    } catch {
      return null;
    }
  };
}
