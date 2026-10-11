# App signing key — keep this repository private

`release.jks` signs every version of the Android app. Phones only accept an update signed with the
same key, so never delete or replace it (a new key = every client must uninstall and reinstall).
Its fingerprint is published in `public/.well-known/assetlinks.json` so site links open in the app.
