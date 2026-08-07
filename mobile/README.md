# Raidar Police Mobile

Native mobile companion to the Raidar web console. Built with Expo + React Native, targeting iOS and
Android. Officers get a field-ready toolkit for QR verification, document validation, incident
review, and fines issuance. The app reuses the existing Supabase project — no separate backend.

## Feature scope

- Officer sign-in against the `police_officers` table (bcrypt hash) with lockout enforcement
- Persistent session in `expo-secure-store`
- Dashboard with live counters for incidents, fines today, and verifications today
- Camera-based QR scanner (`expo-camera`) with intelligent payload parsing
  - BMS rider IDs (`BMS-YYYY-NNNNN`)
  - Motorcycle plates
  - Case references (`CASE-YYYY-N`)
  - JSON payloads and rider portal URLs
- Verify result screen showing license, insurance, inspection, compliance chips, outstanding fines,
  assigned bike, and owner
- Manual lookup for cases where the QR is unreadable
- Document validation flow: capture from camera or upload a file, run through the existing
  `verify-documents` edge function, and display extracted fields + field-level markers
- Incidents and fines lists scoped to the officer's station
- Global search across riders and motorcycles
- Every scan, lookup and validation is written to `police_verification_logs` and
  `police_activity_logs`, matching the web audit trail

## Getting started

```bash
cd mobile
npm install
npx expo start
```

Then scan the QR code with the Expo Go app, or press `i` / `a` to open on iOS / Android simulators.
Supabase credentials are baked into `app.json > expo.extra`; production builds should switch to EAS
secrets or a `.env` loaded via `expo-constants`.

## Building for distribution

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios
eas build --profile development --platform android
```

Set up EAS build profiles in `eas.json` (not included) for internal, staging and production tracks.

## Files

- `App.tsx` — root component wiring providers + navigation
- `src/navigation/AppNavigator.tsx` — auth gate + stack navigator
- `src/context/AuthContext.tsx` — session provider using Supabase + SecureStore
- `src/lib/supabase.ts` — Supabase client (AsyncStorage) and domain types
- `src/lib/policeAuth.ts` — bcrypt login, lockout, activity + verification logging
- `src/lib/qrParser.ts` — QR payload disambiguation
- `src/lib/lookup.ts` — rider / motorcycle / incident lookups and compliance derivation
- `src/lib/documentValidation.ts` — calls the shared `verify-documents` edge function
- `src/screens/*` — Login, Dashboard, Scan, VerifyResult, DocumentValidation, ManualLookup,
  Incidents, Fines, Search

## What's next (not yet built)

- Officer profile screen with password change and photo upload
- Fine issuance flow with SMS dispatch via `send-fine-sms`
- Biometric unlock on cold start (`expo-local-authentication`)
- Offline queueing of verifications and fines (`expo-sqlite`)
- Push notifications for new incidents assigned to the station
- Officers management for station admins

The scaffolding, types, RLS-compatible queries, and audit logging patterns are already in place, so
these can be layered on incrementally without backend changes.
