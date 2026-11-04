# Colophon

An edition inspector, imprint editor and bindery for EPUB files. Open an EPUB, see how well it is put together, fix its metadata, cover and chapter order, and bind a clean copy. Everything runs in the browser, on your device.

Colophon uses **Editorial Dusk & Dawn**, the design system it shares with Waymark, BookShelf and Ledger. The spec is [`design/style.md`](design/style.md).

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
npm run serve        # http://localhost:5173
```

Nothing the UI needs comes from the network: Fraunces, the Lucide icons and JSZip are all bundled. Colophon only goes online when you search a catalog or download a cover.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The markup: header, tab rail, the four tabs, the settings sheet and two modals |
| `src/app.js` | The app: EPUB parsing, the audit, editing and repackaging |
| `src/styles/tokens.css` | **Generated.** Colour, type, spacing and motion tokens, plus the Fraunces `@font-face` rules |
| `src/styles/app.css` | Components and layout. Uses tokens only |
| `src/icons.js` | **Generated.** The Lucide icons Colophon uses, inlined |
| `src/vendor/jszip.min.js` | JSZip 3.10.2 (MIT) |
| `design/` | `style.md`, `tokens.json`, `build-tokens.mjs` and the Fraunces fonts, identical to the other three apps |

## Design tokens

Edit `design/tokens.json`, never `tokens.css`:

```sh
npm run tokens       # regenerate src/styles/tokens.css and copy the fonts
npm run icons        # regenerate src/icons.js after using a new data-lucide name
npm run check        # contrast check (style.md §15) and a literal-colour check (§1.1)
```

`npm run icons` needs `npm install` first (it reads the pinned `lucide-static`). The other two scripts have no dependencies.

## Licences

Fraunces: SIL Open Font License (`design/fonts/Fraunces-OFL.txt`). Lucide: ISC. JSZip: MIT or GPLv3 (`src/vendor/jszip-LICENSE.md`).
