# Stillpoint VR

A standalone VR meditation app for Google Cardboard on iPhone, built in Unity.

**What's in v1**
- Gaze-controlled lobby (look + hold, or tap the Cardboard button)
- 5 places: Ocean at Dusk, Forest Glade, Rain on the Porch, Starry Night, Hidden Waterfall
- 5 / 10 / 20 minute sessions
- Breathing light (4s in, 4s out) — tap to show/hide
- AI voice guidance (ElevenLabs) with captions, ambience ducks while it speaks
- Procedural ambient sound per scene (no audio assets needed)
- Singing-bowl chime at start and end, session stats and daily streak

Everything is generated in code, so there are no prefabs or art assets to manage.

## Open it

1. Unity Hub → **Add** → pick this `stillpoint-vr` folder. Use Unity **2022.3 LTS or Unity 6** with the **iOS Build Support** module.
2. First open takes a few minutes (it downloads the Google Cardboard plugin from GitHub).
3. When it finishes, the project configures itself (scene, iOS player settings, Cardboard loader).
   If anything was missed, run **Stillpoint → Configure Project for Cardboard (iOS)**.
4. Press **Play** to try it in the editor:
   right-mouse-drag = look around · left click / Space = Cardboard button · R = recenter · Esc = Cardboard "X".

## Put it on your iPhone

1. **Stillpoint → Switch Build Target to iOS**
2. Check **Project Settings → XR Plug-in Management → iOS tab → Cardboard XR Plugin** is ticked.
3. **File → Build Settings → Build**, choose a folder (e.g. `Builds/iOS`).
4. Open the generated `Unity-iPhone.xcodeproj` in Xcode → Signing & Capabilities → pick your Apple ID team → plug in the iPhone → Run.
5. First launch asks to scan the QR code on your headset (Destek). Gear icon re-scans any time.

## AI voice (ElevenLabs)

The script lives in `Assets/Resources/narration_script.json`. Generate the audio once:

```bash
cd "XR Projects/stillpoint-vr"
echo 'ELEVENLABS_API_KEY=sk_your_key' > Tools/.env      # git-ignored
python3 Tools/generate_narration.py                      # optional: --voice <voice_id> --speed 0.85
```

Clips land in `Assets/Resources/Narration/` and play automatically. Until then, the guidance shows as captions.
Edit any line's text and re-run with `--force --only <id>`.

## Swap in real media (optional)

- 360° video: `Assets/StreamingAssets/Video/<scene>.mp4` (equirectangular 2:1)
- Ambient loop: `Assets/Resources/Audio/<scene>.mp3`

Scene ids: `ocean`, `forest`, `rain`, `stars`, `waterfall`, `lobby`.

## Code map

| File | What it does |
| --- | --- |
| `AppController.cs` | App flow (lobby → length → session → complete), stats, auto-boot |
| `CardboardRig.cs` | Camera, Cardboard input, QR scan, editor controls, fade |
| `Gaze.cs` | Gaze targets, dwell reticle, UI sounds |
| `Environment.cs` | Builds each place: sky, terrain, particles, audio |
| `Scenes.cs` | Colours and copy for each place |
| `MeditationSession.cs` | Timer, narration schedule, captions, end of session |
| `BreathingOrb.cs` | The breathing light |
| `Synth.cs` | Procedural surf, wind, rain, birds, crickets, thunder, chime |
| `Editor/StillpointSetup.cs` | One-click project configuration |

## Troubleshooting

- **Pink objects** → run Stillpoint → Configure Project (adds the shaders to the build).
- **Input errors in Play mode** → Project Settings → Player → Active Input Handling → *Both*.
- **Flat (non-stereo) view on phone** → Cardboard loader isn't ticked for iOS in XR Plug-in Management.
