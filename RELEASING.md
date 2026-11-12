# Releasing Colophon

Colophon ships as an APK you sideload; there is no Play listing. Publishing is a tag push.

---

## The signing key

An Android APK must be signed to install, and every later version must be
signed by **the same key**, or the phone refuses the upgrade. Losing the key
means every install has to be uninstalled and reinstalled from scratch, which
wipes its saved editions. Make it once and keep it somewhere you will still have it in
five years.

This makes the key with OpenSSL, as a PKCS#12 file that Gradle and Android's
signing tools read directly (no Java needed). It works the same in Termux on
Android (`pkg install openssl`) as on a computer:

```bash
openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -noenc \
  -keyout colophon.key -out colophon.crt -subj "/CN=Colophon"
openssl pkcs12 -export -inkey colophon.key -in colophon.crt -name colophon -out colophon.p12
rm colophon.key colophon.crt
```

The second command asks for a password twice. Keep it: in a PKCS#12 file it is
both the keystore password and the key password. `-name colophon` is the key alias.
`*.p12`, `*.jks`, `*.keystore` and `keystore.properties` are in `.gitignore`; do
not take them out.

(`keytool -genkeypair -keystore colophon.jks -alias colophon -keyalg RSA -keysize 4096
-validity 10000` makes an equivalent key if you have a JDK.)

---

## Building in CI (the usual path)

Add four repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | What goes in it |
| --- | --- |
| `KEYSTORE_BASE64` | `base64 -w0 colophon.p12`, the whole keystore on one line |
| `KEYSTORE_PASSWORD` | the keystore password |
| `KEY_ALIAS` | `colophon`, the `-name` (or `-alias`) you used |
| `KEY_PASSWORD` | the key password (for a `.p12`, the same as the keystore's) |

Then tag and push:

```bash
git tag v1.0.0
git push origin v1.0.0
```

`.github/workflows/release.yml` builds the page and the signed release APK around
it, and opens a **draft** GitHub release with the APK attached. Write the notes and
press publish. It runs no tests (the build's type check is the only gate), so run
`npm run check` yourself before tagging when a change deserves it.

You can also start on GitHub instead: **Releases → Draft a new release**, type a
new `vX.Y.Z` tag under *Choose a tag*, write the notes, and press **Publish
release**. Publishing creates the tag and runs the same workflow, which adds the
APK to that release a few minutes later and leaves your notes alone. Saving it as
a draft starts nothing (GitHub runs no workflows for drafts), so publish it.

If the signing secrets are missing or wrong, the run fails: there is no unsigned
build to download by mistake.

---

## Building on your own machine

Copy `android/keystore.properties.example` to `android/keystore.properties`
(never committed) and fill it in. `storeFile` is relative to `android/`; an
absolute path works too. Then:

```bash
npm ci
npm run check
npm version --no-git-tag-version 1.0.0   # matches the APK; leave it uncommitted
npm run sync
cd android && ./gradlew -PcolophonVersion=1.0.0 assembleRelease
# app/build/outputs/apk/release/app-release.apk
```

Without a keystore the release build still runs, but the APK is unsigned and no
phone will install it.

---

## Version numbers

Both come from the tag; there is nothing in the source to bump.

- `versionName` is what a person reads, in Android's app info. A `v1.2.3` tag builds `1.2.3`.
- `versionCode` is what Android compares, and it must rise with every release.
  It is major × 10 000 + minor × 100 + patch, so `1.2.3` is `10203`, which keeps
  rising while minor and patch stay under 100.

Tags must be `vMAJOR.MINOR.PATCH`. A local build without `-PcolophonVersion` is `3.0.0`, the last version shipped by hand.
