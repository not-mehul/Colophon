/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keep in sync with android.minWebViewVersion in capacitor.config.ts.
    target: ['chrome111', 'safari16'],
  },
  server: {
    port: 5173,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // The EPUB core parses XML and XHTML with DOMParser, as it does in the app.
    environment: 'jsdom',
    setupFiles: ['tests/unit/setup.ts'],
  },
});
