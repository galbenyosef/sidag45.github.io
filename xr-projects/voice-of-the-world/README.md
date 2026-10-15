# Voice of the World (v1)

A choir made from everyone's submitted voices. Open `index.html`, press **Listen**, and every voice is tuned to one shared key and blended live in the browser with the Web Audio API.

The website is one file (`index.html`) with no build step. The server lives in `backend/`.

## What v1 covers (from the brief's build order)

| Brief step | Status |
|---|---|
| 1. Web Audio engine with hardcoded voices | **Done.** There are 10 seed voices. They are synthesised stand-ins (formant synthesis), sung slightly off-key on purpose so you can hear the tuning work. |
| 2. Submission → moderation → analysis → pool | **Done.** Runs on AWS, fully automated (see below). Without a server address set, the page falls back to on-device only. |
| 3. Rules-based conductor | **Done.** It picks the key and mood, plays a chord progression, decides who sings and who rests, keeps registers balanced, and gives new voices the first entry. |
| 4. AI conductor | Not started. `conduct()`, `chooseVoice()` and `setMood()` are the functions to swap out. |

## How the blend works (all deterministic DSP)

- **Analysis.** Each clip gets a YIN pitch track at 12 kHz. The track is smoothed to keep intonation but drop vibrato. The analysis also measures level, voiced ratio, a rough spectral-centroid "tone", and the steadiest 0.7 s of vowel.
- **Tune to a shared key.** Granular playback with ~110 ms grains. Each grain is pitch-shifted from its own local pitch to the nearest chord tone, with hysteresis, so speech turns into held notes and natural vibrato survives. On a chord change, voices move to the nearest tone of the new chord.
- **Stagger in time.** Phrases are slowed (time-stretched) to 0.55–0.85× and enter one at a time, 1–2.6 s apart. How many voices sing at once rises and falls on slow overlapping cycles, so the texture breathes.
- **Spatial spread.** Each voice sits at a point on the globe. That point sets an HRTF panner position (equal-power on touch devices), a lowpass filter, and the reverb send. Voices on the far side sound distant and muffled. As the globe turns, or when you drag it, the choir moves around you.
- **Drones and swells.** The steady-vowel section is frozen with granular synthesis and held on the chord's root and fifth. It swells in and out over 16–26 s and crossfades at each chord change.
- **Master.** Generated convolution reverb, gentle EQ, a glue compressor and a limiter.

## The server (AWS)

The page runs on Vercel. Everything else runs on AWS and is defined in `backend/template.yaml`, so one command creates or updates it all.

```
Browser ──POST /submissions──▶ API Gateway ─▶ Lambda (api)        consent stored, presigned upload issued
Browser ──upload WAV────────▶ S3 incoming/                        private, deleted after 1 day regardless
S3 event ───────────────────▶ Lambda (ingest)                     same quality checks + pitch analysis on the server
                              └▶ Amazon Transcribe                speech → text (language auto-detected)
Transcribe done (EventBridge)▶ Lambda (moderate)
                              ├▶ Amazon Translate                 non-English → English
                              ├▶ Comprehend DetectToxicContent     reject if any score ≥ 0.5
                              ├▶ Comprehend DetectPiiEntities      reject phone, address, email, ID numbers…
                              └▶ pass: copy to S3 pool/           fail: delete everything
Browser ◀──GET /pool─────────  Lambda (api) + DynamoDB            random 16 approved voices
Browser ◀──pool/*.wav────────  CloudFront                         only pool/ is readable, nothing else
Browser ──DELETE /voices/id──▶ Lambda (api)                       withdraw token → file, record and CDN cache removed
```

- **Nobody listens to clips.** Transcripts are deleted as soon as moderation finishes. Only the pitch summary, consent record and a maximum toxicity score are kept.
- **It fails closed.** If transcription or moderation errors, the clip is rejected and deleted. A clip with no words (a sung "aaah") skips the text checks.
- **Consent.** Each record stores the consent version and timestamp. The submitter gets a withdraw token, which their browser keeps, and only a hash of it is stored.
- **Limits.** 5 submissions per IP per hour, API throttling, uploads capped at 1.1 MB, and WAV only.
- **Retention.** Approved voices are kept for 365 days (the `RetentionDays` parameter; 0 means until withdrawn). Unfinished or rejected items disappear within a day.

### Deploy (about 10 minutes, once)

You need the AWS CLI, the AWS SAM CLI and Node 22: `brew install awscli aws-sam-cli node`.

1. Sign in: `aws configure` (or `aws sso login`) with an account that can create the resources.
2. `cd backend && ./deploy.sh` → accept the defaults, and set **AllowedOrigins** to your Vercel URL (e.g. `https://voice-of-the-world.vercel.app`). It prints **ApiUrl** and **CdnUrl** when done.
3. Paste ApiUrl into `<meta name="vow-api" content="…">` near the top of `index.html`, then commit and push.
4. Vercel → Add New Project → import the GitHub repo → **Root Directory** `XR Projects/voice-of-the-world`, Framework **Other**, no build command. `.vercelignore` keeps `backend/` off the website.
5. If the Vercel URL changes or you add a custom domain: `./deploy.sh "https://new-domain.com,https://voice-of-the-world.vercel.app"`.

Tip: add `?api=https://…` to the page URL to try a backend without editing the file.

### Tests

```
cd backend/src && npm install && cd ..
node test/pipeline.test.mjs     # 18 checks: approve, toxic, personal info, translation, fails closed, withdraw, rate limit
node test/e2e.mjs               # 6 browser checks, page + backend code together (needs Playwright and a local server on :8765)
```

Both run against in-memory stand-ins for the AWS services, so they don't need an AWS account.

### Known limits

- **Short non-English clips are the weak spot.** Transcribe's language detection works best with much more than 8 seconds of speech, so it chooses among the `LanguageOptions` you set (default: English, Spanish, Hindi, French, Mandarin). Speech in other languages may be transcribed poorly, and abuse in it could slip through. Set the options to match your audience. A stronger later option is an audio-capable model on Amazon Bedrock as a second check.
- **Voices are served as WAV** (about 44 KB per second of audio). For a big pool, adding an Opus conversion step would cut the download about 10×.
- **Vercel preview URLs** aren't in AllowedOrigins, so previews can play the seed voices but can't reach the API.
