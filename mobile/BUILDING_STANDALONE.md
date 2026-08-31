# Building a Standalone APK (No Expo Go)

The `mobile/` app is bare React Native 0.74.5 — it does NOT use Expo. You build it with the standard Android toolchain and get a self-contained APK that you install directly.

## 1. One-time machine setup (Mac / Linux / Windows)

Install these globally on the machine that will produce the APK:

- **JDK 17** — required by Android Gradle Plugin 8.
  - Mac: `brew install --cask temurin@17`
  - Ubuntu: `sudo apt install openjdk-17-jdk`
  - Windows: install Temurin JDK 17 from Adoptium.
- **Android Studio** (only for the SDK) — install from https://developer.android.com/studio.
- After first launch, use SDK Manager to install:
  - **Android SDK Platform 34**
  - **Android SDK Build-Tools 34.0.0**
  - **Android SDK Platform-Tools**
  - **NDK 26.1.10909125** (SDK Manager -> SDK Tools -> "Show Package Details")
- Add these environment variables (adapt paths to your machine):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk        # Mac default
# export ANDROID_HOME=$HOME/Android/Sdk              # Linux default
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

- **Node 18 or 20** and **npm** (or **yarn**).

## 2. Generate the Gradle wrapper

The repository ships `settings.gradle`, `build.gradle`, and the `gradle.properties` but not the `gradlew` binary (git-unfriendly). Generate it once locally:

```bash
cd mobile/android
gradle wrapper --gradle-version 8.6
```

If you don't have `gradle` installed, `brew install gradle` on Mac or download it from https://gradle.org/releases/. This step creates `gradlew`, `gradlew.bat`, and `gradle/wrapper/gradle-wrapper.jar`.

## 3. Generate the debug keystore

Only needed once. Debug builds are signed with this key.

```bash
cd mobile/android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore debug.keystore \
  -alias androiddebugkey \
  -storepass android -keypass android \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Android Debug,O=Android,C=US"
```

## 4. Install JS dependencies

```bash
cd mobile
npm install
```

## 5. Build a debug APK (fast, unsigned-for-store, installable)

```bash
cd mobile/android
./gradlew assembleDebug
```

The APK appears at:

```
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Copy it to your phone (USB, email, drive) and install it. The app is self-contained — Metro is only needed for hot reload during development.

## 6. Build a release APK

By default the release build in `app/build.gradle` is signed with the debug keystore so you can produce an installable APK without setting up a real signing key yet:

```bash
cd mobile/android
./gradlew assembleRelease
```

Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`

### Producing a real signed release APK (for distribution)

Generate a proper release keystore (do this once and back it up safely — losing it means you can never update the app):

```bash
cd mobile/android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore release.keystore \
  -alias bmspolice \
  -keyalg RSA -keysize 2048 -validity 10000
```

Edit `mobile/android/app/build.gradle` and change the `release` signingConfig:

```gradle
signingConfigs {
    release {
        storeFile file('release.keystore')
        storePassword 'YOUR_KEYSTORE_PASSWORD'
        keyAlias 'bmspolice'
        keyPassword 'YOUR_KEY_PASSWORD'
    }
}
```

(For anything past a demo, load these from `~/.gradle/gradle.properties` instead of hardcoding.)

Rebuild:

```bash
./gradlew clean assembleRelease
```

## 7. Install to a connected device

```bash
adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
```

## 8. iOS (optional)

The `mobile/ios/` folder is not scaffolded in this repo. If you need an iOS build, run once on a Mac:

```bash
cd mobile
npx react-native-community/cli init IosScaffold --version 0.74.5 --skip-install
cp -R IosScaffold/ios ./
rm -rf IosScaffold
cd ios && pod install
```

Then open `mobile/ios/BmsPolice.xcworkspace` in Xcode, set your Team and bundle identifier under Signing & Capabilities, and Archive -> Distribute App.

## Troubleshooting

- **`SDK location not found`** — create `mobile/android/local.properties` with:
  ```
  sdk.dir=/Users/<you>/Library/Android/sdk
  ```
- **`Could not find :hermes-engine:`** — run `cd mobile && npm install` again; the hermes prebuilt is bundled inside `node_modules/react-native`.
- **`Task :app:mergeReleaseResources` fails on the icon** — the placeholder launcher icon at `res/drawable/ic_launcher_foreground.xml` is a plain vector. Replace it with your own artwork before shipping.
- **App crashes on launch with "Unable to load script from assets 'index.android.bundle'"** — you're running a release build without a bundle. The Gradle plugin generates it automatically as part of `assembleRelease`; if you built with `assembleDebug` and no Metro server is reachable, use `assembleRelease` instead.
- **First build is slow** — Gradle downloads ~1 GB of dependencies the first time. Later builds are cached.
