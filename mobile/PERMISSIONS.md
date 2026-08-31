# Native Permissions

## Camera (required for QR scanner)

`react-native-vision-camera` reads the camera. Without the OS-level permission
declaration below, Android will not list "Camera" in the app's permission
settings and `Camera.requestCameraPermission()` will fail silently.

### Android — `android/app/src/main/AndroidManifest.xml`

Add this line **before** the `<application>` tag (see the reference file at
`mobile/android/app/src/main/AndroidManifest.xml`):

```xml
<uses-permission android:name="android.permission.CAMERA" />

<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
<uses-feature android:name="android.hardware.camera.flash" android:required="false" />
```

After editing the manifest, do a clean rebuild:

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

The first time the scanner opens, Android will show the standard system prompt
asking whether to allow camera access.

### iOS — `ios/BMSPolice/Info.plist`

Add these keys inside the top-level `<dict>`:

```xml
<key>NSCameraUsageDescription</key>
<string>BMS Police needs the camera to scan QR codes for riders, motorcycles, and cases.</string>
```

After editing, rebuild:

```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

## Troubleshooting

- If "Camera" still doesn't appear in the app's system permission list, the
  manifest change was not compiled in. Run a clean rebuild (`./gradlew clean`)
  and reinstall the APK.
- If the scanner shows the "Camera Access Required" screen but tapping the
  button doesn't prompt, open the app's system permission screen and toggle
  Camera on manually.
