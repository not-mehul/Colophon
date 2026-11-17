# Editorial Dusk & Dawn, frozen for Colophon

This is a copy of the [`dusk-dawn`](https://github.com/not-mehul/dusk-dawn) design package at 3.0.0, without the world places gazetteer. Colophon left the Dusk & Dawn suite when it became a standalone browser tool, so it keeps its own copy and no longer follows changes to the package.

Colophon installs it as `"dusk-dawn": "file:vendor/dusk-dawn"`, so imports (`dusk-dawn`, `dusk-dawn/expressive`, `dusk-dawn/tokens.css`) and the `dusk-dawn check` and `dusk-dawn colours` commands work as before. `style.md` is the design spec as it stood. Changes to Colophon's look are made here, by hand; after editing `tokens.json`, run `node vendor/dusk-dawn/bin/dusk-dawn.mjs build` to regenerate `css/tokens.css`.

Fraunces is under the SIL Open Font License (`fonts/Fraunces-OFL.txt`). The package is MIT, by Mehul Sen.
