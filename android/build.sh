#!/usr/bin/env bash
# Builds and signs the Android app with the plain SDK tools (no Gradle).
# Runs on GitHub Actions (.github/workflows/android.yml); output: android/build/captain-ayman.apk
set -euo pipefail
cd "$(dirname "$0")"

API=34
BUILD_TOOLS=34.0.0
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?Android SDK not found}}"
yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" "platforms;android-$API" "build-tools;$BUILD_TOOLS" > /dev/null
BT="$SDK/build-tools/$BUILD_TOOLS"
JAR="$SDK/platforms/android-$API/android.jar"
read -r VERSION_CODE VERSION_NAME < VERSION
PASS="$(cat signing/password.txt)"

rm -rf build && mkdir -p build/gen build/classes build/dex
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk -I "$JAR" --manifest AndroidManifest.xml -R build/res.zip --java build/gen \
  --min-sdk-version 24 --target-sdk-version "$API" --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" --auto-add-overlay
javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 -bootclasspath "$JAR" -d build/classes $(find src build/gen -name '*.java')
"$BT/d8" --release --min-api 24 --lib "$JAR" --output build/dex $(find build/classes -name '*.class')
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -p -f 4 build/unsigned.apk build/aligned.apk
"$BT/apksigner" sign --ks signing/release.jks --ks-key-alias captainayman --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out build/captain-ayman.apk build/aligned.apk
"$BT/apksigner" verify --print-certs build/captain-ayman.apk | grep -E "SHA-256|Signer"
"$BT/aapt2" dump badging build/captain-ayman.apk | head -3
ls -l build/captain-ayman.apk
