# Apartment Walkthrough

A walkable 3D rebuild of the apartment from the 32-second phone video (20260618_185817.mp4).

Open `index.html` through a local server (e.g. `python3 -m http.server`) — it loads three.js from jsDelivr.

- WASD to walk, Shift to run, drag / arrow keys to look, scroll to zoom, V for first person
- Floor plan (top right) shows where you are; click it to jump to a room
- Bottom-left card shows the matching frame from the video and plays that moment
- `assets/skyline.jpg` is stitched from the balcony part of the video; `assets/art-hall.jpg` and `assets/art-bed.jpg` are cropped from it; `assets/walkthrough.mp4` is the video re-encoded small (it plays on the living-room TV)

## Floor plan
Laid out from the hand-drawn plan (IMG_1841), 1 grid square = 1.2 m, overall about 23.2 × 7.2 m:
Bedroom 1 + Bath 1 | Bedroom 2 over a corridor and Bath 2 | Living room behind a shallow balcony, dining by the entry | Bedroom 3 over the kitchen counter and pantry.
Door positions and swings follow the slanted lines on the plan.

## Rendering
- Physically based materials (clearcoat marble and oak, sheen fabrics, lacquer), high-res procedural textures with normal and roughness maps
- Ground-truth ambient occlusion (GTAO) + bloom, 2048 soft shadows, reflections captured from the apartment itself
- Person: the Ready Player Me avatar from the three.js examples (`assets/person-model.js`, base64 GLB), animated with motion-captured idle / walk / run clips retargeted from the Mixamo "Xbot" rig and pre-baked into `assets/person-anims.json`
- Adaptive quality (default "Auto"): while you move or turn, frames render Fast (reduced resolution, no post-processing); once the view settles for ~0.3 s it switches to Ultra (full resolution up to 2×, ambient occlusion, bloom), fading the effects in
- Shadow maps of lights away from the person are frozen rather than re-rendered every frame
- The Quality button cycles Auto → Ultra → Fast
- `assets/Xbot.glb` and `assets/xbot-model.js` from earlier versions are no longer used
