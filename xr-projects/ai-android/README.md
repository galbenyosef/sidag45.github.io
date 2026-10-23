# Mira — 3D AI assistant

A Three.js AI-assistant character with a living temple LED.

Open `index.html` through a local server, for example:

```
cd xr-projects/ai-android
python3 -m http.server 8000
```

Then open http://localhost:8000.

## How it works
- **Head**: the photo (`assets/mira-color.png`) is mapped onto a 400×400 plane and pushed into 3D using `assets/mira-depth.png`. The depth map combines MediaPipe face-mesh depth, a head ellipsoid and neck/torso volumes.
- **Shader** (in `index.html`): handles eyelid blinks, eye saccades, jaw/mouth opening while speaking, relighting from the depth normals, and the flush temple ring.
- **LED states**: Idle (cyan, slow breathing), Listening (blue), Thinking (amber, spinning arc), Speaking (cyan, pulsing with the mouth) and Error (red, blinking).
- **Behaviour**: the head follows the cursor and has idle drift. Blinks are randomised, with occasional double blinks.
- **Chat**: a scripted `respond()` function. Replace it with a call to your LLM endpoint. The **🔊** button turns on browser text-to-speech.

## Hooks
`window.mira.setMode('thinking')` and `window.mira.say('Hello!')`. Use these to wire up a real backend.

## Regenerating assets
`tools/prep.py` rebuilds the cutout, depth map and `mira-features.json` from `assets/source-front.png`. It needs Python with `mediapipe==0.10.14`, `opencv-python-headless`, `scipy` and `numpy`.

```
python3 tools/prep.py assets/source-front.png assets
```
