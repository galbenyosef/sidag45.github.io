# AR Graffiti · Phase 0: prove anchoring

This is the go/no-go test. One phone places a test marker on a chalk X on McKeldin Mall. Other phones, on other accounts and on other days, load it. Each tester marks where the real X is, and the app logs how far off the marker appeared, in which direction and at what rotation. `results/index.html` turns those logs into a Pass, Marginal or Fail for each kind of spot, using the brief's criteria.

```
ar-graffiti/
├── unity/Assets/ARGraffiti/     ← copy this folder into your Unity project's Assets/
│   ├── Scripts/                 Phase0Controller (the app), SupabaseClient, GeoMath, MarkerFactory, Phase0Ui, Rows, Phase0Settings
│   └── Editor/Phase0Setup.cs    menu: AR Graffiti > 1. Configure Project Settings / 2. Build Phase 0 Scene
├── supabase/schema.sql          tables + row-level security; paste into the Supabase SQL editor
├── results/index.html           live results dashboard (open with ?demo to see sample data)
└── TEST-PROTOCOL.md             what to do on the Mall, step by step
```

## How it works

- **Stack:** Unity 6 + AR Foundation 6 + ARCore Extensions 1.56 (`arf6` branch) using the **Geospatial API**. The same build runs on Android and iPhone.
- **Placing:** stand over the chalk X and aim the crosshair at it, then at a second chalk dot that sets which way the marker faces. The app turns that pose into latitude, longitude and altitude plus an East-Up-North rotation, and stores it in Supabase. It only lets you save once Google's VPS has localized the phone to within ±1 m and ±4° (you can change these limits in `Phase0Settings`).
- **Anchor type:** the default is a **terrain anchor**, which sits on Google's ground model so it doesn't depend on each phone's altitude estimate. A **WGS84** option (fixed altitude) is there for comparison. You switch between them on the save screen.
- **No home advantage:** right after saving, the placer's marker is deleted and rebuilt from the stored record, the same way every other phone loads it.
- **Accounts:** each install signs in as its own anonymous Supabase user. Two phones therefore means two accounts. The short account ID is shown at the top of the screen so you can check this. Tap "New account" to switch identity on the same phone.
- **Measuring:** tap "Measure error". The marker hides so you can see the ground. Put the crosshair on the real X, then on the real facing dot. The app logs:
  - the offset along the ground (cm)
  - which compass direction the offset is in (east/north)
  - the height offset
  - the rotation error (°)
  - the phone's localization accuracy at that moment
  - hours since the marker was placed
- **Lock time:** the time from tapping Load until the marker is tracking on screen. Turn on "Cold start" to reset AR first, so lock time includes localizing from scratch, like someone who has just arrived.
- **Tags:** "Spot" (open, plain or shaded) and "Light" (sunny, overcast, dusk and so on) are saved with every result. The dashboard uses them to group results.

## Setup (about 30 minutes, once)

### 1. Supabase
1. Create a project at supabase.com.
2. **Authentication → Sign In / Providers → turn on "Allow anonymous sign-ins".**
3. **SQL Editor → New query →** paste `supabase/schema.sql` and run it.
4. **Project Settings → API keys:** copy the project URL and the **publishable** key (`sb_publishable_…`; on older projects it's the `anon` key). Never use the secret or service_role key.

### 2. Google Cloud (Geospatial API)
1. In console.cloud.google.com, create or pick a project and **enable the "ARCore API"**.
2. **APIs & Services → Credentials → Create API key.** Restrict it to the ARCore API.

### 3. Unity project
1. In Unity Hub, create a new project with **Unity 6 (LTS)** using the **AR Mobile** template. This comes with AR Foundation, ARCore, ARKit, URP and the AR camera background already set up.
2. **Window → Package Manager → + → Add package from git URL:**
   `https://github.com/google-ar/arcore-unity-extensions.git#arf6`
3. ARCore Extensions needs the **External Dependency Manager for Unity** (for Android Gradle libraries and iOS CocoaPods). Add it through **Project Settings → Package Manager → Scoped Registries**:
   - Name: `package.openupm.com`
   - URL: `https://package.openupm.com`
   - Scope: `com.google.external-dependency-manager`

   Then add `com.google.external-dependency-manager` by name in the Package Manager. If you'd rather not use a scoped registry, import the `.unitypackage` from github.com/googlesamples/unity-jar-resolver instead.
4. Copy `unity/Assets/ARGraffiti` into the project's `Assets/` folder.

### 4. Configure
1. **AR Graffiti → 1. Configure Project Settings.** This sets:
   - Active Input Handling to Both
   - the iOS camera and location permission text
   - Android minimum API 24, IL2CPP and ARM64
   - Internet access as required

   **Restart Unity** when it asks.
2. **Project Settings → XR Plug-in Management:**
   - Android tab: ARCore ticked.
   - iOS tab: ARKit ticked.
3. **Project Settings → XR Plug-in Management → ARCore Extensions:**
   - iOS Support Enabled: on
   - Android Authentication Strategy: API Key (paste the key)
   - iOS Authentication Strategy: API Key (same key)
   - Optional features → **Geospatial: on**
4. **AR Graffiti → 2. Build Phase 0 Scene.** This creates `Assets/ARGraffiti/Scenes/Phase0.unity` with the AR Session, XR Origin, the plane, raycast, anchor and Earth managers, ARCore Extensions and the app, and makes it the only scene in the build.
5. In the Inspector, paste the Supabase URL and publishable key into **Phase0Settings**. Unity selects this file for you at the end of step 4.

### 5. Build
- **Android:** File → Build Profiles → Android → Switch Platform → Build And Run with the phone plugged in. The phone needs "Google Play Services for AR".
- **iPhone:** switch to iOS and build. Open the generated **`Unity-iPhone.xcworkspace`** (not the `.xcodeproj`), because CocoaPods adds ARCore. Set your signing team and run.

If the camera view is black on Android, set Graphics APIs to **OpenGLES3 only** in Player Settings → Other Settings.

## Running the test
See **TEST-PROTOCOL.md**. In short: chalk an X and a facing dot at each of three spots, place one marker per spot, then have the other phone load and measure each one. Repeat at different times of day and again the next day.

## Seeing results
Open `results/index.html`. You can paste the URL and key into the form, or hard-code them at the top of the file. It signs in as an anonymous viewer and refreshes every 30 s. To see the layout before you have real data, add `?demo` to the address.

## What was verified before handoff, and what wasn't
- All C# was type-checked against the real ARCore Extensions 1.56 (`arf6`) API signatures, for both the Android and iOS compile paths.
- The placement and measurement maths (offset, signed rotation, compass heading from the East-Up-North rotation, metres east and north) passed unit tests.
- `schema.sql` was run twice on Postgres 16 and its access rules were tested: users read everything, write only as themselves, can't forge or edit other users' rows, and logged results can't be edited.
- The dashboard was rendered with sample data on desktop and phone widths.
- **Not done:** opening this in the Unity Editor or running it on a phone. That isn't possible from here. If one of the setup menu steps can't find a menu item, it says what to add by hand.
