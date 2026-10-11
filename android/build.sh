#!/usr/bin/env bash
# Builds and signs the Android app with the plain SDK tools (no Gradle).
# Runs on GitHub Actions (.github/workflows/android.yml); output: android/build/captain-ayman.apk
set -euo pipefail
cd "$(dirname "$0")"

API=34
BUILD_TOOLS=34.0.0
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?Android SDK not found}}"
# (`yes` stops with SIGPIPE when sdkmanager is done — that's fine.)
{ yes 2> /dev/null || true; } | "$SDK/cmdline-tools/latest/bin/sdkmanager" "platforms;android-$API" "build-tools;$BUILD_TOOLS" > /dev/null
BT="$SDK/build-tools/$BUILD_TOOLS"
JAR="$SDK/platforms/android-$API/android.jar"
read -r VERSION_CODE VERSION_NAME < VERSION
PASS="$(cat signing/password.txt)"

# The live site by default; the emulator test (android-test.yml) builds against a local server instead.
APP_BASE="${APP_BASE:-https://captain-ayman.vercel.app/}"
APP_DEBUG="${APP_DEBUG:-false}"
APK_NAME="${APK_NAME:-captain-ayman.apk}"

rm -rf build && mkdir -p build/gen/com/captainayman/app build/classes build/dex
cat > build/gen/com/captainayman/app/Config.java << JAVA
package com.captainayman.app;

final class Config {
    static final String BASE = "$APP_BASE";
    static final boolean DEBUG = $APP_DEBUG;

    private Config() {}
}
JAVA
cp AndroidManifest.xml build/AndroidManifest.xml
case "$APP_BASE" in http://*) sed -i 's/usesCleartextTraffic="false"/usesCleartextTraffic="true"/' build/AndroidManifest.xml ;; esac

"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk -I "$JAR" --manifest build/AndroidManifest.xml -R build/res.zip --java build/gen \
  --min-sdk-version 24 --target-sdk-version "$API" --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" --auto-add-overlay
javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 -bootclasspath "$JAR" -d build/classes $(find src build/gen -name '*.java')
"$BT/d8" --release --min-api 24 --lib "$JAR" --output build/dex $(find build/classes -name '*.class')
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -p -f 4 build/unsigned.apk build/aligned.apk
"$BT/apksigner" sign --ks signing/release.jks --ks-key-alias captainayman --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "build/$APK_NAME" build/aligned.apk
"$BT/apksigner" verify --print-certs "build/$APK_NAME" | grep -E "SHA-256|Signer"
"$BT/aapt2" dump badging "build/$APK_NAME" | head -3
ls -l "build/$APK_NAME"
