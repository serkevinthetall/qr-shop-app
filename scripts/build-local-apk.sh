#!/usr/bin/env bash
# Reliable local APK build for QR Shop (long-term helper).
# Always sets Android Studio JDK so Gradle does not fail with "Unable to locate a Java Runtime".
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:$PATH"

# Skip flaky doctor step; continue build even if packages are slightly out of date.
export EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP=1

# Keep EAS temp dir between runs when debugging (optional speed on retries).
# export EAS_LOCAL_BUILD_SKIP_CLEANUP=1

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "Java not found at: $JAVA_HOME"
  echo "Install Android Studio or set JAVA_HOME to a JDK 17+."
  exit 1
fi

echo "Using JAVA_HOME=$JAVA_HOME"
"$JAVA_HOME/bin/java" -version

# Profile env in eas.json already sets primary + Netlify fallback for local-apk.
exec eas build --local --platform android --profile local-apk --non-interactive "$@"
