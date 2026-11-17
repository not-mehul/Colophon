# Editorial Dusk & Dawn

The shared design system for **Waymark**, **BookShelf**, **Ledger**, **Rosetta** and **Mise**, and for any app that joins them. Every app gets it from one package, [`dusk-dawn`](https://github.com/not-mehul/dusk-dawn) (§18).

One design language, two themes. **Dusk** is the dark theme: serif display type over a near-black surface with ambient amber and sage glows, like a late-night reading room. **Dawn** is the light theme: the same type and structure on warm paper cream, like a sunlit study rather than a sterile dashboard.

Both themes use generous whitespace, monospace for anything data-flavoured, and **Material 3 Expressive** shape and motion: soft corners from a shape scale that morph under the finger, springs for everything that moves, and a few moments of real delight hidden in every app. Dawn is not a light mode bolted on. Both themes come from a single set of semantic tokens.

**2.0.0 is the Expressive release.** The palette, type families and voice are unchanged: still a reading room, not a toy shop. What changed is how things feel in the hand. Corners round, presses squish, numbers count up, and finishing something worth finishing gets a celebration. Every bit of it switches off with reduced motion (§11, §15).

This version merges the original reference with what each app worked out on its own: Waymark's component and interaction rules, Ledger's contrast-tuned Dawn accents and score tiers, and BookShelf's token naming and empty states. Section 17 lists every change from the original.

---

## 1. Principles

1. **Every colour is a token.** Component code never names a colour. A literal colour outside the two theme blocks is a bug.
2. **Tokens are named for their role, not their hue.** Use `--text-heading`, not `--cream`, because "heading text" means something in both themes and "cream" does not.
3. **Accents are seasoning.** An italic word, a number, an icon tint, the one active control. Never a whole surface.
4. **One question at a time.** Forms ask in the order the answers arrive. A choice that needs explaining gets a sentence next to it, never a tooltip.
5. **Pick, don't type.** Dates, times, places, ratings and categories are chosen from a control. Free text is for names and notes.
6. **Motion has a spring in its step.** Everything that moves rides a Material 3 Expressive spring from `tokens.json`. Spatial springs (position, size, shape) may overshoot a little; effects springs (colour, opacity) never do. Motion answers the reader or marks an achievement: it never loops for decoration and never makes anyone wait (§11).
7. **It works with the radio off.** Fonts are bundled, never fetched, and nothing the UI needs to draw itself touches the network.
8. **Leave something to find.** Every app hides a few easter eggs and celebrates real accomplishments (§11.3). Delight is a reward, never an obstacle: an easter egg never blocks, hides or changes data, and the app works the same for someone who never finds one.

---

## 2. Theming architecture

Each token is defined twice, once per theme, under the same name.

```css
:root,
[data-theme="dark"] {        /* Dusk: the default */
  color-scheme: dark;
  --text-heading: #f5ecd9;
  /* …every token… */
}

[data-theme="light"] {       /* Dawn */
  color-scheme: light;
  --text-heading: #211d17;
  /* …the same tokens… */
}
```

`[data-theme="dark"]` is addressable on its own so that a share card, or any probe element, can read either palette whatever the page theme is.

**The theme preference has three states: System, Dusk and Dawn.** System follows `prefers-color-scheme` and keeps following it live. The header toggle is binary: tapping it while on System picks whichever side the OS is currently showing. Settings offers all three as a segmented control. The choice is stored per app, and new installs start on System.

```ts
type ThemeMode = 'system' | 'dusk' | 'dawn';

function applyTheme(mode: ThemeMode) {
  const dark = mode === 'system'
    ? matchMedia('(prefers-color-scheme: dark)').matches
    : mode === 'dusk';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  setNativeBars(dark);            // status and navigation bar icons (§14)
  dispatchEvent(new Event('themechange'));   // canvas and SVG redraw (§10)
}
```

**Rules:**

- Never add a token to only one theme block.
- When a token is used as a **background**, check its paired text token in both themes. `--text-strong` flips from near-white to near-black, so as a fill it only works with `--on-invert` on top.
- Colours that need adjustable opacity (glows, tints, tinted borders) store an RGB triple, `--accent-amber-rgb: 212, 165, 116`, and are used as `rgba(var(--accent-amber-rgb), 0.25)`.

---

## 3. Colour tokens

Every value in this section is the source of truth. Step 2 of the plan generates each app's theme file from it.

### 3.1 Page surface

The page background is a three-stop vertical gradient, never a flat fill, with `background-attachment: fixed`.

| Token | Dusk | Dawn | Role |
|---|---|---|---|
| `--bg-grad-top` | `#14110e` | `#f3ece0` | Top of the gradient (warmest) |
| `--bg-grad-mid` | `#0f0d0b` | `#efe6d8` | Middle; also the solid "page" colour for sheets and native bars |
| `--bg-grad-bot` | `#0c0a08` | `#e9dfce` | Bottom (coolest) |

```css
html, body {
  background: linear-gradient(180deg,
    var(--bg-grad-top) 0%, var(--bg-grad-mid) 50%, var(--bg-grad-bot) 100%);
  background-attachment: fixed;
}
```

Dawn is warm paper. `#ffffff` is forbidden as a surface, and so is `#000000` in Dusk.

### 3.2 Text

Six steps, from highest emphasis down to decoration.

| Token | Dusk | Dawn | Role |
|---|---|---|---|
| `--text-strong` | `#f5f5f4` | `#1c1917` | Highest emphasis: input text, active labels |
| `--text-heading` | `#f5ecd9` | `#211d17` | Headings, serif display, key numbers |
| `--text-body` | `#e8e1d5` | `#3a342c` | Body text |
| `--text-muted` | `#d6d3d1` | `#4a443b` | Secondary text, inline strong |
| `--text-dim` | `#a8a29e` | `#6a6257` | Labels, hints, sublabels, footers |
| `--text-faint` | `#78716c` | `#938a7c` | Decoration only: separators, serials, disabled |

`--text-dim` is the dimmest token allowed for text someone needs to read. It passes 4.5:1 against every page and panel surface in both themes. `--text-faint` does not, and is reserved for things you could delete without losing information.

### 3.3 Accents

| Token | Dusk | Dawn | Role |
|---|---|---|---|
| `--accent-amber` | `#d4a574` | `#815c2d` | Primary accent: italic emphasis, icons, links, active rule |
| `--accent-bright` | `#fcd34d` | `#e0a92a` | Fills only: primary button, FAB, active segment |
| `--accent-bright-hover` | `#fef3c7` | `#c89320` | Hover and press of bright fills |
| `--accent-sage` | `#9fb3a0` | `#566856` | Secondary accent: progress, "done" states, the cool note |
| `--danger` | `#f87171` | `#b33528` | Destructive actions, errors |
| `--on-accent` | `#1c1917` | `#1c1917` | Text on `--accent-bright` (same in both themes) |
| `--on-invert` | `#1c1917` | `#f3ece0` | Text on a `--text-strong` fill (inverted secondary button) |
| `--on-danger` | `#1c1917` | `#f6efe2` | Text on a `--danger` fill |

RGB triples, for opacity:

| Token | Dusk | Dawn |
|---|---|---|
| `--accent-amber-rgb` | `212, 165, 116` | `176, 125, 62` |
| `--accent-bright-rgb` | `252, 211, 77` | `224, 169, 42` |
| `--accent-sage-rgb` | `159, 179, 160` | `111, 135, 112` |
| `--danger-rgb` | `248, 113, 113` | `192, 57, 43` |
| `--cream-rgb` | `245, 236, 217` | `120, 95, 50` |

The Dawn RGB triples are deliberately lighter than the Dawn solid accents. Triples feed glows, tints and tinted borders, which need warmth more than contrast. The solid tokens are used for text and icons, so they are deepened to pass 4.5:1 on cream. The original `#b07d3e` amber measured 2.9:1, which fails even the 3:1 large-text threshold.

`--accent-bright` is never used for text in Dawn (1.7:1 on cream). It is a fill.

Amber and sage are a complementary warm and cool pair, both muted and never saturated. The pairing reads as considered rather than decorative.

### 3.4 Lines

| Token | Dusk | Dawn | Role |
|---|---|---|---|
| `--border` | `#44403c` | `#cdbfa6` | Solid borders: inputs, toggles, tab tracks |
| `--border-strong` | `rgba(68,64,60,0.6)` | `rgba(120,105,80,0.45)` | Emphasised hairlines |
| `--border-soft` | `rgba(68,64,60,0.5)` | `rgba(120,105,80,0.32)` | Panel borders, section dividers |
| `--border-faint` | `rgba(68,64,60,0.4)` | `rgba(120,105,80,0.22)` | Internal dividers, hairline grids |

### 3.5 Surfaces

Translucent layers that lift content off the background. These are the "reading zones".

| Token | Dusk | Dawn | Role |
|---|---|---|---|
| `--panel-bg` | `rgba(20,17,14,0.6)` | `rgba(255,251,243,0.7)` | Standard panel and card |
| `--panel-bg-faint` | `rgba(20,17,14,0.4)` | `rgba(255,251,243,0.45)` | Control tracks, stat tiles |
| `--input-bg` | `rgba(12,10,8,0.8)` | `rgba(255,252,245,0.9)` | Inputs: recessed against the panel |
| `--chip-bg` | `rgba(28,25,23,0.6)` | `rgba(245,238,226,0.85)` | Option chips |
| `--chip-bg-hover` | `rgba(28,25,23,0.85)` | `rgba(238,229,213,0.95)` | Chip hover and press |
| `--hover-bg` | `rgba(41,37,36,0.4)` | `rgba(205,191,166,0.3)` | Generic hover and press wash |
| `--disabled-bg` | `rgba(41,37,36,0.6)` | `rgba(220,210,192,0.6)` | Disabled control fill |
| `--sheet-bg` | `#0f0d0b` | `#efe6d8` | Bottom sheets and full-screen flows (opaque) |
| `--modal-bg` | `#14110e` | `#fcf8f0` | Modal card, toast. Opaque: nothing behind a modal shows through it |
| `--modal-backdrop` | `rgba(12,10,8,0.82)` | `rgba(60,52,40,0.45)` | Dimming layer behind modals and sheets |

In Dusk, inputs are darker than their panel. In Dawn, inputs are lighter than the cream panel. Both read as recessed, by going in opposite directions.

### 3.6 Effects and states

| Token | Dusk | Dawn | Role |
|---|---|---|---|
| `--focus-ring` | `#d4a574` | `#815c2d` | Keyboard focus outline (2px, offset 2px). Solid, 3:1 or better on every surface |
| `--shadow-rgb` | `0, 0, 0` | `90, 72, 44` | Shadow colour |
| `--shadow-strength` | `1` | `0.4` | Shadow opacity multiplier |
| `--error-bg` | `rgba(69,10,10,0.2)` | `rgba(192,57,43,0.12)` | Error wash |
| `--notice-bg` | `rgba(252,211,77,0.08)` | `rgba(224,169,42,0.12)` | Notice and highlight wash |
| `--success-bg` | `rgba(159,179,160,0.12)` | `rgba(111,135,112,0.14)` | Confirmation wash ("Backup saved") |

Dawn shadows are warm brown, not black, because a black shadow on cream looks like dirt. Use them as `rgba(var(--shadow-rgb), calc(0.4 * var(--shadow-strength)))`.

### 3.7 Data colours

Graphics are the one place where colour carries meaning instead of emphasis, so they have their own tokens. These are for strokes, fills and markers only, and need 3:1. Numbers and labels beside them stay in the text tokens.

**Quality scale.** A five-step ramp from best to worst, shared by Ledger's score tiers, BookShelf's rating distribution and any future "how good was it" graphic.

| Token | Dusk | Dawn | Ledger tier |
|---|---|---|---|
| `--scale-1` | `#9fb3a0` | `#3f7a4a` | Exceptional (85+) |
| `--scale-2` | `#b8c9a0` | `#66862f` | Strong (72+) |
| `--scale-3` | `#d4a574` | `#a4662c` | Decent (58+) |
| `--scale-4` | `#c08050` | `#b0552a` | Mixed (42+) |
| `--scale-5` | `#f87171` | `#b9382b` | Challenging |

**Series.** For charts with unordered categories, and for segmented graphics. Use them in order and never use more than four. Past four, group the rest as "Other" in `--series-4`.

| Token | Dusk | Dawn |
|---|---|---|
| `--series-1` | `rgba(212,165,116,0.85)` amber | `rgba(129,92,45,0.85)` |
| `--series-2` | `rgba(159,179,160,0.85)` sage | `rgba(86,104,86,0.85)` |
| `--series-3` | `rgba(252,211,77,0.7)` bright | `rgba(224,169,42,0.8)` |
| `--series-4` | `rgba(245,236,217,0.35)` cream | `rgba(120,95,50,0.35)` |
| `--chart-grid` | `rgba(120,113,108,0.2)` | `rgba(120,105,80,0.25)` |
| `--chart-track` | `rgba(68,64,60,0.5)` | `rgba(120,105,80,0.2)` |

**Maps.** Water is the one cool note in a warm system. In Dusk the land is the same stone the panels are cut from. In Dawn the land is the paper and the water is a wash printed over it.

| Token | Dusk | Dawn |
|---|---|---|
| `--map-water` | `#0e1316` | `#d7e0e0` |
| `--map-land` | `#332d28` | `#f6efe2` |
| `--map-coast` | `rgba(168,162,158,0.5)` | `rgba(147,138,124,0.6)` |
| `--map-grid` | `rgba(168,162,158,0.1)` | `rgba(120,105,80,0.25)` |
| `--map-visited` | `rgba(212,165,116,0.45)` | `rgba(176,125,62,0.28)` |
| `--map-route` | `#d4a574` | `#815c2d` |

**Camera.** The barcode scanner's viewfinder is black in both themes, because the camera image needs it. `--scanner-bg: #000`, `--scanner-fg: #fff` and `--scanner-scrim: rgba(0,0,0,0.45)` are the only pure black and white in the system, and they are defined once and shared by both themes.

---

## 4. Atmosphere

The trademark element: three large, very soft radial glows in a fixed layer behind content. They add depth and warmth without texture. The glow tints come from the RGB triples, so they shift with the theme.

```css
.glow-layer { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.glow { position: absolute; border-radius: 50%; }

.glow-1 { /* amber, top right */
  top: -20%; right: -15%; width: 900px; height: 900px;
  background: radial-gradient(circle,
    rgba(var(--accent-amber-rgb), 0.10) 0%,
    rgba(var(--accent-amber-rgb), 0.03) 30%, transparent 60%);
}
.glow-2 { /* sage, bottom left */
  bottom: -30%; left: -20%; width: 1000px; height: 1000px;
  background: radial-gradient(circle,
    rgba(var(--accent-sage-rgb), 0.08) 0%,
    rgba(var(--accent-sage-rgb), 0.02) 35%, transparent 65%);
}
.glow-3 { /* cream, centre */
  top: 40%; left: 30%; width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(var(--cream-rgb), 0.03) 0%, transparent 60%);
}
```

**No `filter: blur()` on the glows.** A gradient with a long transparent tail is already soft. A blurred 1000px layer costs a full-screen render pass on every scroll frame in an Android WebView, and gains nothing you can see. This is Waymark's finding, applied to all three apps.

Avoid noise overlays, grain, and animated backgrounds. They fight text contrast.

---

## 5. Typography

Type is identical in both themes. Only colour changes.

### 5.1 Families

| Role | Stack | Used for |
|---|---|---|
| Display serif | `Fraunces, "Iowan Old Style", "Apple Garamond", Baskerville, Georgia, "Noto Serif", serif` | Titles, section headings, card titles, stats, scores, verdicts, hints |
| Body sans | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | Paragraphs, buttons, form values |
| Mono | `ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", "Liberation Mono", monospace` | Eyebrows, labels, codes, times, counts, numeric inputs |

Serif is weight 400 (`--weight-regular`), with `letter-spacing: -0.01em`. The Expressive **emphasized** voice is `--weight-emphasized` (600): use it for one hero number or word per screen (a perfect score, a finished count, a celebration line), never for running text. `--weight-heavy` (760) is only for the italic word inside an emphasized display line. An italic variant carries emphasis: one italic word inside a headline, set in `--accent-amber`. Italic is also the voice of section headings and hints.

**Fraunces is bundled.** Each app ships the Fraunces variable font (Latin subset, upright and italic, about 150 KB together, SIL Open Font License) as local WOFF2 files, so the serif looks the same on Android and iOS and still needs no network. The system serifs remain as fallbacks while the font loads (`font-display: swap`). Use the weight tokens only; the optical-size axis adjusts itself to the font size.

### 5.2 Scale

Sizes are in `rem` on a 16px root. Never shrink the root on mobile.

| Style | Size / line-height | Family | Notes |
|---|---|---|---|
| Page title | 3rem / 1 (≥ 640px: 4rem / 0.95) | Serif | `letter-spacing: -0.02em` |
| Section heading | 1.875rem / 1.15 | Serif italic | |
| Sheet / modal title | 1.5rem / 1.2 | Serif italic | |
| Card title | 1.25rem / 1.25 | Serif | |
| Verdict / hero number | 2.25rem (≥ 640px: 3rem) | Serif | Scores, the "verdict" in a modal |
| Stat | 1.875rem / 1.05 | Serif | Stat tiles, dial centre |
| Tagline | 1.125rem / 1.45 | Serif italic | Header subtitle |
| Body | 1rem / 1.65 | Sans | |
| Body small | 0.875rem / 1.5 | Sans | Secondary rows, notices |
| Control | 0.875rem / 1.3 | Sans | Inputs, chips |
| Button label | 0.75rem, tracked 0.15em, caps, 500 | Sans | All button sizes |
| Data | 0.875rem / 1.3 | Mono | Times, codes, flight numbers |
| Data small | 0.75rem / 1.35 | Mono | Metadata in rows |
| Section label | 0.6875rem, tracked 0.25em, caps | Mono | `--text-dim`. Eyebrows, section markers, tab rail |
| Field label | 0.625rem, tracked 0.2em, caps | Mono | `--text-dim`. Above every field |
| Hint / footnote | 0.8125rem / 1.55 | Serif italic | `--text-dim` |
| Display emphasized | 3.5rem / 1, `-0.03em` | Serif 600 | `.t-display-emphasized`; the italic word goes 760 in `--accent-amber`. Celebrations, year-in-review, a perfect score |
| Step | `clamp(1.625rem, 4.5vw + 0.5rem, 2.5rem)` / 1.35 | Serif | `--text-heading`. One instruction at a time, read from arm's length: Mise's cooking mode (`.t-step`) |

All-caps tracked mono is the core motif: eyebrows, labels, tabs and section markers. Never set all-caps at body size, and never track lowercase text.

Use `font-variant-numeric: tabular-nums` wherever numbers line up in a column: tables, rankings, timelines, counts.

---

## 6. Layout and spacing

### 6.1 Spacing scale

| Token | Value | Use |
|---|---|---|
| `--space-1` | 0.25rem (4px) | Icon to label |
| `--space-2` | 0.5rem (8px) | Inside a group |
| `--space-3` | 0.75rem (12px) | Between chips, between label and field |
| `--space-4` | 1rem (16px) | Between fields, grid gaps |
| `--space-5` | 1.5rem (24px) | Panel padding, between groups |
| `--space-6` | 2.5rem (40px) | Between sections |
| `--space-7` | 3.5rem (56px) | Below the page header |

### 6.2 Page

- Content max width `880px`, centred.
- Page padding: mobile `2.5rem 1.25rem 3.5rem`; at 640px and up `4rem 1.5rem 5rem`. Add the safe-area insets on top (§14).
- Content sits at `position: relative; z-index: 1`, above the glow layer.
- Section dividers are a 1px line in `--border-soft`.

### 6.3 Grids

- Paired elements: `repeat(auto-fit, minmax(280px, 1fr))`, gap 1rem.
- Hairline grids: a 1px gap over a `--border-faint` background, which draws single-pixel dividers without doubled borders. Use for stat rows and calendars.
- One column below 640px.

### 6.4 Shape

Shapes follow the **Material 3 Expressive corner scale**, as tokens:

| Token | Value | Used for |
|---|---|---|
| `--corner-xs` | 4px | Inner segments of a connected button group, tiny marks |
| `--corner-sm` | 8px | Inputs, option chips at rest, thumbnails |
| `--corner-md` | 12px | Notices, rows, a pressed button (`--radius` is the same 12px for app-local surfaces) |
| `--corner-lg` | 16px | Panels, cards, hairline grids, toasts, the FAB at rest |
| `--corner-lg-plus` | 20px | Segmented track, timer chips |
| `--corner-xl` | 28px | Modals, sheets (top corners), empty states, the FAB on hover |
| `--corner-xl-plus` / `--corner-2xl` | 32px / 48px | Hero art, share-card frames, large expressive surfaces |
| `--corner-full` | pill | Buttons, icon buttons, badges, status chips, selected chips, switches, the theme toggle, meters |

**Shapes morph.** A control changes shape to show its state, on the fast spatial spring: a pressed button squares off from a pill to `--corner-md`; a selected chip rounds from `--corner-sm` to a pill; the chosen segment of a segmented control becomes a pill while its neighbours stay squarer; the FAB rounds towards a circle under the pointer. Morph the corner radius, never the size of the hit target.

**The Expressive shape set** (`SHAPES` in the package: circle, cookies 4 to 12, sunny, clover, flower, soft burst, puffy, triangle, square, pentagon, diamond, gem, heart) is for decoration and identity only: the loading indicator, confetti, avatars and shaped thumbnails (`shapeClipPath()` with `.dd-shape`). Every shape is sampled with the same number of points, so any one can morph into any other. Never clip text or a control into a shape.

---

## 7. Surfaces

### 7.1 Panel

```css
.panel {
  background: var(--panel-bg);
  backdrop-filter: blur(4px);
  border: 1px solid var(--border-soft);
  border-radius: var(--corner-lg);
  padding: 1.5rem;
}
```

Surface weights, lightest to densest: `--panel-bg-faint` (tracks, tiles) → `--panel-bg` (panels, cards) → `--input-bg` (recessed fields) → `--modal-bg` (modal, toast; opaque) → `--sheet-bg` (opaque).

`backdrop-filter` is optional. On Android it is skipped below WebView 76, and it is not worth a per-frame cost on long lists. The panel's translucency over the glows does the lifting either way. Never put `backdrop-filter` on list rows. Use it only on fixed chrome and panels.

### 7.2 Cards and rows

There are two list forms. Pick by content, and use the same form for the same content type across apps.

- **Card**: a panel with an optional thumbnail, a serif title, a mono metadata line and at most one trailing figure (score, rating, time). Use for things with a picture or a figure: a book, a city, a stay.
- **Row**: no panel. Rows are separated by `--border-faint` hairlines inside one panel. Use for long homogeneous lists: episodes, timeline items, settings, search results.

A tappable card or row gets `--hover-bg` on hover and press, and gives a little under the finger (`.dd-pressable`). Cards may lift on hover with a fine pointer (`.dd-lift`); rows never do. A trailing chevron (`chevron-right`, `--text-faint`) means it opens a screen. No chevron means it acts in place.

Thumbnails have `--corner-sm` corners (covers and posters keep a book's squarer `--corner-xs` spine side if the app draws one), `--border-faint` outlined, at a fixed aspect ratio (2:3 posters and covers, 1:1 places). Placeholders are `--panel-bg-faint` with a centred `--text-faint` icon.

---

## 8. Components

The canonical set. Each app implements exactly these, with these names, so a reader moving between apps meets the same controls. Sources are noted where one app's version became the standard.

### 8.1 Buttons

All buttons share one height (44px minimum touch target, 40px visual on dense desktop rows), a pill shape (`--corner-full`) that morphs to `--corner-md` and gives to `--press-scale` while pressed, and the button label style (caps, tracked 0.15em, 500 weight).

| Variant | Rest | Hover / press | Use |
|---|---|---|---|
| **Primary** | `--accent-bright` fill, `--on-accent` text, glow `0 0 40px rgba(var(--accent-amber-rgb),0.25)` | `--accent-bright-hover`, glow widens to 56px | The one forward action on a screen |
| **Secondary** | Transparent, 1px `--text-strong` border and text | Fill `--text-strong`, text `--on-invert` | Equal-weight alternatives |
| **Muted** | Transparent, 1px `--border`, `--text-dim` text | Text `--text-heading`, border `--text-dim` | Back, Cancel, Skip |
| **Danger** | Transparent, 1px `--danger` border and text | Fill `--danger`, text `--on-danger` | Delete. Outlined, never filled at rest (Waymark) |
| **Icon** | No fill or border, `--text-dim` icon | `--text-heading` | Close, overflow, fullscreen |
| **FAB** | 56px, `--corner-lg`, `--accent-bright`, `--on-accent` icon, glow plus soft shadow | `--accent-bright-hover`; rounds to `--corner-xl` and the icon turns 90° on hover; a full circle under the finger | The single "add" action of a top-level screen |

Disabled: `--disabled-bg` fill, `--text-faint` text, no glow, no border colour.

Paired buttons (Back and Next, Cancel and Save) are **the same width and height**. Colour carries the emphasis, not size (Waymark). The forward or committing action goes on the right.

Only one primary button per screen. The FAB counts as that screen's primary.

### 8.2 Chips and badges

| Kind | Look | Use |
|---|---|---|
| **Option chip** | 44px tall (a full touch target), `--chip-bg`, 1px `--border-soft`, `--text-muted`, `--corner-sm`. Selected: `--accent-bright` fill, `--on-accent` text, morphs to a pill | Repeatable filters and quick picks |
| **Tag chip** | `rgba(amber, 0.14)` fill, 1px `--border-soft`, `--text-heading`, optional × | User tags and collections |
| **Status chip** | Mono 0.625rem caps, 1px tinted border, no fill. Sage = done or active, amber = in progress, dim = planned | Reading or watching status, booking state |
| **Count badge** | Mono 0.625rem, `rgba(amber,0.15)` fill, `--accent-amber` text, pill | Counts on tabs |

### 8.3 Choice cards (Waymark)

A choice that explains itself: icon, word and one sentence ("Ground: taxis, trains and transfers"). Use it at the top of a form when choosing a kind of thing, which happens once. Use option chips for filters, which happen often. Grid of `minmax(150px, 1fr)`. The selected card gets an `--accent-amber` 1px border and `rgba(amber,0.08)` wash.

### 8.4 Segmented control

A Material 3 Expressive **connected button group**: a `--corner-lg-plus` track with 1px `--border` over `--panel-bg-faint`; inner segments have `--corner-xs` corners and the two ends are round. Inactive options are `--text-muted`, with `--hover-bg` on hover. **The active option is `--accent-bright` with `--on-accent` text and weight 500, and morphs into a pill**, never `--text-strong` as a fill. Use it for two to four short, mutually exclusive options, such as a sort order or the theme setting. Past four options, use a tab rail or a picker.

### 8.5 Tab rail (Waymark and BookShelf)

Top-level and in-screen navigation. **One pattern in all three apps**, replacing Ledger's boxed tab grid.

- Words in the section label style (mono, caps, 0.25em) on a 1px `--border-soft` baseline.
- Inactive tabs are `--text-dim`, and `--text-heading` on hover. The active tab is `--text-heading` with a **3px `--accent-amber` rule, rounded on top,** under the word.
- The rule springs between tabs: its position on the fast spatial spring and its width on the default one, so it stretches a little as it travels. Nothing else moves.
- Horizontally scrollable when it overflows, with no visible scrollbar. Keep the active tab in view.
- A count badge may follow a label.
- Placed under the page header. **No bottom navigation bar.** These apps have three to five top-level sections and a FAB, and the tab rail keeps the editorial top-of-page structure.

#### 8.5.1 Icon tabs (top-level sections on a phone)

The tab rail with a Lucide icon over each word, for an app's **top-level sections** when they are three to five and must all stay in view. `IconTabs` in this package; BookShelf, Ledger, Rosetta and Mise use it.

- The tabs **share the width evenly** (a grid of equal columns), so none is pushed off the edge, even with the phone's text size turned up. The word ellipsises before it ever scrolls.
- Each tab is at least 56px tall: a 22px icon (1.5 stroke, §9) over the word in mono caps at 0.625rem, tracked 0.08em.
- Inactive tabs are `--text-dim`; the active tab's word is `--text-heading` and its icon `--accent-amber`. The 3px rule sits **centred under the icon, at most 56px wide,** and springs between tabs as in the tab rail.
- A count sits on the icon's top-right corner as a filled badge (`--accent-bright`, `--on-accent`), capped at 99+.
- Still under the page header, never a bottom bar. In-screen navigation (filters, sub-views) keeps the word-only tab rail, or the compact form below.

#### 8.5.2 Compact icon tabs

`IconTabs` with `labels="selected"`: icons in a row, and **only the selected tab shows its word**, beside its icon. For a short set of filters whose icons read on their own, where five words would crowd a phone or need a second line: BookShelf's All · Books · Movies · TV · Quotes, and its floating bar.

- Each tab is at least 44px wide and 48px tall. The icons spread across the width, and the selected tab takes what it needs for its word. The word opens only when it fits whole: on a narrow phone or at large text sizes the selected tab keeps to its amber icon and rule, rather than showing a clipped word.
- Choosing a tab opens its word on the default spatial spring while the old one closes, and the 3px rule runs under the icon and word as they open. Under reduced motion it simply changes.
- The word is always in the tab, only clipped, so every tab keeps its accessible name, and the count stays on the icon's corner.
- Use it only where each icon is unmistakable. Top-level sections keep words under every icon (§8.5.1).

### 8.6 Inputs

- `--input-bg` fill, 1px `--border`, `--corner-sm`, padding `0.6875rem 0.875rem`, text `--text-strong`. An open picker field rounds to `--corner-md`.
- Focus: the border becomes `--accent-amber`, plus the focus ring for keyboard focus.
- Placeholder: serif italic in `--text-faint`.
- Mono face for numbers, codes, times, ISBNs and flight numbers. Use `inputmode` to bring up the right keyboard.
- Label above in the field label style. Help text below in the hint style, never a tooltip.
- Error: border `--danger`, message below in `--danger` body small, `aria-describedby` to the message.
- Never browser-default styling, and never a control that opens the system's own picker. Choices use `Select` (§8.6.1), clock times use `TimeField`, checkboxes use `.check` and sliders use `.range`. A bare `<select>`, `<input type="time">` or `<input type="date">` opens Android's Material picker, which belongs to neither theme.

**Pickers** (Waymark). Date, time, month and zone fields are tappable fields shaped exactly like a text input (same height, border and padding) that open a picker modal. Calendars and clocks share one six-wide grid. A picker never changes a value unless the reader presses Choose. The clock is shared as `TimeField` (a `"HH:MM"` value, times shown in the reader's locale, its words passed in for other languages).

**Checkbox** (`.check` on `<input type="checkbox">`). A 20px box with a 1.5px `--text-dim` border on `--input-bg`, `--corner-xs`. Checked: `--accent-bright` fill with an `--on-accent` tick that springs in, and the corners round to `--corner-sm`. The row or label around it is the 44px target.

**Slider** (Ledger metric slider; `.range` on `<input type="range">`). Track `--chart-track` 4px, fill `--accent-amber`, round thumb in `--accent-bright` with a 1px `--on-accent` ring (16px in Ledger, 20px in `.range`, which grows under the finger), inside a 44px target. Live value in serif to the right.

#### 8.6.1 Select menu

`Select` in this package replaces every `<select>`. The field is a `.select` (an input with a chevron); tapping it opens a menu of the options under it, or over it when there is more room above, so the system picker never appears.

- The menu is an opaque `--modal-bg` card, 1px `--border`, `--corner-lg`, 8px inside, with a soft shadow and a faint amber glow. It is at least as wide as the field and at most the screen less 8px each side, and scrolls inside when long. It sits in the top layer, so a modal or sheet never clips it.
- Options are at least 48px tall, body text in `--text-body`. The option under the finger or the keyboard gets `--hover-bg`. The chosen option is `rgba(amber, 0.14)` with `--text-heading` at the emphasized weight and an `--accent-amber` tick, and rounds to a pill (§6.4). Disabled options are `--text-faint`.
- Each option carries `data-value` with its value, for tests. Groups (Ledger's ranking) get a heading in the section label style and a `--border-faint` rule between them.
- Opening: the field's border turns `--accent-amber`, it rounds to `--corner-md`, and the chevron turns over on the fast spatial spring; the menu fades and settles from 96% on the default spatial spring. It leaves with the 160ms fade.
- Keyboard and screen readers: the WAI-ARIA select-only combobox. Focus stays on the field (`role="combobox"`, `aria-expanded`, `aria-activedescendant`); arrows, Home, End, Page Up and Down move; typing jumps to a match; Enter, Space or Tab chooses; Escape closes without closing the modal underneath. The active option carries the focus ring while the keyboard drives.
- A tap outside, Escape or Android back closes it unchanged. Apps call `dismissOverlay()` first in their back handler (§14).
- At 200% text, options and the field wrap their words; the menu never scrolls sideways.

Use it for five or more choices, or choices with long names. For two to four short ones, use the segmented control (§8.4).

**Rating** (BookShelf). Half-star input, 26px Lucide stars, empty `--text-faint`, filled `--accent-bright`. Read-only ratings in lists use 14px stars in `--accent-amber`.

### 8.7 Step flow (Waymark)

For creating anything with more than four fields: a city entry, a book, a booking.

- One question per screen, asked plainly as a serif heading ("Where did you stay?"), with no field label under it.
- A progress rail at the top: one 4px pill segment per step, springing to its colour, `--accent-amber` up to the current step, `--chart-track` after. Segments are tappable to go back. No "2 of 4" text.
- A footer with Back (muted) on the left and Next (primary) on the right, equal width. The last step's forward action commits ("Save").
- Answers live in the flow's state and survive going back and forth. Dismissing saves nothing.
- Editing an existing item uses a single scrolling form with the same fields, not a step flow.

### 8.8 Screen header (Waymark)

One line: back control, title and at most one action, on a shared baseline.

- **Top-level screen**: an eyebrow (section label style, the app's name or the date), the page title (serif, with one italic amber word if it has one), an optional tagline, and the theme toggle at the right.
- **Secondary screen**: back chevron, card-title-size serif title, and one icon action. No eyebrow and no explanatory paragraph. Explanations go next to the control they explain.

### 8.9 Theme toggle

A pill track (`--input-bg`, 1px `--border`) holding a moon and a sun, with a round sliding `--accent-bright` knob and a soft glow of the same colour. The icon under the knob is `--on-accent` (8:1 or better in both themes), the other is `--text-dim`. The knob moves on the fast spatial spring and squashes slightly under the finger; the sun's rays turn 90° as Dawn arrives and the moon tips as Dusk does. `role="switch"`, operable by Space and Enter, with `aria-checked` showing Dawn. Geometry is derived from three numbers (track, knob and inset), so each icon sits exactly under the knob.

### 8.10 Modal

Use it for focused tasks and confirmations that need attention: pickers, confirm dialogs, share previews, details on desktop.

- Centred card on `--modal-backdrop`. `--modal-bg` fill, 1px `rgba(amber,0.3)` border, `--corner-xl`, max width 560px, padding 1.75rem.
- Shadow: `0 30px 80px rgba(var(--shadow-rgb), calc(0.7 * var(--shadow-strength))), 0 0 80px rgba(var(--accent-amber-rgb), 0.18), inset 0 1px 0 rgba(var(--cream-rgb), 0.05)`.
- Decorative 1px corner brackets in `rgba(amber, 0.5)`, inset 14px from the top-left and bottom-right with a soft inner corner. They belong to the **frame**: when a long modal scrolls they stay at its corners and the content passes under them, never with it. (They are drawn as background layers of the card, which a scroll container keeps still, so they never affect layout either.)
- Header: optional eyebrow, then serif italic title, then the close icon button.
- Entrance: fade plus `translateY(12px) scale(0.98)` to rest on the default spatial spring. Exit: 160ms fade.
- Dismiss with the close button, a backdrop tap, Escape or system back. On Android, the predictive back gesture shrinks it to 0.9 and fades to 0.7 under the finger.
- Use the native `<dialog>` with `showModal()`, so focus trapping and `inert` come for free.

**Confirm modal.** A plain question as the title, one line of consequence, and two equal buttons: Cancel (muted) on the left, the action (danger or primary) on the right, labelled with the verb ("Delete trip", not "OK"). Only use it for things that cannot be undone or typed back in a few seconds. For everything else, use the undo toast.

### 8.11 Sheet (Ledger)

Use it for longer forms, settings and filters on phones.

- Rises from the bottom, full width up to 560px, max height 90dvh, scrolls inside. Opaque `--sheet-bg`, 1px `--border-soft` top border, top corners `--corner-xl`.
- A 32×4px pill `--border` grab handle centred at the top.
- Header row: serif italic title on the left, a muted "Close" or a primary "Save" on the right.
- Bottom padding includes the safe-area inset.
- Entrance: `translateY(100%)` to 0 on the calm spatial spring (a sheet is full width, so it never wobbles). Swipe down or system back dismisses it.
- At 900px and up, a sheet becomes a modal.

### 8.12 Toast and undo

One component in all apps, at the bottom centre above the safe area and the FAB.

- `--modal-bg`, 1px `--border`, `--corner-lg`, padding `0.75rem 1.25rem`, body small text in `--text-body`. Max width `min(100% - 2rem, 480px)`.
- An optional single action at the right, in the button label style in `--accent-amber`. Use "Undo" after any deletion that could be recreated.
- Rises 24px from 0.9 scale on the default spatial spring. It stays 4 seconds, or 6 with an action, and pauses while touched.
- **Celebration toast** (`kind: 'celebrate'`): for a found easter egg or a real milestone. A bright amber border and glow, and it pops in on the slow spatial spring with a slight turn. Use it rarely, or it stops meaning anything.
- `role="status"`, or `role="alert"` for failures.
- One at a time: a new toast replaces the current one.
- Always tappable, over a modal too. A modal `<dialog>` makes everything outside it inert, top-layer popovers included, so while one is open `Toast` keeps its regions inside the topmost modal, and puts them back in the page when it closes.

### 8.13 Notice banner

An inline status line: an 18px icon, a one-line headline and optional detail.

| Kind | Fill | Border | Icon |
|---|---|---|---|
| Notice | `--notice-bg` | `rgba(amber,0.3)` | `--accent-amber` |
| Success | `--success-bg` | `rgba(sage,0.35)` | `--accent-sage` |
| Error | `--error-bg` | `rgba(danger,0.35)` | `--danger` |

If tapping the banner fixes the problem ("Notifications are off. Turn on"), the whole banner is a button with a trailing chevron. Otherwise it is inert, and has no button role.

### 8.14 Empty states

There are two kinds. Pick by cause.

- **Nothing here yet** (first run, or a section never used): a panel with a dashed 1px `--border-soft` border and `--corner-xl`, padding `4rem 2rem`, a 40px Lucide icon at 1.25 stroke in `--text-faint` that drifts slowly (6s float, off under reduced motion), a serif italic title in `--text-heading` ("No cities yet"), one serif line in `--text-dim` saying what goes here, and one primary or secondary button to add the first one. (BookShelf)
- **Nothing matches** (a filter or search found nothing): one line in the hint style, centred, with no panel, and a muted "Clear filter" button if a filter caused it. (Waymark)

### 8.15 Figures

- **Stat tile**: `--panel-bg-faint`, 1px `--border-soft`, centred serif stat in `--text-heading` over a field label. Lay tiles out in a hairline grid.
- **Meter / progress bar**: 4px pill track in `--chart-track`, fill in `--accent-sage` for completion or `--accent-amber` for a value. Springs to its value (default spatial). For work in progress, use the wavy progress bar (§8.21).
- **Hero numbers** count up on the slow spatial spring the first time they appear (`use:countUp`), in the emphasized weight if they are the one figure that matters.
- **Score dial** (Ledger): a 270° arc. Track `--chart-track`, value stroke in the `--scale-*` token for its tier, a serif stat number in the centre, and the tier name below as a field label.
- **Bar list** (BookShelf stats, Ledger rankings): a label on the left, a 4px bar in `--series-1`, and a mono value on the right with tabular numbers.

### 8.16 Share cards

All three apps render share images (a city card, a year in review, a book, a trip). These rules are shared so the cards look like they belong to one family:

- 1080×1350 (4:5) by default, and 1080×1920 for stories.
- The theme follows the app's current theme. Read the palette from a probe element with `data-theme` set.
- Gradient surface plus the three glows at twice the opacity, a 1px hairline frame inset 48px in `rgba(amber,0.3)` with `--corner-2xl` corners, and corner brackets.
- An eyebrow at the top (the app's name and the date), a serif title, and one hero figure.
- A footer line in the field label style: app name on the left, a short tagline on the right. No URLs and no logos.

### 8.17 Settings

The same structure in every app, in a sheet on phones:

1. **Appearance**: theme (System, Dusk, Dawn segmented), language if available.
2. **App-specific**: metrics, categories, sources.
3. **Your data**: backup now, automatic backups, export (CSV, JSON, Markdown, zip), import.
4. **About**: version, licences, and a footnote in the italic-term pattern.

Each group starts with a section label. Rows are hairline-divided. A row's control goes on the right, and a hint goes under the label.

### 8.18 Switch row

An on/off setting is a switch row (`Switch`, `.switch-row`), from Rosetta. The whole row is one button with `role="switch"` and `aria-checked`, at least 56px tall: the label in `--text-heading` at 0.9375rem, an optional field hint under it, and the track on the right. The track is 44×26px in `--chart-track` with a 1px `--border`; on, it fills `--accent-bright` and the knob turns `--on-accent`, grows from 0.75 to full size and slides on the fast spatial spring. Under the finger the knob swells. Rows are divided by `--border-faint`, and the last one in a group has no rule.

Use a switch only for a setting that takes effect at once. A choice of two or more named options is a segmented control (§8.4).

### 8.19 Timer chip

A running countdown (Mise's cooking timers): a chip with a two-line label in `--text-dim` (what it times, and where), the time in mono at 1.125rem with tabular figures in `--accent-amber`, then its controls as icon buttons (pause, +1 min, stop), each still 44px. Paused, the time turns `--text-dim`. Done, the chip takes an `--accent-bright` border and a 14% wash that breathes slowly while its time rattles like a kitchen timer (the buttons hold still) as long as the alarm is due, unless reduced motion is set. Timer chips sit in a row that wraps, pinned at the top of the screen while any is left. The time is never the only signal that a timer has ended: the system notification and a toast say it in words (§15).

### 8.20 Loading indicator

Material 3 Expressive's loading indicator (`LoadingIndicator`): one `--accent-amber` shape that morphs through seven Expressive shapes (soft burst, cookie, pentagon, puffy, sunny, four-leaf cookie, gem) while it slowly turns. 48px by default; `contained` puts it on a pill of 14% amber for use over busy content such as a cover or a photo. It is a `progressbar` with a label ("Loading recipes"). Use it for waits under a few seconds with nothing to count. Under reduced motion it holds still as the first shape. Never show it for less than about 300ms: a flash of loader is worse than none.

### 8.21 Wavy progress

Material 3 Expressive's wavy progress bar (`WavyProgress`): a 4px rounded stroke in `--accent-amber` that ripples as a sine wave while the work goes on, over a flat `--chart-track` track with a small gap. With a `value` it fills to that fraction; without one it is indeterminate and the whole bar ripples. At 100% it flattens and turns `--accent-sage`. Use it for imports, backups, binding a book, scanning a folder: anything with a known amount of work. Under reduced motion the wave is flat.

---

## 9. Icons

Lucide (ISC licence), inlined as SVG, with `stroke="currentColor"`, stroke width 2, round caps and joins, and no fills. Waymark draws extra glyphs in the same idiom: ink within 3–21 of the 24 box, optically centred, closed shapes closed.

| Context | Size |
|---|---|
| Inline with text | 14px |
| In buttons, chips and labels | 16px |
| Banners and list leading icons | 18px |
| Empty states | 40px at stroke 1.25 |
| FAB | 22px |

The toggle icons use stroke 2.2 so they stay crisp at small sizes. An icon on its own needs an `aria-label`, and an icon next to text is `aria-hidden`.

---

## 10. Canvas, SVG and maps

Graphics drawn in script (the score dial, the map, charts, share cards) cannot inherit CSS variables through attributes. Read the tokens live and redraw on `themechange`:

```ts
const token = (name: string, el = document.documentElement) =>
  getComputedStyle(el).getPropertyValue(name).trim();

addEventListener('themechange', () => { drawMap(); drawDial(); });
```

Prefer inline SVG with `fill="var(--token)"` in Svelte markup where you can. It needs no redraw at all.

---

## 11. Motion

Motion is **Material 3 Expressive**: springs, not curves. It should feel physical and a little joyful, and it always has a job: answer a touch, show where something went, or mark something worth marking.

### 11.1 Springs

Each spring is a damping ratio and a stiffness in `tokens.json`, the same numbers Compose uses. The build turns each into a CSS `linear()` easing and a settling duration, so CSS, Svelte and native widgets move alike:

```css
transition: transform var(--spring-spatial-fast-dur) var(--spring-spatial-fast);
```

| Spring | Damping / stiffness | Use |
|---|---|---|
| `spatial-fast` | 0.6 / 800 | Small things that move or change shape: press morphs, switch knobs, chips, the tab rule. A visible little bounce |
| `spatial-default` | 0.8 / 380 | Medium things: modals and toasts arriving, cards, the FAB, meters |
| `spatial-slow` | 0.8 / 200 | Large or playful things: celebrations, hero numbers counting up, easter eggs |
| `spatial-calm` | 0.9 / 700 | Full-width surfaces that must not wobble: sheets, screen transitions |
| `effects-fast` | 1 / 3800 | Colour and opacity on small things: hover, pressed wash |
| `effects-default` | 1 / 1600 | Colour and opacity on medium things: selection fills |
| `effects-slow` | 1 / 800 | Colour and opacity on large things: scrims, backdrops |

**Spatial** springs move, resize and reshape, and may overshoot. **Effects** springs fade and recolour, and never overshoot (an overshooting colour flickers). Browsers without `linear()` fall back to `--ease-settle` and `--ease-standard` with the same durations. From JavaScript, `spring('spatial-default')` returns the easing and duration for the Web Animations API.

The older tokens stay for things that aren't springs:

| Token | Value | Use |
|---|---|---|
| `--ease-settle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Fallback for spatial springs |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Fallback for effects springs; keyframed flourishes |
| `--dur-hover` … `--dur-exit` | 150–320ms | Exits (160ms, ease-in: leaving things don't spring) and app code not yet on springs |
| `--press-scale` | 0.95 | How far a pressed control gives |
| `--dur-celebrate` | 1400ms | How long confetti flies |

### 11.2 Rules

- **Press**: controls squish to `--press-scale` and morph their corners (§6.4) on `spatial-fast`, then spring back. Whole-card targets use `.dd-pressable` (0.98).
- **Hover** (fine pointers only): colour shifts, plus `.dd-lift` on cards (3px up and a hair of tilt). Icons in buttons nudge; the FAB's plus turns.
- **Arrive**: lists settle in one after another the first time they appear (`.dd-stagger`, 35ms apart, capped at twelve), never again when scrolling back or returning from the back stack.
- **Leave**: 160ms fade, ease-in. Exits never bounce.
- **Never loop for decoration** except the slow empty-state drift and the loading indicator.
- Never animate on scroll. Never make anyone wait for an animation to finish before they can act.
- `prefers-reduced-motion: reduce` sets every spatial spring to 0ms, effects to 100ms, removes every press scale, flourish, loop and celebration, and leaves only short opacity fades.

### 11.3 Delight and easter eggs

The package ships the toolkit; each app decides what to hide.

| Tool | What it does |
|---|---|
| `celebrate({ origin, glyphs, colours, shapes })` | Confetti in Expressive shapes and token colours, optionally mixed with the app's own glyphs (fleurons, letters, numerals; never emoji). Bursts from an element or the upper centre |
| `play(node, 'wiggle')` | One-shot flourishes: `pop`, `wiggle`, `jelly`, `tada`, `spin-once`, `flip`, `heartbeat` |
| `konami(fn)` | The Konami code on a keyboard, or up up down down left right left right and two taps on a touch screen |
| `use:secretTaps={{ count, onunlock }}` | Several quick taps on an element (usually the page title or the app's name in About) |
| `use:longPress={{ ms, onunlock }}` | Holding something down |
| `use:countUp={{ value }}` | A number that counts up on the slow spring |
| `createEggs(app, ids)` | Remembers which eggs this person has found, on this device, for "Easter egg found: 2 of 4." |

**Celebrate real accomplishments**, once each: finishing a book, a perfect score, the last step of a recipe, a trip saved, a first anything. Not routine saves, and never errors or deletions.

**Easter eggs** in every app:

- The **Konami code** does something themed to the app.
- **Tapping the page title seven times** does something else.
- At least one **contextual** egg tied to the app's subject (a search word, a special value, a date).
- The first time each is found, a celebration toast says so with the count: "Easter egg found: 1 of 3." After that it just plays.
- The About section lists how many have been found ("Easter eggs: 2 of 3 found"), never which.

**Rules for eggs**: an egg never changes, hides or deletes data, never blocks the screen for more than its animation, never fires during a step flow, and always has a text equivalent for screen readers (its toast). Under reduced motion the toast still appears and the animation doesn't.

---

## 12. Voice and copy

- **Restrained and precise.** No exclamation marks, no "Let's get started!", no marketing voice, no emoji in UI text.
- **Wry, not loud, when celebrating.** Celebration and easter-egg toasts may have a wink ("Every city deserves one perfect day.", "Yes, chef."), still in sentence case, still without exclamation marks or emoji. One sentence.
- **Ask plainly.** Step headings are questions ("When do you fly?"). Buttons are verbs ("Save city", "Delete trip").
- **Short, dignified labels.** "The Ledger", "Up next", "Past trips", "Your data".
- **Explain next to the control.** A hint under the field, not a tooltip and not a paragraph at the top of the screen.
- **Technical terms used plainly.** Respect the reader's intelligence.
- **Errors say what happened and what to do**, in one sentence: "Couldn't reach TheTVDB. Your library is unaffected; try again when you're online."
- **The italic term pattern** for footnotes is a signature touch: *Private.* Everything stays on this device.
- Use sentence case for everything except all-caps mono labels, which are set in caps by CSS. Write the source text in sentence case so translations and screen readers get real words.

---

## 13. Responsive behaviour

| Width | Behaviour |
|---|---|
| < 640px | One column. Page title 3rem, verdict 2.25rem, reduced page padding. The header may stack. Sheets for long forms. |
| 640–899px | Paired grids reflow to two columns. Page title 4rem. |
| ≥ 900px | Sheets become modals. Detail views may open beside a list. |

Lay out with `dvh` and container-relative units. Never use `100vh`, which mobile browser chrome breaks.

---

## 14. Mobile platform rules (Capacitor)

Every app ships as a Capacitor app for Android, and iOS where it has one.

- **Edge to edge.** `viewport-fit=cover`. Pad the page and fixed chrome with `env(safe-area-inset-*)`. The toast, FAB and sheets sit above the bottom inset.
- **System bars follow the theme.** Status and navigation bar icons are light in Dusk and dark in Dawn. Bars are transparent over the gradient. Update them on every `themechange`.
- **Back closes the topmost thing first**: picker, then modal, then sheet, then screen. It never exits the app from a secondary screen. Keep one overlay stack per app (Ledger's `ui.pushOverlay`). The package's own overlays (the `Select` menu and the `TimeField` clock) keep theirs: call `if (dismissOverlay()) return;` first in the back handler. Support Android's predictive back where the WebView exposes it.
- **Touch targets** are at least 44×44px, with 8px between adjacent targets.
- **No hover-only affordances.** Anything revealed on hover must also be reachable by tap and keyboard.
- **No tap highlight.** Use `-webkit-tap-highlight-color: transparent`. The press state is the `--hover-bg` wash.
- **Long press** opens selection mode in lists that support bulk edit (BookShelf). Nothing else uses long press.
- **Keyboards.** Use `inputmode` and `enterkeyhint` on every input. The focused field scrolls into view above the keyboard.
- **Launch.** The splash and launcher backgrounds use `--bg-grad-mid` for the current theme, so there is no white flash. Set `data-theme` before first paint with an inline script in `index.html`.
- **App icons** share one construction: the `--bg-grad-mid` Dusk square, a centred serif glyph or Lucide-style mark in `--accent-amber`, and a 1px amber hairline frame.


### 14.1 Links between the apps

Every app answers a URL scheme named after itself, and hands work to a sibling through that sibling's scheme. The convention is code: `src/platform/links.ts` is one file, identical in every app, that builds and reads these links and lists every action. Change it in all apps or none.

**Shape.** `<app>://<action>?<param>=<value>&…&source=<sender>`.

- The scheme is the app's name in lower case: `waymark`, `bookshelf`, `ledger`, `rosetta`, `mise`. A new app takes its own name and joins `APPS` in `links.ts`.
- The action is a lower-case verb in the host position. Parameters are URL-encoded. Dates are `YYYY-MM-DD`, fractions are `0`–`1`, countries are ISO 3166-1 alpha-2 codes.
- Every link carries `source=<sending app>`.
- Actions and parameters are only ever added, never renamed or repurposed, because an older copy of a sibling may still send the old link.

**Actions.** Each app answers `open`, which brings it to the front and does nothing else. The rest:

| Link | What the receiving app does |
|---|---|
| `waymark://open?trip=<id>` | Opens that trip, if it is on the phone |
| `waymark://import?d=<code>` | Shows the trip in a QR trip code, to import |
| `bookshelf://log?title=&author=&isbn=&finished=&progress=` | Searches for the book; the result the person picks is added as finished or in progress |
| `ledger://add?city=&region=&country=&date=` | Starts a new entry with the place and month filled in |
| `rosetta://open?id=` or `?title=` | Opens that document, if it is in the library |
| `mise://open?id=` | Opens that recipe, if it is on the phone |
| `mise://import?url=` | Reads the recipe at that page and opens the review screen; nothing is saved until the person presses *Save recipe* |

**Receiving.**

- Register the scheme on both platforms: a `VIEW` intent filter with `DEFAULT` and `BROWSABLE` categories and `<data android:scheme="<app>" />` on Android, and a `CFBundleURLTypes` entry on iOS. The main activity stays `singleTask`, so a link reaches the running app.
- Read links with `parseLink(url, '<app>')`. Handle the launch link as well as later ones (`App.getLaunchUrl` and `appUrlOpen`, or the app's own plugin event).
- **A link never changes data by itself.** Any web page or app can fire a custom scheme, so a link only opens a screen with fields filled in. The person confirms, by picking, rating or saving, as they would without the link.
- An unknown action, missing parameters, or something that is not there (an unknown trip id) falls back to `open`. Never show an error for a link.
- Links are capped at 8 KB. Anything larger travels as a file.

**Sending.**

- Build links with `buildLink(app, action, params, '<sender>')`. Never assemble the string by hand.
- Before opening, ask whether the sibling is installed (`AppLauncher.canOpenUrl`). Every app declares all its siblings' schemes, under `<queries>` on Android and `LSApplicationQueriesSchemes` on iOS, so adding a hand-off later needs no manifest change.
- When the sibling is not installed, or in the web build, fall back to the share sheet with plain text the sibling can still read ("Title by Author"), and say so in a toast.
- Files go through the share sheet or "Open with", not links.
- Name the button after the destination: "Send to BookShelf", "Log in BookShelf", "Rate in Ledger".

---

## 15. Accessibility

- Text tokens down to `--text-dim` meet 4.5:1 on every page and panel surface in both themes. Data colours and the focus ring meet 3:1. `dusk-dawn check` tests every pair, and a token change that fails the check fails the build.
- Hairline borders (`--border`) are below 3:1 by design. Controls are identified by their label and their recessed fill, not the border alone.
- Any token used as a background is paired with a named text token that contrasts in both themes: `--on-accent`, `--on-invert`, `--on-danger`.
- Every control is keyboard-operable. Switches use `role="switch"` and `aria-checked`. Tabs use `role="tablist"` and `aria-selected`. Expanding rows use `aria-expanded`.
- Focus-visible uses a 2px `--focus-ring` outline offset 2px. Never use `outline: none` on its own.
- `color-scheme` is set per theme so native scrollbars and form controls match.
- First load honours `prefers-color-scheme`. Animations honour `prefers-reduced-motion`: springs settle at once, flourishes and confetti don't play, loaders hold still (§11.2).
- A celebration or easter egg is never the only signal: its toast says it in words.
- Shape morphs change corners, never the size of a 44px target.
- Colour never carries meaning alone. Score tiers also show the tier name, and status chips also show the word.
- Respect the OS text size. Layouts must hold at 200% text without horizontal scrolling.

---

## 16. Quick-start checklist

1. Install `dusk-dawn` and import its two stylesheets (§18). Never type a colour.
2. Add the glow layer and the gradient body.
3. Use serif for display, system sans for body and system mono for data.
4. Put an all-caps tracked mono label above every field and section.
5. Use the corner scale (§6.4): pill buttons, `--corner-lg` panels, `--corner-xl` modals and sheets. Let shapes morph on press and selection.
6. Use translucent panels for content zones and rows inside them for long lists.
7. Keep accents sparse: italic words, numbers, icon tints, the one active control.
8. Allow one primary action per screen.
9. When a token is a background, use its paired `--on-*` text token.
10. For canvas and SVG, read tokens live and redraw on `themechange`.
11. `--text-dim` is the dimmest readable text. `--text-faint` is decoration.
12. Use step flows for creating, single forms for editing.
13. Use the undo toast instead of confirming, unless the action is truly irreversible.
14. Back closes the topmost overlay first.
15. Write copy like an editor, not a marketer.
16. Move on springs (§11.1), stagger lists in once, and respect reduced motion.
18. Hide at least three easter eggs and celebrate real accomplishments (§11.3).
17. Hand off to a sibling app with its `<app>://` link from `links.ts`, and let links only prefill (§14.1).

---

## 17. Changes from the original reference

**Fixes**

- Dawn `--accent-bright-hover` was written as `#c8932060` (a 38% transparent colour). It is now `#c89320`, which BookShelf already used. Waymark copied the typo.
- The secondary button's hover put `--on-accent` (`#1c1917`) on a `--text-strong` fill (`#1c1917`) in Dawn, so the text disappeared. There is now a separate `--on-invert` token, from Ledger. BookShelf has this bug today.
- The danger button's hover put near-black on Dawn red at 3.2:1. There is now a separate `--on-danger` token at 5.3:1.
- Dawn amber (`#b07d3e`, 2.9:1) and sage (`#6f8770`, 3.2:1) failed contrast as text and icons. They are deepened to `#815c2d` and `#566856` (4.5:1), and their RGB triples stay warm for glows. This follows Ledger, which had already deepened its Dawn accents.
- Dawn `--text-dim` and `--danger` were just under 4.5:1 on the gradient's bottom stop. They are nudged to `#6a6257` and `#b33528`.
- The focus ring was a grey at 50%, which fell below 3:1. It is now solid amber.

**Removed or replaced**

- The decision wheel tokens are gone, since none of the three apps has a wheel. They are generalised into `--series-*` chart tokens with the same four tints.
- `filter: blur()` on the glows is removed for performance (§4).
- Ledger's boxed tab grid becomes the tab rail. Ledger's pill badges become 2px. Ledger's overshoot toast loses its bounce.
- Modal entrance shortens from 500ms to 320ms. Half a second reads as lag on a phone.

**Added**

- A three-state theme mode (System, Dusk, Dawn), from Waymark.
- Data colours: the quality scale (Ledger tiers), chart series, map tokens (Waymark and Ledger) and the camera exemption (BookShelf).
- 2.2.0: the pet tokens, the need meter and the living-subject rule, for Nookling (removed in 3.0.0).
- `--sheet-bg`, `--success-bg`, a spacing scale and motion tokens.
- Components: tab rail, choice cards, pickers, step flow, screen header, sheet, toast and undo, notice banner, two kinds of empty state, figures, share cards and settings structure.
- Mobile platform rules (§14) and the contrast check in the build (§15).

**Added in 1.1.0 (Mise)**

- Mise joins the suite, with `mise://open` and `mise://import` (§14.1).
- The step type size for cooking mode (§5.2), the switch row from Rosetta and Colophon (§8.18), and the timer chip (§8.19), each with its class in `components.css`. `Switch` is a shared component.

**Added in 2.0.0 (Expressive)**

- Material 3 Expressive comes to the suite. The corner scale (`--corner-*`) replaces 2px corners everywhere, with shape morphing on press and selection (§6.4). `--radius` is now 12px.
- Springs (`--spring-*`), generated from damping and stiffness, replace fixed curves for everything that moves (§11.1). `dusk-dawn kotlin` writes them for Compose too.
- The emphasized type weight and display style (§5.1, §5.2).
- New shared components: `LoadingIndicator` (§8.20) and `WavyProgress` (§8.21). The connected segmented control, pill switch and theme toggle, celebration toast, and the drifting empty-state icon.
- Delight and easter eggs (§11.3): `celebrate`, `play`, `konami`, `secretTaps`, `longPress`, `countUp`, `createEggs`, the Expressive shape set (`SHAPES`, `shapeClipPath`), and `.dd-stagger`, `.dd-pressable`, `.dd-lift`.
- Principle 6 changes from "nothing bounces" to springs, and principle 8 (leave something to find) is new.

**Removed in 3.0.0**

- Colophon and Nookling leave the suite. Colophon becomes a standalone browser tool with a frozen copy of this design, and Nookling is retired. The suite is now Waymark, BookShelf, Ledger, Rosetta and Mise.
- The pet tokens (`--pet-*` and `--pet-glow-rgb`) and their contrast checks, the need meter (`.need-meter` and its parts) and the living-subject motion rule are gone. Nothing outside Nookling used them.
- `colophon` and `nookling` leave `APPS` and `LINK_ACTIONS` in `links.ts` (§14.1). Apps no longer send to them or declare their schemes.
- The shared Renovate preset (`renovate/apps.json`) is gone. Dependencies, including this package, are updated by hand.

**Fixed in 2.4.1**

- A toast's action can be tapped while a modal is open (§8.12). The modal made the toast inert, so an Undo, or BookShelf's "Share with your nookling" after finishing a book, showed but did nothing until the modal closed.

**Added in 2.4.0**

- Compact icon tabs (§8.5.2): `IconTabs` takes `labels="selected"`, icons only with the selected tab's word beside its icon.
- Each icon tab's name is its word, then its count ("Movies, 1"). The count is drawn before the word, so a screen reader used to hear "1 Movies".

**Fixed in 2.4.0**

- A modal's corner brackets stay on its frame (§8.10). They were pseudo-elements inside the scrolling card, so in a long modal the top one scrolled away and the bottom one rode over the content (BookShelf's ratings and status buttons).

**Fixed in 2.3.1**

- A `Select` field is as wide as its longest option allows, like a native select, so it never jumps when the value changes. In a narrow grid column it could shrink until its value broke mid-word (Nookling's away days).

**Added in 2.3.0**

- No control opens Android's own picker any more (§8.6). `Select` (§8.6.1) replaces `<select>` with a themed menu, `TimeField` replaces `<input type="time">` with the Waymark clock, and `.check` and `.range` draw checkboxes and sliders in the palette. `dismissOverlay()` lets Android back close them (§14).
- The theme toggle's knob is `--accent-bright` in both themes (§8.9). In Dawn it was `--accent-amber` (`#815c2d`), a dark brown under a near-black sun at 2.9:1; the icon on it is now 8.2:1. The idle icon moves from `--text-faint` to `--text-dim`.

**Added in 2.1.0**

- `--modal-bg` is opaque in both themes (`#14110e`, `#fcf8f0`). At 96–98% the library showed through modals and toasts.
- Option chips are 44px tall, the touch-target minimum (§14). They were 36px.
- Dusk map colours: land is lifted to `#332d28` off near-black water `#0e1316`, and the coast, grid and visited fill are retuned so countries read clearly. Before, land and water sat at about 1.2:1 and the teal water looked cold against the warm theme.
- Icon tabs (§8.5.1): `IconTabs`, with `.icon-tabs`, for top-level sections that share the width evenly, from Mise.
- World places (§18.4): `dusk-dawn/places` and `dusk-dawn/places/vite`, one GeoNames gazetteer of about 320,000 places that Waymark and Ledger pin on their maps instead of keeping their own city lists.

**Decided**

- Fraunces is bundled as the display serif in every app (§5.1).
- "System" is the default theme for new installs (§2).

**Source of truth**

Every value in §3, §5.1, §6 and §11 lives in `tokens.json` in the `dusk-dawn` package, the only copy. The package checks contrast and ships the generated `css/tokens.css`; apps no longer keep a `design/` folder or generate their own theme file. Edit the JSON in the package, never a generated file. §18 covers how apps use the package and how a change reaches them.

---

## 18. The shared package

Everything in this document that can be code lives in one package, **`dusk-dawn`**, in its own repository: [github.com/not-mehul/dusk-dawn](https://github.com/not-mehul/dusk-dawn). Every app installs it. No app keeps its own copy of the tokens, the fonts, the shared components or this file.

### 18.1 What the package holds

| Path | What it is |
|---|---|
| `tokens.json` | Every colour, size, shape, weight, spring, duration and font (§3, §5.1, §6, §11), and the contrast pairs (§15) |
| `css/tokens.css` | The theme file generated from `tokens.json`, with the Fraunces `@font-face` rules |
| `css/components.css` | The shared components (§4 to §11): base, glows, panels, buttons, chips, fields, select menu, time picker, checkbox, slider, segmented control, tab rail, icon tabs, modal, sheet, toast, notice, empty states, switch row, timer chip, step type, loading indicator, wavy progress, delight utilities and the Expressive motion |
| `fonts/` | Fraunces, normal and italic, with its licence (§5.1) |
| `LoadingIndicator`, `Select`, `Switch`, `TabRail`, `ThemeToggle`, `TimeField`, `Toast`, `WavyProgress` | The Svelte components every app shares (§8.20, §8.6.1, §8.18, §8.5, §8.9, §8.6, §8.12, §8.21), and `dismissOverlay` for Android back (§14) |
| `celebrate`, `play`, `konami`, `secretTaps`, `longPress`, `countUp`, `createEggs`, `shapeClipPath`, `spring` | The Expressive helpers (§6.4, §11), from `dusk-dawn` in components or `dusk-dawn/expressive` in plain modules |
| `dusk-dawn/places`, `dusk-dawn/places/vite` | The world gazetteer every app with a map uses (§18.4): about 320,000 places from GeoNames, the parser and search, and the Vite plugin that ships the file |
| `dusk-dawn` command | `check` (contrast), `colours` (no literal colours in an app), `css` and `kotlin` (theme files for other targets) |
| `style.md` | This document |

Components that depend on an app's own state, such as the modal's overlay stack, stay in the app and follow §8.

### 18.2 Adopting it in a new app

1. Install it at a tag: `npm install --save-dev github:not-mehul/dusk-dawn#v3.0.0`. Pin a tag, never a branch, so a design change reaches an app only when the app chooses to take it.
2. Import the two stylesheets first, before any of the app's own CSS:

   ```css
   @import 'dusk-dawn/tokens.css';
   @import 'dusk-dawn/components.css';
   ```

   Vite copies the fonts into the build, so there is nothing to copy by hand.
3. Use the shared components from the package rather than writing new ones:

   ```ts
   import { LoadingIndicator, Switch, TabRail, ThemeToggle, Toast, WavyProgress, celebrate, konami } from 'dusk-dawn';
   ```

4. Add both checks to the app's scripts, and make CI run them:

   ```json
   "lint": "eslint . && dusk-dawn colours",
   "check": "dusk-dawn check && npm run lint && npm run typecheck && npm test"
   ```

   `dusk-dawn colours` reads `index.html` and `src/` by default and fails on any hex, `rgb()`, `hsl()` or named colour. A generated theme file, the `theme-color` meta tag and an SVG used as a CSS mask are allowed. For anything else that must hold a literal (vendored icon markup, say), skip the file with `--skip "<regex>"` or mark the line `dusk-dawn-allow-colour` and say why.
5. Native code that needs the palette (an Android widget, a launch screen) generates it with `dusk-dawn kotlin <out.kt> --package <pkg>` instead of copying values.
6. Follow the quick-start checklist (§16) for everything else.

### 18.3 Changing the design

1. Make the change in the `dusk-dawn` repository: `tokens.json`, `css/components.css`, a shared component, or this file.
2. Run `npm run build` to regenerate `css/tokens.css`, then `npm run check`. The package's CI fails if the contrast check fails, if `css/tokens.css` is stale, or if a component fails its type check.
3. Merge, bump the version in `package.json`, and tag the release (`v2.0.0`). A new token or component is a minor version. A renamed or removed token or class is a major version.
4. In each app, move the dependency to the new tag, run its checks, and open a pull request. Apps can move one at a time.

An app never edits the package's files in `node_modules`, and never overrides a shared class with a different look. If an app needs something the package doesn't have, add it to the package so the next app gets it too.

### 18.4 World places

Any app that puts places on a map or a globe (Waymark, Ledger) reads them from one file, `dusk-dawn/places/world.txt`, rather than keeping its own list. It holds about 320,000 places from [GeoNames](https://www.geonames.org/) (CC BY 4.0), to about 110 m:

- every town of 1,000 people or more, every capital and every seat of a first- or second-level division;
- every state, province and region, and the neighbourhoods with an English Wikipedia article (Bloomsbury, Shibuya);
- landmarks, islands, mountains, lakes and falls, parks and stations with an English Wikipedia article (the Eiffel Tower, Santorini, Mount Fuji).

Each place carries its country, its region, its IANA time zone, the city a landmark or neighbourhood belongs to, and its English, old and local names, so "Bombay" finds Mumbai and "Toscana" finds Tuscany.

1. Ship the file with the Vite plugin, keeping only the kinds the app needs. Ledger keeps towns (about 3.2 MB compressed in the app); Waymark keeps everything (about 4.5 MB).

   ```ts
   import { worldPlaces } from 'dusk-dawn/places/vite';
   plugins: [worldPlaces({ fileName: 'catalog/places.txt', kinds: ['city', 'district'] })]
   ```

2. Fetch it once, off the critical path, and parse it with `parsePlacesInSlices(text)`, which works a few milliseconds at a time and hands the main thread back in between, so a phone never stutters while it loads. The result is held in columns, not a third of a million objects. (`parsePlaces(text)` does the same in one go, for tests and build scripts.)
3. Look places up with `named` (exact, for text the person typed without picking a suggestion) and `search` (prefix, for suggestions). Both put the place most people mean first: a town before a region or landmark of its size, a place's own name before a name it is also known by.
4. When nothing matches, keep the text and leave the place without a pin. An honest blank beats a confident pin in the wrong country.
5. Credit GeoNames where the app lists its sources: "Places: GeoNames (geonames.org), CC BY 4.0".

The file is rebuilt in the package with `npm run places` (it downloads about 650 MB from GeoNames once) and shipped in a minor version like any other change.
