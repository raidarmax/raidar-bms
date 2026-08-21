#!/usr/bin/env bash
#
# Scaffold mobile/ios/ for the BMS Police React Native 0.74.5 project.
#
# Run this ONCE on a Mac from the mobile/ folder:
#     bash scripts/setup-ios.sh
#
# It generates a fresh iOS project via the community CLI, copies it into
# mobile/ios/, patches the bundle identifier, display name, JS entry name
# and permission strings, then runs `pod install`.
#
# Safe to re-run: if mobile/ios/ already exists the script refuses to
# overwrite unless you pass --force.

set -euo pipefail

# ---------------------------------------------------------------- config
APP_NAME="BmsPolice"
DISPLAY_NAME="BMS Police"
BUNDLE_ID="com.bmspolice"
RN_VERSION="0.74.5"

# --------------------------------------------------------------- helpers
die()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }

MOBILE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$MOBILE_DIR"

FORCE=0
if [[ "${1:-}" == "--force" ]]; then FORCE=1; fi

# ------------------------------------------------------------ pre-flight
[[ "$(uname -s)" == "Darwin" ]] || die "iOS build tooling is macOS-only. Run this on a Mac."
command -v xcodebuild >/dev/null || die "Xcode Command Line Tools missing. Install Xcode from the App Store, then run: xcode-select --install"
command -v pod        >/dev/null || die "CocoaPods missing. Install with: sudo gem install cocoapods  (or: brew install cocoapods)"
command -v node       >/dev/null || die "Node.js is not on PATH."
command -v npx        >/dev/null || die "npx is not on PATH."

if [[ -d "ios" && $FORCE -ne 1 ]]; then
  die "mobile/ios already exists. Re-run with --force to overwrite (this deletes mobile/ios first)."
fi

# ------------------------------------------------------- install js deps
if [[ ! -d node_modules ]]; then
  info "Installing JS dependencies (npm install)..."
  npm install
fi

# ---------------------------------------------------- scaffold from init
TMP_DIR="$(mktemp -d -t bms-ios-scaffold-XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

info "Scaffolding a temp React Native $RN_VERSION project (this takes a minute)..."
(
  cd "$TMP_DIR"
  npx --yes @react-native-community/cli@14.0.0 init "$APP_NAME" \
    --version "$RN_VERSION" \
    --skip-install \
    --install-pods false \
    --pm npm
)

SCAFFOLD_IOS="$TMP_DIR/$APP_NAME/ios"
[[ -d "$SCAFFOLD_IOS" ]] || die "Scaffolding did not produce an ios folder (checked $SCAFFOLD_IOS)."

# ---------------------------------------------------------- copy it over
if [[ -d "ios" ]]; then
  info "Removing existing mobile/ios (--force)..."
  rm -rf ios
fi
info "Copying generated ios/ into mobile/ios/..."
cp -R "$SCAFFOLD_IOS" ios

# --------------------------------- patch bundle id + display name + perms
info "Patching bundle identifier -> $BUNDLE_ID"
# The default project.pbxproj carries an org.reactjs.native.example prefix on
# PRODUCT_BUNDLE_IDENTIFIER. Replace with our real ID.
/usr/bin/sed -i '' \
  "s|PRODUCT_BUNDLE_IDENTIFIER = org\\.reactjs\\.native\\.example\\.\\$(PRODUCT_NAME:rfc1034identifier);|PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE_ID};|g" \
  "ios/$APP_NAME.xcodeproj/project.pbxproj"

INFO_PLIST="ios/$APP_NAME/Info.plist"

info "Patching Info.plist display name and permission strings"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName '$DISPLAY_NAME'" "$INFO_PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string '$DISPLAY_NAME'" "$INFO_PLIST"

add_string() {
  local key="$1" value="$2"
  /usr/libexec/PlistBuddy -c "Delete :$key"           "$INFO_PLIST" >/dev/null 2>&1 || true
  /usr/libexec/PlistBuddy -c "Add :$key string '$value'" "$INFO_PLIST"
}

add_string NSCameraUsageDescription        "BMS Police uses the camera to scan QR codes on bikes and capture evidence photos."
add_string NSPhotoLibraryUsageDescription  "BMS Police attaches photos from your library to incident reports."
add_string NSPhotoLibraryAddUsageDescription "BMS Police saves captured evidence to your photo library."
add_string NSMicrophoneUsageDescription    "BMS Police records audio evidence for incidents."
add_string NSLocationWhenInUseUsageDescription "BMS Police uses your location to show you on the map while on duty."
add_string NSFaceIDUsageDescription        "BMS Police uses Face ID to protect your officer session."

# Register vector-icons fonts. Actual font files are copied by CocoaPods
# via the react-native-vector-icons podspec once `pod install` runs.
info "Registering vector-icons fonts in Info.plist"
/usr/libexec/PlistBuddy -c "Delete :UIAppFonts" "$INFO_PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :UIAppFonts array" "$INFO_PLIST"
for FONT in \
  AntDesign.ttf \
  Entypo.ttf \
  EvilIcons.ttf \
  Feather.ttf \
  FontAwesome.ttf \
  FontAwesome5_Brands.ttf \
  FontAwesome5_Regular.ttf \
  FontAwesome5_Solid.ttf \
  FontAwesome6_Brands.ttf \
  FontAwesome6_Regular.ttf \
  FontAwesome6_Solid.ttf \
  Fontisto.ttf \
  Foundation.ttf \
  Ionicons.ttf \
  MaterialCommunityIcons.ttf \
  MaterialIcons.ttf \
  Octicons.ttf \
  SimpleLineIcons.ttf \
  Zocial.ttf
do
  /usr/libexec/PlistBuddy -c "Add :UIAppFonts: string $FONT" "$INFO_PLIST"
done

# Metro on device: allow Bonjour so the phone can discover the packager on
# the same Wi-Fi as the Mac during development.
/usr/libexec/PlistBuddy -c "Delete :NSBonjourServices" "$INFO_PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :NSBonjourServices array" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :NSBonjourServices: string _rnpackager._tcp" "$INFO_PLIST"

# Allow arbitrary HTTP loads only in DEBUG (Metro talks HTTP). Release
# builds keep ATS enabled.
/usr/libexec/PlistBuddy -c "Delete :NSAppTransportSecurity" "$INFO_PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" "$INFO_PLIST"

# ------------------- align the RN AppRegistry name (index.ts registers "BmsPolice")
# The scaffold generates AppDelegate.mm with `moduleName:@"BmsPolice"` and
# an Xcode target called BmsPolice, so this already matches mobile/index.ts.

# ------------------------------------------------------------- pod install
info "Running pod install..."
(
  cd ios
  # RN 0.74 needs pod repo updated occasionally; the CLI init already ran
  # `bundle install` in some setups, but we intentionally skipped that.
  pod install
)

info "Done."
cat <<EOF

Next steps on this Mac:

  1. open mobile/ios/${APP_NAME}.xcworkspace
  2. In Xcode, pick the "${APP_NAME}" scheme, select your iPhone as the run destination.
  3. Target -> Signing & Capabilities -> tick "Automatically manage signing"
     and choose your Apple ID team. (Free Apple ID = 7-day builds; paid
     Developer Program = 1-year builds, TestFlight, App Store.)
  4. Plug the iPhone in, unlock it, tap "Trust this computer".
  5. Press the Run button (or Cmd+R).
  6. On the iPhone: Settings > General > VPN & Device Management > tap your
     Apple ID and choose "Trust". The BMS Police app will now open.

If Metro can't reach the phone, either keep the Mac + phone on the same
Wi-Fi (Bonjour), or run: adb reverse tcp:8081 tcp:8081 (Android only).

EOF
