# Releasing Colophon

Colophon ships as one HTML file, `colophon.html`, attached to each GitHub release. There is no app to sign and nothing to install. Publishing is a tag push.

## Cutting a release

```bash
git tag v1.1.0
git push origin v1.1.0
```

Or on GitHub: **Releases → Draft a new release**, type a new `vX.Y.Z` tag under *Choose a tag*, write the notes, and press **Publish release**.

Either way `.github/workflows/release.yml` sets the version from the tag (Settings → About shows it), builds the single file and attaches it to the release as `colophon.html`. A tag push with no release yet opens a **draft**; write the notes and publish it. Nothing in the repository needs bumping. The release build runs no tests, so make sure CI passed on `main` first, or run `npm run check` and `npm run test:e2e` yourself.

A failed release build is fixed on `main` and released under a new tag; re-running the old one rebuilds the broken commit.

## Building by hand

```bash
npm ci
npm run build
```

The whole tool is `dist/index.html`. Copy it anywhere, rename it if you like, and open it in a browser. It can also be hosted as-is on any static host.

## Where your editions live

The bench is kept in the browser's storage (IndexedDB) for the page's origin. A copy opened from disk shares that storage with other local files in the same browser; a copy opened from a website keeps its own. Moving to a new file name or a new browser starts with an empty bench, so bind and download anything you want to keep first.

## The old Android and iOS apps

Releases up to v1.0.4 were Android APKs. They keep working on the phone they are installed on but get no updates. The `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD` repository secrets are no longer used and can be deleted under **Settings → Secrets and variables → Actions**. Keep a copy of the signing key itself if you might ever build an APK again.
