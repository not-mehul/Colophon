/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The build is one self-contained dist/index.html: scripts, styles, Fraunces
// and icons are all inlined, so it opens straight from disk (file://) with
// nothing to install and nothing fetched.
export default defineConfig({
  base: './',
  plugins: [svelte(), viteSingleFile({ removeViteModuleLoader: true })],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: ['chrome111', 'safari16', 'firefox115'],
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
