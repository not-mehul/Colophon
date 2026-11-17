# Developing Colophon

How Colophon is built, run and tested. For what it does, see the [README](../README.md); for cutting a release, see [RELEASING.md](../RELEASING.md).

## Run it

```sh
npm install
npm run dev          # http://localhost:5173
npm run check        # tokens, lint, literal colours, typecheck, unit tests
npm run build        # dist/index.html, the whole tool in one file
npm run test:e2e     # builds, then the Playwright tests at phone size
```

Svelte 5, TypeScript and Vite. The library lives in IndexedDB (Dexie). API keys go to localStorage.

## One HTML file

`vite-plugin-singlefile` inlines the scripts, the styles, Fraunces and the icons into `dist/index.html`, and the lazy ZXing chunk with them, so the file opens from disk over `file://` and fetches nothing. `tests/e2e/standalone.spec.ts` opens the built file that way with every network request refused and checks it still works. Keep it that way: no Web Workers in separate files, no assets in `public/`, nothing loaded from a URL at run time.

- **Opening files.** The Open button, Ctrl/⌘ O, or dropping an EPUB on the page.
- **Saving.** Binding downloads the EPUB. Share uses the browser's share sheet where there is one (Chrome on Android, Safari), and downloads otherwise.
- **ISBN scanning.** A camera view that reads frames with `BarcodeDetector`, or ZXing where that is missing.
- **Escape** closes the topmost menu, sheet or modal.
- **Catalogs and covers** are fetched by the browser. Google Books and Open Library allow it; a cover host that sends no CORS headers needs the CORS proxy in Settings.

## Layout

| Path | What it is |
|---|---|
| `src/epub/` | The EPUB core, with no UI: open, validate, audit, accessibility, bind, build, file names, the table of contents |
| `src/catalog/` | Catalog sources, ISBN handling, match confidence and the offline cache |
| `src/state/` | The bench (the open edition and its draft), the library, settings, batch fixes and UI state |
| `src/components/` | The views and sheets; `ui/` holds Colophon's own pieces; TabRail, Toast and ThemeToggle come from `dusk-dawn` |
| `src/platform/` | Browser pieces: downloads and share, vibration, the scanner, secrets, theme, HTTP |
| `src/render/` | Canvas drawing: cover plates, crops, thumbnails and the report card |
| `src/styles/` | `app.css`, which imports `dusk-dawn/tokens.css` and `dusk-dawn/components.css` first |
| `vendor/dusk-dawn/` | The frozen copy of the design package (below) |
| `tests/` | Vitest unit tests with EPUB 2, EPUB 3 and broken fixtures, and the Playwright tests |

## Design

Colophon keeps the Editorial Dusk & Dawn look but is no longer part of the Dusk & Dawn suite. It uses a frozen copy of the design package at 3.0.0 in [`vendor/dusk-dawn/`](../vendor/dusk-dawn), installed as `"dusk-dawn": "file:vendor/dusk-dawn"`, and does not follow changes to the [`dusk-dawn`](https://github.com/not-mehul/dusk-dawn) repository. `vendor/dusk-dawn/style.md` is the spec. To change the look, edit the copy and run `node vendor/dusk-dawn/bin/dusk-dawn.mjs build`. `dusk-dawn check` (part of `npm run check`) tests contrast in both themes, and `dusk-dawn colours` (part of `npm run lint`) fails on any literal colour in `src/`.

```sh
npm run icons        # regenerate src/components/ui/icons.ts after using a new Lucide name
```
