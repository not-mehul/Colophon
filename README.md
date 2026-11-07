# Colophon

An edition inspector, imprint editor and bindery for EPUB files. Open an EPUB, see how well it is put together, fix its metadata, cover, chapter order and contents, and bind a clean copy. It runs in the browser and as an Android and iOS app, and everything stays on your device.

Colophon uses **Editorial Dusk & Dawn**, the design system it shares with Waymark, BookShelf, Ledger and Rosetta. Everything shared (tokens, Fraunces, the shared components and the colour checks) comes from one package, [`dusk-dawn`](https://github.com/not-mehul/dusk-dawn), whose `style.md` is the spec.

## What it does

- **The bench.** Recent editions as cards with their scores, ordered by recency, score (weakest first) or title, with a filter once the bench grows and a line on the shelf as a whole. Long-press to select several, then fix them in one go (both cover tags, orphan files, numbered chapter files, safe validation fixes, the file name template), remove them, or send them to BookShelf.
- **Inspection.** A score out of 100 over seven checks, a validation list in the manner of EPUBCheck (missing files, broken links, missing fonts and images, XHTML that isn't well formed) with one-tap fixes, an accessibility row (alt text, languages, reading order, EPUB Accessibility 1.1 metadata), and a 1080 × 1350 report card to share. The verdict shows what your edits have added since the file was opened, each check shows its own gain, and *Most to gain* jumps to the check with the most points left.
- **Imprint.** Title, authors, ISBN, publisher, language, series, subjects and synopsis, with the publication date picked on a calendar. Covers can be chosen, found online, composed as a typographic plate (Classic, Minimal, Noir with its glow taken from the current cover, or E-ink in greys), and cropped to 1600 × 2400.
- **Chapters.** The shape of the book (one bar per chapter, as tall as it is long, with the reading time and any suspiciously short chapters). Drag to reorder (with a haptic tap on the phone), rename or number the files, preview a chapter in a sandboxed frame, edit the table of contents (written to both the nav and the NCX), and set the bound file's name from a template.
- **Catalog.** Google Books, Open Library, ISBNdb and a custom catalog, by title or by an ISBN typed or scanned with the camera. Results are kept, so searches you've made before work offline. Import fields one by one; every import, sort and reset can be undone.
- **New edition.** A four-step builder that sets a Markdown or text manuscript as an EPUB 3 with a nav, an NCX and accessibility metadata.

**The proof.** Before binding, the proof lists every change (the value as opened struck through over the new one), grouped as the tabs are; any single change can be put back, or all of them, with Undo. The imprint checks an ISBN's check digit as you type and offers the corrected or ISBN-13 form. In a browser, Ctrl/⌘ S binds, Ctrl/⌘ O opens, Ctrl/⌘ Z undoes, 1–4 switch tabs and P opens the proof (listed in Settings).

Edits are saved as you make them, so an edition reopens where you left it. Binding writes over the copy saved before (`Documents/Colophon/` in the apps, a download in the browser), and the bound file becomes the new starting point.

## Run it

```sh
npm install
npm run dev          # http://localhost:5173
npm run check        # tokens, lint, literal colours, typecheck, unit tests
npm run test:e2e     # builds, then a Playwright smoke test at phone size
```

Svelte 5, TypeScript and Vite. The library lives in IndexedDB (Dexie). API keys go to the platform's secure storage (the Keychain on iOS, the Android Keystore), or to localStorage in the browser.

## The apps

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

## Licences

Fraunces: SIL Open Font License (shipped in `dusk-dawn`). Lucide: ISC. fflate and Dexie: MIT and Apache 2.0. ZXing: Apache 2.0.
