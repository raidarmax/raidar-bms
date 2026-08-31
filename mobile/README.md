# BMS Police Mobile

Standalone React Native mobile app for Kenya Police officers. No Expo dependency — builds directly to a self-contained APK.

## Features

- Officer sign-in with bcrypt authentication and account lockout
- Dashboard with live KPI counters (active cases, fines, verifications)
- Bottom tab navigation: Home, Incidents, Scan, Fines, More
- QR code / manual lookup for rider BMS IDs, motorcycle plates, and case numbers
- Full incident case management (list, detail, notes, evidence, resolution)
- Fine management (list, detail, issue fine with offense categories)
- Unified search across riders, motorcycles, and owners
- Document verification (National ID, Driving License, KRA PIN, Insurance)
- Station officers directory (admin only)
- Activity log timeline
- Officer profile with password change
- All actions are audit-logged to Supabase

## Setup

```bash
cd mobile
npm install
```

## Running (Debug)

```bash
# Android
npx react-native run-android

# iOS (requires a Mac with Xcode — see BUILDING_IOS.md the first time)
npx react-native run-ios
```

## Building Release APK

```bash
cd android
./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

## Building for iOS

The `ios/` folder is generated on demand on a Mac. See
[BUILDING_IOS.md](./BUILDING_IOS.md) for the full walk-through. Short
version:

```bash
cd mobile
npm install
bash scripts/setup-ios.sh          # one-time scaffold + pod install
open ios/BmsPolice.xcworkspace     # sign & Run on a tethered iPhone
```

## App Icon

The icon is at `assets/icon.png` (1024x1024). It features a motorcycle on a dark navy shield background, representing the Boda-Boda Management System enforcement mission.

## Project Structure

```
mobile/
├── App.tsx                    # Root component
├── index.ts                   # App registration (BMSPolice)
├── assets/
│   └── icon.png               # App icon (1024x1024)
├── src/
│   ├── context/               # Auth provider
│   ├── components/
│   │   ├── ui/                # Shared design system (Button, Card, Badge, etc.)
│   │   └── navigation/        # Tab icons
│   ├── navigation/            # Bottom tabs + stack navigators
│   ├── screens/
│   │   ├── auth/              # Login
│   │   ├── dashboard/         # Home with KPIs
│   │   ├── incidents/         # List + Detail
│   │   ├── fines/             # List + Detail + Issue
│   │   ├── scan/              # QR scanner + results
│   │   └── more/              # Menu, Search, Verify, Officers, Activity, Profile
│   ├── services/              # Supabase client, auth, lookup, QR parser
│   └── theme/                 # Colors, typography, spacing
└── android/                   # Native Android project (generate with react-native init)
```

## Tech Stack

- React Native 0.74 (no Expo)
- React Navigation 6 (bottom tabs + native stacks)
- Supabase JS client
- bcryptjs for password verification
- AsyncStorage for session persistence
- Dark theme optimized for field use
