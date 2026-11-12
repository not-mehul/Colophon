# Developing Colophon

How Colophon is built, run and tested. For what the app does, see the [README](../README.md); for cutting a release, see [RELEASING.md](../RELEASING.md).

## Run it

```sh
npm install
npm run dev          # http://localhost:5173
npm run check        # tokens, lint, literal colours, typecheck, unit tests
npm run test:e2e     # builds, then a Playwright smoke test at phone size
```

Svelte 5, TypeScript and Vite. The library lives in IndexedDB (Dexie). API keys go to the platform's secure storage (the Keychain on iOS, the Android Keystore), or to localStorage in the browser.

## Android and iOS

Capacitor 8 wraps the same build for Android and iOS.

```sh
npm run android      # build, sync and open Android Studio
npm run android:apk  # a debug APK
npm run ios          # build, sync and open Xcode
npm run assets       # redraw the app icon and splash screens
```

- **Open with.** Android registers a VIEW intent for `application/epub+zip`; iOS declares the `org.idpf.epub-container` document type. Both arrive through `appUrlOpen` (`src/platform/intake.ts`).
- **Links between the apps.** Colophon registers `colophon://` (`colophon://open` brings it forward) and may ask whether its five siblings are installed. *Send to BookShelf* opens `bookshelf://log?title=…&author=…&isbn=…` when BookShelf is there, and falls back to the share sheet otherwise (`src/platform/handoff.ts`). The scheme convention is shared by all six apps (`src/platform/links.ts`, style.md §14.1).
- **ISBN scanning.** On Android, Google's Code Scanner through `ColophonPlugin` (no camera permission). On iOS and in browsers, a camera view that reads frames with `BarcodeDetector`, or ZXing where that is missing.
- **System.** The back button closes the topmost sheet, then returns to Inspection, then to the bench. The system bars follow the theme, and the splash is Dusk's `--bg-grad-mid` behind the amber C.
- Catalog and cover requests use native HTTP in the apps, so cover hosts don't need CORS headers. In a browser, a CORS proxy can be set in Settings.

## Layout

| Path | What it is |
|---|---|
| `src/epub/` | The EPUB core, with no UI: open, validate, audit, accessibility, bind, build, file names, the table of contents |
| `src/catalog/` | Catalog sources, ISBN handling, match confidence and the offline cache |
| `src/state/` | The bench (the open edition and its draft), the library, settings, batch fixes and UI state |
| `src/components/` | The views and sheets; `ui/` holds Colophon's own pieces; TabRail, Toast and ThemeToggle come from `dusk-dawn` |
| `src/platform/` | Native bridges: files, share, haptics, the scanner, secrets, theme |
| `src/render/` | Canvas drawing: cover plates, crops, thumbnails and the report card |
| `src/styles/` | `app.css`, which imports `dusk-dawn/tokens.css` and `dusk-dawn/components.css` first |
| `tests/` | Vitest unit tests with EPUB 2, EPUB 3 and broken fixtures, and the Playwright smoke test |
| `android/`, `ios/` | The Capacitor projects |

## Design tokens

Tokens, fonts and the shared components live in the [`dusk-dawn`](https://github.com/not-mehul/dusk-dawn) package, installed at a tag. To change the design, change the package, tag a release, and move the tag in `package.json` (`style.md` §18). `dusk-dawn check` (part of `npm run check`) tests contrast in both themes, and `dusk-dawn colours` (part of `npm run lint`) fails on any literal colour in `src/`.

```sh
npm run icons        # regenerate src/components/ui/icons.ts after using a new Lucide name
```
