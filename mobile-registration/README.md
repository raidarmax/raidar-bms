# BMS Field Registration App

A standalone Android app for field agents to register motorcycle owners by scanning tracker barcodes. This app is separate from the BMS Police app.

## Features

- Barcode scanning using the phone camera (VisionCamera)
- Owner details entry (name, phone, national ID, plate number)
- Automatic duplicate detection (adds bike to existing account)
- OTP phone verification for new accounts
- Registers motorcycle + links tracking device in one step
- Dark theme optimized for outdoor field use

## Prerequisites

On your build machine:

- **JDK 17** (e.g. Temurin from Adoptium)
- **Android Studio** with SDK Platform 34, Build-Tools 34, NDK 26.1
- **Node 18 or 20** with npm

Set these environment variables:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk   # Mac
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

## Setup

```bash
cd mobile-registration
npm install
```

## Generate Gradle Wrapper (one time)

```bash
cd android
gradle wrapper --gradle-version 8.6
```

## Generate Debug Keystore (one time)

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore debug.keystore \
  -alias androiddebugkey \
  -storepass android -keypass android \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Android Debug,O=Android,C=US"
```

## Build APK

### Debug build:
```bash
cd android
./gradlew assembleDebug
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release build:
```bash
cd android
./gradlew assembleRelease
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

## Install on Phone

Transfer the APK to your phone and open it, or use ADB:
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Enable "Install from unknown sources" in your phone settings if prompted.

## Project Structure

```
mobile-registration/
├── App.tsx                    # Root navigation
├── index.ts                   # App registration (BMSRegister)
├── src/
│   ├── screens/
│   │   ├── ScanScreen.tsx     # Camera barcode scanner
│   │   ├── DetailsScreen.tsx  # Owner & bike form
│   │   ├── OtpScreen.tsx      # Phone verification
│   │   ├── DuplicateScreen.tsx# Existing owner handling
│   │   └── SuccessScreen.tsx  # Confirmation
│   ├── services/
│   │   ├── supabase.ts        # Supabase client
│   │   ├── otp.ts             # OTP send/verify
│   │   └── registration.ts   # Create owner + motorcycle + link device
│   └── theme/
│       └── index.ts           # Colors, spacing, typography
└── android/                   # Native Android project
```

## Permissions

The app requires:
- **Camera** — for barcode scanning
- **Internet** — to communicate with the backend

## Troubleshooting

- **Camera not working**: Make sure you granted camera permission when the app asked. You can reset it in Android Settings > Apps > BMS Register > Permissions.
- **"SDK location not found"**: Create `android/local.properties` with `sdk.dir=/path/to/Android/sdk`
- **Slow first build**: Normal — Gradle downloads ~1 GB of dependencies on first run.
