# Phase 0 field test: McKeldin Mall

**Goal (from the brief):** two phones on two accounts see the same marker at the same spot, facing the same way, every time. That has to hold at different times of day, in different light, from different approach angles, and on different days.

## Kit
- 2 phones (ideally 1 Android + 1 iPhone), each with the Phase 0 build installed and the app opened once so it creates its account
- Sidewalk chalk (or tape on paving), and a tape measure for a quick sanity check
- A note of each phone's account ID, shown at the top of the app screen

## Pick 3 spots (the brief's spot types)
| Tag in app | What to look for on McKeldin Mall |
|---|---|
| **Open / well-mapped** | Paved path with a clear view of buildings on several sides (e.g. near McKeldin Library steps or the Mall's central walkway). Good Street View coverage. |
| **Plain / featureless** | The middle of the big lawn, where the camera sees mostly grass and sky. |
| **Shaded / trees** | Under the tree canopy along the edges of the Mall. |

Before you go, open the app at each spot. The status panel shows "VPS here: Available" where Google has street-level visual positioning.

## Mark each spot
1. Chalk a clear **X**, about 30 cm across, on a flat surface.
2. Chalk a **facing dot** 1–2 m away from the X (further is more precise). Point it at something easy to name, e.g. "towards the library doors".
3. Photograph the marks with a landmark in frame, so you can find them again tomorrow.

## Day 1: place (phone A)
For each spot:
1. Set **Spot** to match the location and **Light** to the current conditions.
2. Look around at buildings until the position and heading accuracy figures turn green.
3. Tap **Place marker**:
   - Put the crosshair on the centre of the X and tap **Set X here**.
   - Put the crosshair on the facing dot and tap **Set facing here**.
   - Tap **Save marker**. Use the default **Terrain** anchor type. Save is greyed out until localization is good enough.
4. The marker reloads from the cloud. Tap **Measure error** once. This is the placer baseline and should be only a few cm.

## Day 1: load (phone B, different account)
For each spot:
1. Walk in from a **different direction** than phone A did.
2. Set Spot and Light to match.
3. Optional: turn on **Cold start** to time a from-scratch lock.
4. Tap **Load marker** and pick the marker for this spot. Note how long it takes to appear; the app logs this too.
5. Before measuring, check by eye: is the pole on the X, and is the orange sign facing the dot?
6. Tap **Measure error**. Put the crosshair on the real X, then on the real facing dot.
7. Repeat the load and measure 2–3 times from different angles and distances (2 m, 5 m, 10 m).

Phone A should also load phone B's markers if B places any, so both directions get tested.

## Repeat
- **Same day, different light:** come back at dusk, and again at night if you can.
- **Next day (≥ 18 h later):** both phones load the original markers. **Do not re-place them.** This is the "place today, load tomorrow" test.
- Optional: place one extra marker with the **WGS84** anchor type at the open spot, to compare with terrain anchors.

## Reading the result
Open `results/index.html` (it also works on a phone). For each kind of spot it shows:

| Verdict | Rule used (other people's measurements only) |
|---|---|
| **PASS** | ≥ 90% of loads succeed, 90% of offsets ≤ 50 cm, 90% of rotations ≤ 10°, plus at least one next-day measurement and two lighting conditions |
| **ON TRACK** | The numbers pass, but the next-day or second-lighting data is still missing |
| **MARGINAL** | ≥ 70% of loads succeed, 90% of offsets ≤ 1.5 m, 90% of rotations ≤ 20°. Works, but limits where pieces can go |
| **FAIL** | Worse than that. Rethink the anchoring stack (e.g. Niantic Lightship VPS) before building Phase 1 |

These thresholds turn the brief's "roughly tens of centimetres" into numbers. You can change them in `verdictFor()` in the dashboard.

## Notes to jot down on site (things the app can't see)
- Where it failed or drifted, and what the camera was pointing at
- Whether the pole looked like it was standing on the ground or floating (the logged height error backs this up)
- Crowds, rain, glare
