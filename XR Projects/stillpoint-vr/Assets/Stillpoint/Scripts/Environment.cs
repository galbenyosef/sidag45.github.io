using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Video;

namespace Stillpoint
{
    /// <summary>
    /// Builds and runs one meditation place: sky, geometry, particles and ambience.
    /// Overrides: Assets/StreamingAssets/Video/&lt;id&gt;.mp4 (360° equirect) and
    /// Assets/Resources/Audio/&lt;id&gt; (ambient loop) replace the procedural versions.
    /// </summary>
    public class Environment : MonoBehaviour
    {
        public ScenePreset preset;

        readonly List<AudioSource> _sources = new List<AudioSource>();
        readonly List<float> _baseVol = new List<float>();
        float _fade, _fadeTarget = 1f, _fadeSpeed = 0.5f, _duck = 1f, _duckTarget = 1f;

        Material _skyMat;
        VideoPlayer _video;
        Material _videoMat;

        // scene-specific runtime bits
        ThunderVoice _thunder;
        float _nextLightning = 18f, _thunderAt = -1f, _flash;
        Transform _starRoot, _shooting;
        Material _shootingMat;
        float _nextShooting = 12f, _shootT = -1f;
        Vector3 _shootFrom, _shootTo;

        public static Environment Build(ScenePreset p)
        {
            var go = new GameObject("Environment_" + p.id);
            var env = go.AddComponent<Environment>();
            env.preset = p;
            env.Construct();
            return env;
        }

        public void FadeAudio(float target, float seconds)
        {
            _fadeTarget = target;
            _fadeSpeed = seconds <= 0 ? 100f : Mathf.Max(0.01f, Mathf.Abs(target - _fade) / seconds);
        }

        /// <summary>Lower ambience while narration plays.</summary>
        public void Duck(bool on) { _duckTarget = on ? 0.55f : 1f; }

        // ------------------------------------------------------------------
        void Construct()
        {
            var p = preset;
            SP.SetFog(p.fog, p.fogStart, p.fogEnd, p.fogStrength);
            SP.SetLight(p.sunDir);

            _skyMat = SP.Mat("Stillpoint/GradientSky");
            _skyMat.SetColor("_Top", p.skyTop);
            _skyMat.SetColor("_Horizon", p.skyHorizon);
            _skyMat.SetColor("_Bottom", p.skyBottom);
            _skyMat.SetColor("_SunColor", p.sunColor);
            _skyMat.SetVector("_SunDir", p.sunDir.normalized);
            _skyMat.SetFloat("_SunSize", p.sunSize);
            _skyMat.SetFloat("_Exponent", p.skyExp);
            var sky = SP.MeshObject("Sky", transform, SP.SphereMesh, _skyMat);
            sky.transform.localScale = Vector3.one * 900f;

            bool hasVideo = TryVideo();
            if (!hasVideo)
            {
                switch (p.id)
                {
                    case "lobby": BuildLobby(); break;
                    case "ocean": BuildOcean(); break;
                    case "forest": BuildForest(); break;
                    case "rain": BuildRain(); break;
                    case "stars": BuildStars(); break;
                    case "waterfall": BuildWaterfall(); break;
                }
            }

            var custom = Resources.Load<AudioClip>("Audio/" + p.id);
            if (custom != null)
            {
                foreach (var s in _sources) Destroy(s);
                _sources.Clear(); _baseVol.Clear();
                var src = gameObject.AddComponent<AudioSource>();
                src.clip = custom; src.loop = true; src.spatialBlend = 0; src.Play();
                Track(src, 1f);
            }
            else if (hasVideo)
            {
                for (int i = 0; i < _baseVol.Count; i++) _baseVol[i] *= 0.5f;
            }
            ApplyVolumes();
        }

        bool TryVideo()
        {
            string path = Path.Combine(Application.streamingAssetsPath, "Video", preset.id + ".mp4");
#if UNITY_ANDROID && !UNITY_EDITOR
            return false;
#else
            if (!File.Exists(path)) return false;
            _videoMat = SP.Mat("Stillpoint/Video360");
            var sphere = SP.MeshObject("Video360", transform, SP.SphereMesh, _videoMat);
            sphere.transform.localPosition = new Vector3(0, SP.EyeHeight, 0);
            sphere.transform.localScale = Vector3.one * 60f;
            _video = sphere.AddComponent<VideoPlayer>();
            _video.source = VideoSource.Url;
            _video.url = path;
            _video.isLooping = true;
            _video.renderMode = VideoRenderMode.APIOnly;
            _video.audioOutputMode = VideoAudioOutputMode.Direct;
            _video.Play();
            return true;
#endif
        }

        void Track(AudioSource s, float vol) { _sources.Add(s); _baseVol.Add(vol); }

        void AddSynth(SynthVoice v, float vol, Vector3? pos = null, float spatial = 0f)
        {
            var host = gameObject;
            if (pos.HasValue)
            {
                host = new GameObject("Sound");
                host.transform.SetParent(transform, false);
                host.transform.localPosition = pos.Value;
            }
            var s = SynthVoice.Play(host, v, 0f, spatial);
            Track(s, vol);
        }

        void Update()
        {
            _fade = Mathf.MoveTowards(_fade, _fadeTarget, _fadeSpeed * Time.deltaTime);
            _duck = Mathf.MoveTowards(_duck, _duckTarget, Time.deltaTime * 0.8f);
            ApplyVolumes();

            if (_video != null && _videoMat != null && _video.texture != null) _videoMat.mainTexture = _video.texture;

            if (_thunder != null) UpdateStorm();
            if (_starRoot != null) UpdateStars();
        }

        void ApplyVolumes()
        {
            for (int i = 0; i < _sources.Count; i++)
                if (_sources[i] != null) _sources[i].volume = _baseVol[i] * _fade * _duck;
            if (_video != null && _video.audioOutputMode == VideoAudioOutputMode.Direct)
                _video.SetDirectAudioVolume(0, _fade * _duck);
        }

        // ------------------------------------------------------------------
        // Builders
        // ------------------------------------------------------------------

        void BuildLobby()
        {
            SP.MeshObject("Hills", transform, SP.HillRing(170f, -2f, 6f, 22f, 96, 3), SP.Flat(new Color(0.07f, 0.06f, 0.13f), 0.9f));
            SP.Box(transform, new Vector3(0, -0.05f, 0), new Vector3(600, 0.1f, 600), SP.Flat(new Color(0.06f, 0.05f, 0.11f), 0.9f));
            var ringMat = SP.Ring(new Color(1, 1, 1, 0), new Color(0.75f, 0.7f, 1f, 0.25f), 0.47f, 0.5f);
            for (int i = 0; i < 3; i++)
            {
                var r = SP.Quad("FloorRing", transform, ringMat, Vector2.one * (2.4f + i * 2.2f));
                r.transform.localPosition = new Vector3(0, 0.01f, 0);
                r.transform.localRotation = Quaternion.Euler(90, 0, 0);
            }
            Particles("Motes", new Vector3(0, 2.5f, 0), Quaternion.identity, ParticleSystemShapeType.Sphere, Vector3.one, 14f,
                SP.Soft(SP.Dot, Color.white, true), 14, 160, 9f, 0.05f, 0.04f, 0.1f, new Color(0.8f, 0.75f, 1f, 0.7f), noise: 0.25f);
            AddSynth(new PadVoice(7, 110f, 164.81f, 220f, 261.63f) { gain = 0.10f }, 0.9f);
            AddSynth(new NoiseVoice(8) { color = 2, cutoff = 0.04f, swellPeriod = 15f, swellDepth = 0.5f, gain = 0.6f }, 0.25f);
        }

        void BuildOcean()
        {
            var water = SP.Mat("Stillpoint/Water");
            water.SetColor("_Deep", new Color(0.08f, 0.11f, 0.22f));
            water.SetColor("_Spec", new Color(1f, 0.68f, 0.42f));
            water.SetFloat("_WaveScale", 0.8f);
            var w = SP.MeshObject("Sea", transform, SP.Grid(520f, 120), water);
            w.transform.localPosition = new Vector3(0, -0.25f, 0);

            var sand = SP.Flat(new Color(0.58f, 0.43f, 0.36f), 0.72f);
            SP.Box(transform, new Vector3(0, -0.05f, -98.5f), new Vector3(400, 0.1f, 203), sand);
            SP.Box(transform, new Vector3(0, -0.12f, 4.2f), new Vector3(400, 0.1f, 3f), SP.Flat(new Color(0.42f, 0.30f, 0.27f), 0.7f), 0);

            var rock = SP.Flat(new Color(0.18f, 0.14f, 0.16f), 0.5f);
            var rng = new System.Random(11);
            for (int i = 0; i < 14; i++)
            {
                float side = i % 2 == 0 ? -1 : 1;
                var pos = new Vector3(side * (9 + (float)rng.NextDouble() * 25), 0, 2 + (float)rng.NextDouble() * 18);
                var s = new Vector3(1 + (float)rng.NextDouble() * 4, 0.8f + (float)rng.NextDouble() * 3, 1 + (float)rng.NextDouble() * 3);
                var b = SP.Box(transform, pos, s, rock, (float)rng.NextDouble() * 90);
                b.transform.localRotation *= Quaternion.Euler((float)rng.NextDouble() * 20 - 10, 0, (float)rng.NextDouble() * 20 - 10);
            }
            Particles("Glints", new Vector3(0, 0.3f, 60), Quaternion.identity, ParticleSystemShapeType.Box, new Vector3(60, 0.2f, 80), 0,
                SP.Soft(SP.Dot, Color.white, true), 30, 200, 2.5f, 0f, 0.15f, 0.45f, new Color(1f, 0.8f, 0.55f, 0.6f));

            AddSynth(new NoiseVoice(21) { color = 2, cutoff = 0.22f, swellPeriod = 8.5f, swellDepth = 0.85f, swellShape = 2f, gain = 1f }, 0.9f, new Vector3(0, 0, 14), 0.35f);
            AddSynth(new NoiseVoice(22) { color = 1, cutoff = 0.35f, swellPeriod = 11.3f, swellDepth = 0.9f, swellShape = 3f, gain = 0.8f }, 0.4f, new Vector3(-14, 0, 18), 0.5f);
            AddSynth(new NoiseVoice(23) { color = 1, cutoff = 0.04f, swellPeriod = 17f, swellDepth = 0.4f, gain = 0.8f }, 0.25f);
        }

        void BuildForest()
        {
            SP.Box(transform, new Vector3(0, -0.05f, 0), new Vector3(400, 0.1f, 400), SP.Flat(new Color(0.20f, 0.30f, 0.17f), 0.65f));
            var clearing = SP.Ring(new Color(0, 0, 0, 0), new Color(0.35f, 0.45f, 0.25f, 0.35f), 0f, 0.5f);
            var c = SP.Quad("Clearing", transform, clearing, Vector2.one * 9f);
            c.transform.localPosition = new Vector3(0, 0.01f, 0);
            c.transform.localRotation = Quaternion.Euler(90, 0, 0);

            Trees(110, 5.5f, 70f, 31, -1f, 1f);
            SP.MeshObject("Hills", transform, SP.HillRing(160f, -2f, 10f, 30f, 96, 4), SP.Flat(new Color(0.20f, 0.32f, 0.24f), 0.9f));

            // light shafts
            var shaft = SP.Soft(SP.Dot, new Color(1f, 0.95f, 0.75f, 0.09f), true);
            for (int i = 0; i < 6; i++)
            {
                var q = SP.Quad("Shaft", transform, shaft, new Vector2(2.2f, 26f));
                float yaw = -40 + i * 16f;
                var dir = Quaternion.Euler(0, yaw, 0) * Vector3.forward;
                q.transform.localPosition = dir * (9 + i % 3 * 4) + Vector3.up * 8f;
                q.transform.localRotation = Quaternion.LookRotation(dir) * Quaternion.Euler(0, 0, -22);
            }

            Particles("Fireflies", new Vector3(0, 1.8f, 4), Quaternion.identity, ParticleSystemShapeType.Sphere, Vector3.one, 12f,
                SP.Soft(SP.Dot, Color.white, true), 10, 120, 8f, 0.05f, 0.06f, 0.14f, new Color(0.95f, 1f, 0.6f, 0.9f), noise: 0.35f);
            Particles("Pollen", new Vector3(0, 2.5f, 0), Quaternion.identity, ParticleSystemShapeType.Sphere, Vector3.one, 18f,
                SP.Soft(SP.Dot, Color.white, true), 25, 300, 10f, 0.03f, 0.02f, 0.05f, new Color(1f, 1f, 0.9f, 0.5f), noise: 0.2f);

            AddSynth(new NoiseVoice(31) { color = 1, cutoff = 0.035f, swellPeriod = 13f, swellDepth = 0.55f, gain = 1f }, 0.4f);
            AddSynth(new NoiseVoice(32) { color = 0, cutoff = 0.22f, swellPeriod = 6f, swellDepth = 0.7f, swellShape = 3f, gain = 0.5f }, 0.12f);
            AddSynth(new NoiseVoice(33) { color = 1, cutoff = 0.3f, gain = 0.5f }, 0.14f, new Vector3(-9, 0, 7), 0.8f);
            AddSynth(new BirdVoice(34) { density = 0.14f }, 1f);
            AddSynth(new BirdVoice(35) { density = 0.06f, gain = 0.05f }, 1f, new Vector3(12, 6, 10), 0.7f);
        }

        void BuildRain()
        {
            var wood = new Color(0.33f, 0.24f, 0.17f);
            var dark = new Color(0.17f, 0.13f, 0.11f);
            for (int i = 0; i < 10; i++)
            {
                float x = -3f + i * 0.6f + 0.3f;
                var tone = Color.Lerp(wood, dark, (i * 37 % 10) / 25f);
                SP.Box(transform, new Vector3(x, -0.06f, -0.2f), new Vector3(0.57f, 0.12f, 6.4f), SP.Flat(tone, 0.6f));
            }
            var beamMat = SP.Flat(dark, 0.6f);
            SP.Box(transform, new Vector3(0, 3.05f, -0.4f), new Vector3(7.2f, 0.14f, 7.2f), beamMat);
            SP.Box(transform, new Vector3(0, 2.85f, 3.0f), new Vector3(7f, 0.28f, 0.22f), beamMat);
            foreach (var x in new[] { -2.9f, 2.9f })
            {
                SP.Box(transform, new Vector3(x, 1.45f, 2.95f), new Vector3(0.18f, 2.9f, 0.18f), beamMat);
                SP.Box(transform, new Vector3(x, 0.95f, -0.2f), new Vector3(0.07f, 0.07f, 6.2f), beamMat);
            }
            SP.Box(transform, new Vector3(0, 0.95f, 2.95f), new Vector3(5.8f, 0.07f, 0.07f), beamMat);
            SP.Box(transform, new Vector3(0, 0.45f, 2.95f), new Vector3(5.8f, 0.05f, 0.05f), beamMat);
            SP.Box(transform, new Vector3(0, 1.5f, -3.45f), new Vector3(7f, 3.1f, 0.2f), SP.Flat(new Color(0.26f, 0.19f, 0.14f), 0.55f));
            var glow = SP.Soft(SP.RoundRect(1.2f, 0.06f, new Color(1f, 0.8f, 0.5f, 0.85f), new Color(1f, 0.6f, 0.3f, 0.7f), "window"), Color.white, false);
            var win = SP.Quad("Window", transform, glow, new Vector2(1.3f, 1.1f));
            win.transform.localPosition = new Vector3(1.4f, 1.6f, -3.33f);
            win.transform.localRotation = Quaternion.Euler(0, 180, 0);
            var halo = SP.Quad("WindowHalo", transform, SP.Soft(SP.Dot, new Color(1f, 0.7f, 0.4f, 0.25f), true), new Vector2(3.5f, 3f));
            halo.transform.localPosition = new Vector3(1.4f, 1.6f, -3.3f);

            SP.Box(transform, new Vector3(0, -0.2f, 0), new Vector3(400, 0.1f, 400), SP.Flat(new Color(0.15f, 0.19f, 0.15f), 0.7f));
            Trees(70, 18f, 90f, 41, -0.55f, 0.55f);
            SP.MeshObject("Hills", transform, SP.HillRing(170f, -2f, 8f, 26f, 96, 9), SP.Flat(new Color(0.16f, 0.2f, 0.2f), 0.9f));

            var rainMat = SP.Soft(SP.Dot, new Color(0.78f, 0.84f, 0.95f, 0.45f), false);
            Particles("Rain", new Vector3(0, 13f, 22f), Quaternion.Euler(90, 0, 0), ParticleSystemShapeType.Box, new Vector3(60, 36, 1), 0,
                rainMat, 2600, 4500, 1.3f, 13f, 0.025f, 0.035f, Color.white, stretch: true, velScale: 0.045f, fade: false);
            Particles("RoofDrips", new Vector3(0, 2.75f, 3.15f), Quaternion.Euler(90, 0, 0), ParticleSystemShapeType.Box, new Vector3(7, 0.1f, 0.1f), 0,
                rainMat, 45, 120, 1.0f, 1f, 0.03f, 0.04f, Color.white, stretch: true, velScale: 0.06f, gravity: 1f, fade: false);
            Particles("Mist", new Vector3(0, 0.5f, 30f), Quaternion.identity, ParticleSystemShapeType.Box, new Vector3(80, 1, 40), 0,
                SP.Soft(SP.Dot, Color.white, false), 4, 60, 14f, 0.3f, 8f, 16f, new Color(0.6f, 0.65f, 0.72f, 0.12f));

            AddSynth(new NoiseVoice(51) { color = 1, cutoff = 0.5f, gain = 0.9f, width = 0.9f }, 0.5f);
            AddSynth(new NoiseVoice(52) { color = 0, cutoff = 0.12f, swellPeriod = 20f, swellDepth = 0.3f, gain = 1f }, 0.35f);
            AddSynth(new DripVoice(53) { density = 0.9f }, 1f);
            _thunder = new ThunderVoice(54);
            AddSynth(_thunder, 0.9f);
        }

        void UpdateStorm()
        {
            float t = Time.time;
            _nextLightning -= Time.deltaTime;
            if (_nextLightning <= 0)
            {
                _nextLightning = Random.Range(25f, 55f);
                _flash = 1f;
                _thunderAt = t + Random.Range(1.2f, 3.5f);
            }
            if (_thunderAt > 0 && t >= _thunderAt) { _thunder.Trigger(); _thunderAt = -1; }
            _flash = Mathf.MoveTowards(_flash, 0, Time.deltaTime * 2.2f);
            float flicker = _flash > 0 ? _flash * (0.6f + 0.4f * Mathf.Sin(t * 47f)) : 0;
            _skyMat.SetFloat("_Flash", flicker * 0.6f);
        }

        void BuildStars()
        {
            SP.Box(transform, new Vector3(0, -0.05f, 0), new Vector3(600, 0.1f, 600), SP.Flat(new Color(0.03f, 0.035f, 0.05f), 0.8f));
            SP.MeshObject("Hills", transform, SP.HillRing(150f, -2f, 5f, 20f, 128, 12), SP.Flat(new Color(0.015f, 0.02f, 0.035f), 1f));
            SP.MeshObject("FarHills", transform, SP.HillRing(260f, -2f, 14f, 40f, 128, 13), SP.Flat(new Color(0.03f, 0.04f, 0.07f), 1f));

            _starRoot = new GameObject("StarField").transform;
            _starRoot.SetParent(transform, false);
            _starRoot.localRotation = Quaternion.Euler(-20, 0, 25);
            var starMat = SP.Soft(SP.Dot, Color.white, true);
            SP.MeshObject("Stars", _starRoot, StarMesh(2600, 380f, 61, false), starMat);
            SP.MeshObject("MilkyWay", _starRoot, StarMesh(4200, 375f, 62, true), starMat);
            var glow = SP.Quad("BandGlow", _starRoot, SP.Soft(SP.Dot, new Color(0.45f, 0.45f, 0.75f, 0.10f), true), new Vector2(160, 900));
            glow.transform.localPosition = new Vector3(0, 0, 0);
            glow.transform.localRotation = Quaternion.Euler(0, 90, 0);
            glow.SetActive(false); // looks better as stars only on phones; enable to taste

            _shootingMat = SP.Soft(SP.Dot, new Color(0.9f, 0.95f, 1f, 0f), true);
            _shooting = SP.Quad("ShootingStar", transform, _shootingMat, new Vector2(30f, 0.7f)).transform;
            _shooting.gameObject.SetActive(false);

            Particles("Fireflies", new Vector3(0, 1.2f, 6), Quaternion.identity, ParticleSystemShapeType.Sphere, Vector3.one, 14f,
                SP.Soft(SP.Dot, Color.white, true), 4, 50, 9f, 0.05f, 0.05f, 0.1f, new Color(0.8f, 1f, 0.6f, 0.8f), noise: 0.3f);

            AddSynth(new PadVoice(71, 110f, 164.81f, 246.94f, 277.18f) { gain = 0.10f }, 0.85f);
            AddSynth(new CricketVoice(72), 1f, new Vector3(-10, 0, 6), 0.8f);
            AddSynth(new CricketVoice(73), 0.8f, new Vector3(12, 0, -4), 0.8f);
            AddSynth(new NoiseVoice(74) { color = 2, cutoff = 0.04f, swellPeriod = 19f, swellDepth = 0.5f, gain = 0.6f }, 0.25f);
        }

        void UpdateStars()
        {
            _starRoot.Rotate(new Vector3(0.2f, 1f, 0.1f).normalized, 0.25f * Time.deltaTime, Space.World);
            if (_shootT < 0)
            {
                _nextShooting -= Time.deltaTime;
                if (_nextShooting <= 0)
                {
                    _nextShooting = Random.Range(14f, 35f);
                    _shootT = 0;
                    float yaw = Random.Range(-60f, 60f), pitch = Random.Range(25f, 55f);
                    var a = Quaternion.Euler(-pitch, yaw, 0) * Vector3.forward * 300f;
                    var b = Quaternion.Euler(-pitch + Random.Range(-15f, -6f), yaw + Random.Range(-25f, 25f), 0) * Vector3.forward * 300f;
                    _shootFrom = a; _shootTo = b;
                    _shooting.gameObject.SetActive(true);
                }
                return;
            }
            _shootT += Time.deltaTime / 0.9f;
            var pos = Vector3.Lerp(_shootFrom, _shootTo, _shootT);
            var dir = (_shootTo - _shootFrom).normalized;
            _shooting.localPosition = pos;
            _shooting.localRotation = Quaternion.LookRotation(pos.normalized, Vector3.Cross(pos.normalized, dir));
            _shootingMat.SetColor("_Color", new Color(0.9f, 0.95f, 1f, Mathf.Sin(Mathf.Clamp01(_shootT) * Mathf.PI) * 0.9f));
            if (_shootT >= 1) { _shootT = -1; _shooting.gameObject.SetActive(false); }
        }

        void BuildWaterfall()
        {
            var water = SP.Mat("Stillpoint/Water");
            water.SetColor("_Deep", new Color(0.07f, 0.20f, 0.20f));
            water.SetColor("_Spec", new Color(1f, 1f, 0.95f));
            water.SetFloat("_WaveScale", 0.22f);
            water.SetFloat("_Speed", 1.6f);
            var pool = SP.MeshObject("Pool", transform, SP.Grid(140f, 70), water);
            pool.transform.localPosition = new Vector3(0, -0.45f, 10f);

            var stone = new[] { new Color(0.34f, 0.36f, 0.34f), new Color(0.28f, 0.32f, 0.28f), new Color(0.38f, 0.38f, 0.35f) };
            var moss = SP.Flat(new Color(0.24f, 0.36f, 0.22f), 0.6f);
            SP.Box(transform, new Vector3(0, -0.35f, -0.5f), new Vector3(3.4f, 0.7f, 3.4f), SP.Flat(stone[0], 0.6f), 12);
            SP.Box(transform, new Vector3(0, -0.4f, -4f), new Vector3(30, 0.8f, 6f), moss);

            var rng = new System.Random(81);
            // cliff wall
            for (int i = 0; i < 13; i++)
            {
                float x = -48 + i * 8f;
                if (Mathf.Abs(x) < 3.5f) x += Mathf.Sign(x == 0 ? 1 : x) * 4f;
                float h = 22 + (float)rng.NextDouble() * 12;
                var m = SP.Flat(stone[i % 3], 0.55f);
                SP.Box(transform, new Vector3(x, h / 2 - 1, 31 + (float)rng.NextDouble() * 4 + Mathf.Abs(x) * 0.15f),
                    new Vector3(9, h, 6 + (float)rng.NextDouble() * 4), m, (float)rng.NextDouble() * 16 - 8);
            }
            SP.Box(transform, new Vector3(0, 9, 33f), new Vector3(10, 20, 4), SP.Flat(stone[1] * 0.8f, 0.55f));
            SP.Box(transform, new Vector3(0, 27, 34f), new Vector3(18, 6, 8), moss);
            for (int i = 0; i < 18; i++)
            {
                float ang = (float)rng.NextDouble() * 140 - 70;
                var dir = Quaternion.Euler(0, ang, 0) * Vector3.forward;
                var pos = dir * (5 + (float)rng.NextDouble() * 18) + Vector3.down * 0.4f;
                var s = Vector3.one * (0.6f + (float)rng.NextDouble() * 2.2f);
                SP.Box(transform, pos, s, (i % 3 == 0) ? moss : SP.Flat(stone[i % 3], 0.6f), (float)rng.NextDouble() * 90);
            }
            Trees(60, 12f, 70f, 82, -1f, 1f, frontGap: 40f);
            SP.MeshObject("Hills", transform, SP.HillRing(160f, -2f, 20f, 45f, 96, 8), SP.Flat(new Color(0.30f, 0.42f, 0.36f), 0.9f));

            // the falls
            var sheet = SP.Soft(SP.RoundRect(0.25f, 0.02f, new Color(0.92f, 0.97f, 1f, 0.55f), new Color(0.85f, 0.92f, 0.95f, 0.75f), "falls"), Color.white, false);
            var sq = SP.Quad("FallsSheet", transform, sheet, new Vector2(5.5f, 25f));
            sq.transform.localPosition = new Vector3(0, 11.5f, 30.6f);
            var fallMat = SP.Soft(SP.Dot, new Color(0.95f, 0.98f, 1f, 0.5f), false);
            Particles("Falls", new Vector3(0, 24f, 30.2f), Quaternion.Euler(90, 0, 0), ParticleSystemShapeType.Box, new Vector3(5.5f, 0.6f, 0.3f), 0,
                fallMat, 1400, 3200, 1.8f, 2f, 0.25f, 0.4f, Color.white, stretch: true, velScale: 0.07f, gravity: 1.5f, fade: false);
            Particles("Spray", new Vector3(0, 0.3f, 29f), Quaternion.identity, ParticleSystemShapeType.Sphere, Vector3.one, 2.5f,
                SP.Soft(SP.Dot, Color.white, false), 30, 200, 5f, 0.8f, 3f, 7f, new Color(0.95f, 0.98f, 1f, 0.16f), noise: 0.4f);
            Particles("Motes", new Vector3(0, 2f, 10f), Quaternion.identity, ParticleSystemShapeType.Sphere, Vector3.one, 14f,
                SP.Soft(SP.Dot, Color.white, true), 15, 150, 9f, 0.04f, 0.03f, 0.07f, new Color(1f, 1f, 0.9f, 0.5f), noise: 0.25f);

            var fallsPos = new Vector3(0, 3, 29);
            AddSynth(new NoiseVoice(91) { color = 1, cutoff = 0.32f, gain = 1f, width = 0.8f }, 0.95f, fallsPos, 0.6f);
            AddSynth(new NoiseVoice(92) { color = 0, cutoff = 0.6f, swellPeriod = 4f, swellDepth = 0.25f, gain = 0.6f }, 0.18f, fallsPos, 0.6f);
            AddSynth(new NoiseVoice(93) { color = 2, cutoff = 0.08f, gain = 1f }, 0.45f);
            AddSynth(new BirdVoice(94) { density = 0.06f }, 0.8f);
        }

        // ------------------------------------------------------------------
        // Building blocks
        // ------------------------------------------------------------------

        static Mesh _trunk, _canopy;

        /// <summary>Stylised pines merged into one mesh per colour. Angles in -1..1 (fraction of 180°) restrict placement.</summary>
        void Trees(int count, float minR, float maxR, int seed, float angMin, float angMax, float frontGap = 0f)
        {
            if (_trunk == null) { _trunk = SP.Cone(1f, 0.6f, 1f, 7); _canopy = SP.Cone(1f, 0f, 1f, 9); }
            var rng = new System.Random(seed);
            var trunks = new List<CombineInstance>();
            var greens = new[] { new List<CombineInstance>(), new List<CombineInstance>(), new List<CombineInstance>() };
            for (int i = 0; i < count; i++)
            {
                float ang = Mathf.Lerp(angMin, angMax, (float)rng.NextDouble()) * 180f;
                if (frontGap > 0 && Mathf.Abs(Mathf.DeltaAngle(ang, 0)) < frontGap) continue;
                float r = Mathf.Lerp(minR, maxR, Mathf.Pow((float)rng.NextDouble(), 0.7f));
                var pos = Quaternion.Euler(0, ang, 0) * Vector3.forward * r;
                float h = 6f + (float)rng.NextDouble() * 9f;
                float w = h * (0.22f + (float)rng.NextDouble() * 0.06f);
                trunks.Add(new CombineInstance { mesh = _trunk, transform = Matrix4x4.TRS(pos, Quaternion.identity, new Vector3(w * 0.12f, h * 0.45f, w * 0.12f)) });
                var g = greens[rng.Next(3)];
                for (int k = 0; k < 3; k++)
                {
                    float y = h * (0.22f + k * 0.2f);
                    float cr = w * (1f - k * 0.25f);
                    g.Add(new CombineInstance { mesh = _canopy, transform = Matrix4x4.TRS(pos + Vector3.up * y, Quaternion.Euler(0, (float)rng.NextDouble() * 90, 0), new Vector3(cr, h * (0.5f - k * 0.08f), cr)) });
                }
            }
            Merge("Trunks", trunks, SP.Flat(new Color(0.28f, 0.20f, 0.15f), 0.6f));
            Merge("PinesA", greens[0], SP.Flat(new Color(0.10f, 0.26f, 0.17f), 0.5f));
            Merge("PinesB", greens[1], SP.Flat(new Color(0.14f, 0.31f, 0.18f), 0.5f));
            Merge("PinesC", greens[2], SP.Flat(new Color(0.08f, 0.21f, 0.16f), 0.5f));
        }

        void Merge(string name, List<CombineInstance> parts, Material mat)
        {
            if (parts.Count == 0) return;
            var m = new Mesh { name = name, indexFormat = IndexFormat.UInt32 };
            m.CombineMeshes(parts.ToArray(), true, true);
            m.RecalculateBounds();
            SP.MeshObject(name, transform, m, mat);
        }

        static Mesh StarMesh(int count, float radius, int seed, bool band)
        {
            var rng = new System.Random(seed);
            var verts = new List<Vector3>(count * 4);
            var uvs = new List<Vector2>(count * 4);
            var cols = new List<Color32>(count * 4);
            var tris = new List<int>(count * 6);
            for (int i = 0; i < count; i++)
            {
                Vector3 d;
                if (band)
                {
                    float a = (float)rng.NextDouble() * Mathf.PI * 2f;
                    float spread = (float)(rng.NextDouble() + rng.NextDouble() + rng.NextDouble() - 1.5) * 0.18f;
                    d = new Vector3(Mathf.Cos(a), spread, Mathf.Sin(a)).normalized;
                }
                else
                {
                    d = new Vector3((float)rng.NextDouble() * 2 - 1, (float)rng.NextDouble() * 2 - 1, (float)rng.NextDouble() * 2 - 1);
                    if (d.sqrMagnitude < 0.01f) d = Vector3.up;
                    d.Normalize();
                }
                var c = d * radius;
                var right = Vector3.Cross(Mathf.Abs(d.y) > 0.95f ? Vector3.forward : Vector3.up, d).normalized;
                var up = Vector3.Cross(d, right);
                float b = Mathf.Pow((float)rng.NextDouble(), band ? 3f : 2.2f);
                float s = band ? 0.6f + b * 0.9f : 0.7f + b * 2.4f;
                int vi = verts.Count;
                verts.Add(c - right * s - up * s); verts.Add(c + right * s - up * s);
                verts.Add(c - right * s + up * s); verts.Add(c + right * s + up * s);
                uvs.Add(new Vector2(0, 0)); uvs.Add(new Vector2(1, 0)); uvs.Add(new Vector2(0, 1)); uvs.Add(new Vector2(1, 1));
                float tint = (float)rng.NextDouble();
                var col = Color.Lerp(new Color(0.75f, 0.82f, 1f), new Color(1f, 0.9f, 0.78f), tint);
                col.a = band ? 0.25f + b * 0.5f : 0.35f + b * 0.65f;
                for (int k = 0; k < 4; k++) cols.Add(col);
                tris.AddRange(new[] { vi, vi + 2, vi + 3, vi, vi + 3, vi + 1 });
            }
            var m = new Mesh { name = band ? "MilkyWay" : "Stars", indexFormat = IndexFormat.UInt32 };
            m.SetVertices(verts);
            m.SetUVs(0, uvs);
            m.SetColors(cols);
            m.SetTriangles(tris, 0);
            m.bounds = new Bounds(Vector3.zero, Vector3.one * radius * 2.2f);
            return m;
        }

        ParticleSystem Particles(string name, Vector3 pos, Quaternion rot, ParticleSystemShapeType shape, Vector3 boxScale, float radius,
            Material mat, float rate, int max, float life, float speed, float sizeMin, float sizeMax, Color color,
            bool stretch = false, float velScale = 0f, float gravity = 0f, float noise = 0f, bool fade = true)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = pos;
            go.transform.localRotation = rot;
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);

            var main = ps.main;
            main.loop = true;
            main.prewarm = true;
            main.startLifetime = life;
            main.startSpeed = speed;
            main.startSize = new ParticleSystem.MinMaxCurve(sizeMin, sizeMax);
            main.startColor = color;
            main.gravityModifier = gravity;
            main.maxParticles = max;
            main.simulationSpace = ParticleSystemSimulationSpace.World;

            var em = ps.emission;
            em.rateOverTime = rate;

            var sh = ps.shape;
            sh.enabled = true;
            sh.shapeType = shape;
            if (shape == ParticleSystemShapeType.Box) sh.scale = boxScale;
            else sh.radius = radius;

            if (fade)
            {
                var col = ps.colorOverLifetime;
                col.enabled = true;
                var g = new Gradient();
                g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                          new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(1, 0.2f), new GradientAlphaKey(1, 0.75f), new GradientAlphaKey(0, 1) });
                col.color = g;
            }

            if (noise > 0)
            {
                var n = ps.noise;
                n.enabled = true;
                n.strength = noise;
                n.frequency = 0.25f;
                n.scrollSpeed = 0.15f;
                n.quality = ParticleSystemNoiseQuality.Low;
            }

            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.Off;
            r.receiveShadows = false;
            if (stretch)
            {
                r.renderMode = ParticleSystemRenderMode.Stretch;
                r.velocityScale = velScale;
                r.lengthScale = 1f;
            }
            else r.renderMode = ParticleSystemRenderMode.Billboard;

            ps.Play();
            return ps;
        }
    }
}
