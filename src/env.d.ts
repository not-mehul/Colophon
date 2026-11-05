/// <reference types="svelte" />
/// <reference types="vite/client" />

/** package.json version, injected by vite.config.ts. */
declare const __APP_VERSION__: string;

/** The Shape Detection API (Chrome and Android WebView; not yet in TypeScript's DOM lib). */
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
}
