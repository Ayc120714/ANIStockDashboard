#!/usr/bin/env bash
# Regenerate Android launcher/splash assets from the website logo (public/ayc-logo.png).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_LOGO="${WEB_LOGO:-$ROOT/../public/ayc-logo.png}"
ANDROID_RES="$ROOT/android/app/src/main/res"
ASSETS="$ROOT/src/assets"
BG="#060b19"

if [[ ! -f "$WEB_LOGO" ]]; then
  echo "ERROR: Website logo not found at $WEB_LOGO"
  exit 1
fi

command -v convert >/dev/null || { echo "ERROR: ImageMagick (convert) required"; exit 1; }

echo "Source logo: $WEB_LOGO"

mkdir -p "$ASSETS" "$ANDROID_RES/drawable-nodpi"

# In-app React Native screens
cp -f "$WEB_LOGO" "$ASSETS/ayc-logo.png"

# Splash / wide variants (transparent PNG, same artwork as website)
convert "$WEB_LOGO" -resize 560x -background none -gravity center -extent 560x94 \
  "$ASSETS/ayc-logo-splash.png"
cp -f "$ASSETS/ayc-logo-splash.png" "$ANDROID_RES/drawable-nodpi/splash_logo.png"

convert "$WEB_LOGO" -resize 343x -background none -gravity center -extent 343x73 \
  "$ASSETS/ayc-logo-wide.png"

# Adaptive icon foreground (432×432). Wide wordmark needs ~40% width for OEM squircle masks.
ADAPTIVE_SIZE=432
ADAPTIVE_LOGO_W=$((ADAPTIVE_SIZE * 40 / 100))
convert -size "${ADAPTIVE_SIZE}x${ADAPTIVE_SIZE}" xc:none \
  \( "$WEB_LOGO" -resize "${ADAPTIVE_LOGO_W}x" -background none \) \
  -gravity center -composite \
  "$ANDROID_RES/drawable-nodpi/ic_launcher_foreground.png"

# Square launcher icons per density (dark brand background like website header)
render_launcher() {
  local size="$1"
  local out="$2"
  local logo_w=$((size * 42 / 100))
  convert -size "${size}x${size}" "xc:${BG}" \
    \( "$WEB_LOGO" -resize "${logo_w}x" -background none \) \
    -gravity center -composite \
    "$out"
}

render_launcher 48 "$ANDROID_RES/mipmap-mdpi/ic_launcher.png"
render_launcher 48 "$ANDROID_RES/mipmap-mdpi/ic_launcher_round.png"
render_launcher 72 "$ANDROID_RES/mipmap-hdpi/ic_launcher.png"
render_launcher 72 "$ANDROID_RES/mipmap-hdpi/ic_launcher_round.png"
render_launcher 96 "$ANDROID_RES/mipmap-xhdpi/ic_launcher.png"
render_launcher 96 "$ANDROID_RES/mipmap-xhdpi/ic_launcher_round.png"
render_launcher 144 "$ANDROID_RES/mipmap-xxhdpi/ic_launcher.png"
render_launcher 144 "$ANDROID_RES/mipmap-xxhdpi/ic_launcher_round.png"
render_launcher 192 "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher.png"
render_launcher 192 "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher_round.png"
convert -size 192x192 "xc:${BG}" "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher_background.png"

echo "Synced mobile brand assets from website logo."
