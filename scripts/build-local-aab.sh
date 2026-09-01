#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-https://qr-shop-app-backend.vercel.app}"
export ORG_GRADLE_JVMARGS="${ORG_GRADLE_JVMARGS:--Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8}"

KEYSTORE_PROPS="$ROOT/android/keystore.properties"
if [[ ! -f "$KEYSTORE_PROPS" ]]; then
  echo "Missing $KEYSTORE_PROPS"
  echo ""
  echo "Play Store needs your EAS release keystore, not the debug key."
  echo "1. Run: eas credentials -p android"
  echo "2. Keystore → Download (note password + alias)"
  echo "3. Copy android/keystore.properties.example → android/keystore.properties"
  echo "4. Fill in storePassword, keyAlias, keyPassword"
  exit 1
fi

cd "$ROOT/android"
./gradlew :app:bundleRelease \
  -x lint \
  -x lintVitalAnalyzeRelease \
  -x lintVitalReportRelease \
  -x lintVitalRelease

echo ""
echo "AAB built: $ROOT/android/app/build/outputs/bundle/release/app-release.aab"
