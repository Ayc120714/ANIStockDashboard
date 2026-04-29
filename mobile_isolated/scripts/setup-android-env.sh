#!/usr/bin/env bash
set -euo pipefail

echo "Checking Android build prerequisites..."

if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: Java 17+ not found. Install OpenJDK 17 and set JAVA_HOME."
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb not found. Install Android SDK platform-tools and add to PATH."
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ERROR: ANDROID_HOME is not set."
  echo "Example: export ANDROID_HOME=\$HOME/Android/Sdk"
  exit 1
fi

echo "Java version:"
java -version
echo "adb version:"
adb --version
echo "ANDROID_HOME=${ANDROID_HOME}"
echo "Android prerequisites look good."
