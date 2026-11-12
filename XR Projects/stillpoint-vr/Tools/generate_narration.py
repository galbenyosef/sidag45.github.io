#!/usr/bin/env python3
"""
Generate Stillpoint's AI voice guidance with ElevenLabs.

Reads  Assets/Resources/narration_script.json
Writes Assets/Resources/Narration/<id>.mp3   (Unity picks them up automatically)

Usage:
    export ELEVENLABS_API_KEY=sk_...
    python3 Tools/generate_narration.py                 # all lines, default voice
    python3 Tools/generate_narration.py --voice <id>    # pick a voice from your ElevenLabs library
    python3 Tools/generate_narration.py --only intro close --force

No third-party packages needed. Edit the text in narration_script.json and re-run with --force.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "Assets", "Resources", "narration_script.json")
OUT = os.path.join(ROOT, "Assets", "Resources", "Narration")
DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"  # a calm premade voice; swap for one you like


def load_env_file():
    path = os.path.join(ROOT, "Tools", ".env")
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v.strip().strip('"'))


def synth(text, voice, key, model, speed):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128"
    body = {
        "text": text,
        "model_id": model,
        "voice_settings": {"stability": 0.65, "similarity_boost": 0.75, "style": 0.05,
                           "use_speaker_boost": True, "speed": speed},
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json",
                                          "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main():
    load_env_file()
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=os.environ.get("ELEVENLABS_VOICE_ID", DEFAULT_VOICE))
    ap.add_argument("--model", default="eleven_multilingual_v2")
    ap.add_argument("--speed", type=float, default=0.88, help="0.7 (slow) to 1.2")
    ap.add_argument("--only", nargs="*", help="line ids to generate")
    ap.add_argument("--force", action="store_true", help="overwrite existing clips")
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("Set ELEVENLABS_API_KEY (or put it in Tools/.env).")

    with open(SCRIPT) as f:
        lines = json.load(f)["lines"]
    os.makedirs(OUT, exist_ok=True)

    for line in lines:
        lid = line["id"]
        if args.only and lid not in args.only:
            continue
        path = os.path.join(OUT, lid + ".mp3")
        if os.path.exists(path) and not args.force:
            print(f"skip  {lid} (exists)")
            continue
        try:
            audio = synth(line["text"], args.voice, key, args.model, args.speed)
        except urllib.error.HTTPError as e:
            sys.exit(f"ElevenLabs error on '{lid}': {e.code} {e.read().decode(errors='ignore')[:300]}")
        with open(path, "wb") as f:
            f.write(audio)
        print(f"wrote {lid}.mp3  ({len(audio) // 1024} KB)")

    print("Done. Switch back to Unity and the clips import automatically.")


if __name__ == "__main__":
    main()
