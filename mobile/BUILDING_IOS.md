# Building the BMS Police iOS app

The mobile project is bare React Native 0.74.5. iOS builds MUST happen on a
Mac with Xcode — Apple's toolchain (`xcodebuild`, `codesign`, the iOS SDK)
does not exist on Linux or Windows, and Bolt's build environment is Linux.
The instructions below cover generating the iOS project, running the app on
a tethered iPhone, and shipping it to the police team.

Bundle identifier: `com.bmspolice`
Display name:      `BMS Police`
Xcode target:      `BmsPolice`
JS entry name:     `BmsPolice` (registered in `mobile/index.ts`)

---

## 1. One-time prerequisites on the Mac

1. Install Xcode 15 or newer from the App Store, then open it once so it
   finishes the first-run component installation.
2. Install the command-line tools:
   ```bash
   xcode-select --install
   ```
3. Install CocoaPods (choose one):
   ```bash
   sudo gem install cocoapods    # ships with macOS Ruby
   # OR
   brew install cocoapods        # if you use Homebrew
   ```
4. Install Node 18+ (Homebrew: `brew install node`, or use `nvm`).

## 2. Generate `mobile/ios/`

There is no `ios/` folder yet — the project has only `android/`. The
scaffolding script does everything in one shot: it initialises a fresh RN
0.74.5 template, copies its `ios/` folder in, sets the bundle identifier
and display name, writes the iOS permission strings, registers the
vector-icons fonts, and runs `pod install`.

```bash
cd mobile
npm install
bash scripts/setup-ios.sh
```

If you ever need to regenerate from scratch, pass `--force` (it deletes
`mobile/ios/` first, then re-scaffolds):

```bash
bash scripts/setup-ios.sh --force
```

Under the hood the script writes these Info.plist entries so first-launch
permission prompts have descriptive strings (Apple rejects builds without
them):

| Purpose            | Info.plist key                          |
|--------------------|-----------------------------------------|
| Camera             | NSCameraUsageDescription                |
| Photo library      | NSPhotoLibraryUsageDescription          |
| Photo save         | NSPhotoLibraryAddUsageDescription       |
| Microphone         | NSMicrophoneUsageDescription            |
| Location (in use)  | NSLocationWhenInUseUsageDescription     |
| Face ID            | NSFaceIDUsageDescription                |

## 3. Sign the app in Xcode

```bash
cd mobile
open ios/BmsPolice.xcworkspace
```

Note: always open the `.xcworkspace`, never the `.xcodeproj` — CocoaPods
puts everything in the workspace.

In Xcode:

1. Select the `BmsPolice` project in the left navigator.
2. Pick the `BmsPolice` target.
3. Open the **Signing & Capabilities** tab.
4. Tick **Automatically manage signing**.
5. Under **Team**, pick your Apple ID team.
   - **Free Apple ID**: works, but the signed app expires after 7 days and
     you can only install it on up to 3 devices at once. Re-run from
     Xcode to refresh.
   - **Apple Developer Program** ($99/year): builds last 1 year, unlocks
     TestFlight, App Store, and Ad Hoc distribution.

If Xcode complains that the bundle ID `com.bmspolice` is already taken,
change the **Bundle Identifier** field to something unique to you (for a
free Apple ID this is common; the identifier is namespaced per Apple ID).

## 4. Install on a tethered iPhone

1. Connect the iPhone with a USB / USB-C cable.
2. Unlock the phone, tap **Trust this computer** on the prompt.
3. In Xcode's toolbar, click the run-destination popup (next to the scheme)
   and select your device.
4. Press the Run button (or `Cmd+R`).
5. First install: on the iPhone go to
   `Settings > General > VPN & Device Management`, tap your Apple ID under
   **Developer App**, and press **Trust**. The BMS Police app now opens.

Metro (the JS dev server) needs to be reachable. The setup script already
registers `_rnpackager._tcp` Bonjour, so keeping the phone on the same
Wi-Fi as the Mac is enough. If it still can't connect, in Xcode set the
build configuration to **Release** to bake the JS bundle into the binary.

## 5. Distributing to more officers

Pick the path that matches how many phones and how tightly you want to
control installs.

### 5a. TestFlight — recommended for a small police team

Requires Apple Developer Program ($99/year).

1. In Xcode: `Product > Scheme > Edit Scheme`, set the Run configuration
   to **Release**.
2. `Product > Archive` (make sure the run destination is set to
   "Any iOS Device (arm64)", not the simulator).
3. In the Organizer window that opens: **Distribute App > TestFlight & App
   Store > Upload**.
4. In [App Store Connect](https://appstoreconnect.apple.com/), pick the
   new build under **TestFlight**, add internal testers by email
   (up to 100 with no App Store review), or invite external testers via a
   public link (up to 10,000, requires a short Apple review).
5. Officers install the free **TestFlight** app from the App Store, tap
   the invite link, and get the build.

Builds are automatically re-signed by Apple and last 90 days per build.

### 5b. Ad Hoc IPA

Requires Apple Developer Program.

1. In the Apple Developer portal, collect each iPhone's UDID and register
   them under **Devices** (limit 100 per device type per year).
2. Create an Ad Hoc provisioning profile that includes those devices.
3. In Xcode: `Product > Archive`, then `Distribute App > Ad Hoc > Export`.
4. Ship the resulting `.ipa` via a signed hosting page or an MDM.

### 5c. Apple Business Manager (for a proper deployment)

If the police fleet uses managed iPhones, enrol the app as a **Custom
App** in Apple Business Manager and push it silently via an MDM like
Jamf, Kandji, or Intune.

## 6. Common gotchas

- **`pod install` fails with an SSL error**: run `pod repo update` and
  retry. Or delete `~/.cocoapods/repos/trunk` and rerun.
- **`Multiple commands produce ... .app`**: clean the build folder
  (`Product > Clean Build Folder`, then delete `mobile/ios/build`).
- **Vector icons render as tofu boxes**: the fonts didn't get bundled.
  From `mobile/`, run `npx react-native-asset` and rebuild.
- **`Undefined symbols for architecture arm64`**: usually a stale pods
  install. Delete `mobile/ios/Pods` and `mobile/ios/Podfile.lock`, then
  `cd ios && pod install`.
- **Metro isn't reachable from the phone**: on the Mac, check
  `System Settings > Network` for the Wi-Fi IP; then in Xcode set
  `RCT_METRO_PORT` or open the shake-gesture dev menu on the phone and
  point it at `http://<mac-ip>:8081`.

## 7. What Bolt is doing vs what you do

- Bolt authored the RN JS/TS source, the Android project, the
  scaffolding script (`mobile/scripts/setup-ios.sh`), and this guide.
- You run the script and the Xcode build on the Mac. Bolt cannot compile
  iOS binaries — the toolchain is macOS-only.
