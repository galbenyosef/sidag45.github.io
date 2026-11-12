using UnityEngine;

namespace Stillpoint
{
    /// <summary>
    /// Tiny procedural sound engine so every scene has ambience with zero audio assets.
    /// Drop real recordings into Assets/Resources/Audio/&lt;sceneId&gt; to override.
    /// Synth code runs inside the audio callback: no Unity API calls in Fill().
    /// </summary>
    public abstract class SynthVoice
    {
        uint _seed;
        protected SynthVoice(int seed) { _seed = (uint)(seed * 2654435761u) | 1u; }

        protected float Noise()
        {
            _seed ^= _seed << 13; _seed ^= _seed >> 17; _seed ^= _seed << 5;
            return (_seed * (1f / 4294967296f)) * 2f - 1f;
        }

        protected float Rand01() => (Noise() + 1f) * 0.5f;

        public abstract void Fill(float[] data, int channels, int rate);

        public static AudioSource Play(GameObject host, SynthVoice voice, float volume, float spatial = 0f)
        {
            int rate = AudioSettings.outputSampleRate > 0 ? AudioSettings.outputSampleRate : 48000;
            var clip = AudioClip.Create(voice.GetType().Name, rate * 4, 2, rate, true, d => voice.Fill(d, 2, rate));
            var src = host.AddComponent<AudioSource>();
            src.clip = clip;
            src.loop = true;
            src.volume = volume;
            src.spatialBlend = spatial;
            src.rolloffMode = AudioRolloffMode.Linear;
            src.minDistance = 5f;
            src.maxDistance = 120f;
            src.dopplerLevel = 0f;
            src.Play();
            return src;
        }
    }

    /// <summary>Coloured noise with low-pass and slow "swell" amplitude (surf, wind, rain, waterfall).</summary>
    public class NoiseVoice : SynthVoice
    {
        public int color;            // 0 white, 1 pink, 2 brown
        public float cutoff = 0.2f;  // one-pole low-pass coefficient 0..1
        public float swellPeriod;    // seconds, 0 = steady
        public float swellDepth;     // 0..1
        public float swellShape = 2.5f;
        public float width = 0.7f;   // stereo decorrelation
        public float gain = 1f;

        float[] _b0 = new float[2], _b1 = new float[2], _b2 = new float[2], _br = new float[2], _lp = new float[2], _lp2 = new float[2];
        double _t;
        double _phaseJitter;

        public NoiseVoice(int seed) : base(seed) { }

        public override void Fill(float[] data, int channels, int rate)
        {
            int frames = data.Length / channels;
            double dt = 1.0 / rate;
            for (int f = 0; f < frames; f++)
            {
                float env = 1f;
                if (swellPeriod > 0f)
                {
                    double ph = (_t / swellPeriod + _phaseJitter) * Mathf.PI * 2.0;
                    float s = 0.5f + 0.5f * (float)System.Math.Sin(ph);
                    env = (1f - swellDepth) + swellDepth * Mathf.Pow(s, swellShape);
                }
                float common = Noise();
                for (int c = 0; c < channels; c++)
                {
                    int k = c & 1;
                    float w = Mathf.Lerp(common, Noise(), width);
                    float x;
                    if (color == 1)
                    {
                        _b0[k] = 0.99765f * _b0[k] + w * 0.0990460f;
                        _b1[k] = 0.96300f * _b1[k] + w * 0.2965164f;
                        _b2[k] = 0.57000f * _b2[k] + w * 1.0526913f;
                        x = (_b0[k] + _b1[k] + _b2[k] + w * 0.1848f) * 0.22f;
                    }
                    else if (color == 2)
                    {
                        _br[k] = (_br[k] + 0.02f * w) / 1.02f;
                        x = _br[k] * 3.5f;
                    }
                    else x = w * 0.5f;
                    _lp[k] += cutoff * (x - _lp[k]);
                    _lp2[k] += cutoff * (_lp[k] - _lp2[k]);
                    data[f * channels + c] = _lp2[k] * env * gain;
                }
                _t += dt;
                if (swellPeriod > 0f && _t > swellPeriod * 1000) _t = 0;
            }
        }
    }

    /// <summary>Slow evolving drone pad of sine partials.</summary>
    public class PadVoice : SynthVoice
    {
        readonly float[] _freqs;
        readonly double[] _phase;
        readonly float[] _lfoRate, _lfoPh;
        double _t;
        public float gain = 0.12f;

        public PadVoice(int seed, params float[] freqs) : base(seed)
        {
            _freqs = new float[freqs.Length * 2];
            for (int i = 0; i < freqs.Length; i++) { _freqs[i * 2] = freqs[i] * 0.998f; _freqs[i * 2 + 1] = freqs[i] * 1.0025f; }
            _phase = new double[_freqs.Length];
            _lfoRate = new float[_freqs.Length];
            _lfoPh = new float[_freqs.Length];
            for (int i = 0; i < _freqs.Length; i++) { _lfoRate[i] = 0.03f + Rand01() * 0.07f; _lfoPh[i] = Rand01() * 6.28f; }
        }

        public override void Fill(float[] data, int channels, int rate)
        {
            int frames = data.Length / channels;
            double dt = 1.0 / rate;
            int n = _freqs.Length;
            for (int f = 0; f < frames; f++)
            {
                float l = 0, r = 0;
                for (int i = 0; i < n; i++)
                {
                    _phase[i] += _freqs[i] * dt;
                    if (_phase[i] > 1.0) _phase[i] -= 1.0;
                    float amp = 0.55f + 0.45f * (float)System.Math.Sin(_t * _lfoRate[i] * 6.2831853 + _lfoPh[i]);
                    float s = (float)System.Math.Sin(_phase[i] * 6.2831853) * amp;
                    if ((i & 1) == 0) l += s; else r += s;
                }
                float norm = gain / Mathf.Max(1, n / 2);
                data[f * channels] = l * norm;
                if (channels > 1) data[f * channels + 1] = r * norm;
                _t += dt;
            }
        }
    }

    /// <summary>Random birdsong chirps.</summary>
    public class BirdVoice : SynthVoice
    {
        public float density = 0.12f; // calls per second
        public float gain = 0.08f;
        int _notesLeft;
        float _noteT, _noteLen, _gap, _f0, _f1, _pan;
        double _phase;
        float _wait = 2f;

        public BirdVoice(int seed) : base(seed) { }

        public override void Fill(float[] data, int channels, int rate)
        {
            int frames = data.Length / channels;
            float dt = 1f / rate;
            for (int f = 0; f < frames; f++)
            {
                float s = 0;
                if (_notesLeft > 0)
                {
                    if (_noteT < _noteLen)
                    {
                        float p = _noteT / _noteLen;
                        float freq = Mathf.Lerp(_f0, _f1, p);
                        _phase += freq * dt;
                        float env = Mathf.Sin(p * Mathf.PI);
                        s = (float)System.Math.Sin(_phase * 6.2831853) * env * env * gain;
                    }
                    _noteT += dt;
                    if (_noteT > _noteLen + _gap)
                    {
                        _notesLeft--; _noteT = 0;
                        float baseF = _f0;
                        _f0 = baseF * (0.94f + Rand01() * 0.12f); _f1 = _f0 * (1.1f + Rand01() * 0.5f);
                    }
                }
                else
                {
                    _wait -= dt;
                    if (_wait <= 0)
                    {
                        _notesLeft = 2 + (int)(Rand01() * 5);
                        _noteLen = 0.05f + Rand01() * 0.09f;
                        _gap = 0.04f + Rand01() * 0.1f;
                        _f0 = 2200f + Rand01() * 2200f;
                        _f1 = _f0 * (1.1f + Rand01() * 0.6f);
                        _pan = Rand01();
                        _noteT = 0;
                        _wait = (0.5f + Rand01()) / Mathf.Max(0.01f, density);
                    }
                }
                data[f * channels] = s * (1f - _pan * 0.8f);
                if (channels > 1) data[f * channels + 1] = s * (0.2f + _pan * 0.8f);
            }
        }
    }

    /// <summary>Night insects: high pulsed tones.</summary>
    public class CricketVoice : SynthVoice
    {
        public float gain = 0.025f;
        double _phase, _t;
        float _freq = 4300f;
        public CricketVoice(int seed) : base(seed) { _freq = 4100f + Rand01() * 500f; }

        public override void Fill(float[] data, int channels, int rate)
        {
            int frames = data.Length / channels;
            double dt = 1.0 / rate;
            for (int f = 0; f < frames; f++)
            {
                _phase += _freq * dt;
                _t += dt;
                double cycle = _t % 1.4;
                float pulse = 0;
                if (cycle < 0.35)
                {
                    double within = (cycle * 28.0) % 1.0;
                    pulse = within < 0.5 ? (float)System.Math.Sin(within * 2 * System.Math.PI) : 0f;
                }
                float s = (float)System.Math.Sin(_phase * 6.2831853) * pulse * gain;
                data[f * channels] = s * 0.8f;
                if (channels > 1) data[f * channels + 1] = s;
                if (_t > 1400) _t = 0;
            }
        }
    }

    /// <summary>Water drips on a porch.</summary>
    public class DripVoice : SynthVoice
    {
        public float density = 0.6f;
        public float gain = 0.06f;
        float _t = -1, _f, _wait = 1, _pan;
        double _phase;
        public DripVoice(int seed) : base(seed) { }

        public override void Fill(float[] data, int channels, int rate)
        {
            int frames = data.Length / channels;
            float dt = 1f / rate;
            for (int f = 0; f < frames; f++)
            {
                float s = 0;
                if (_t >= 0)
                {
                    float freq = _f * (1f + 0.6f * Mathf.Exp(-_t * 60f));
                    _phase += freq * dt;
                    s = (float)System.Math.Sin(_phase * 6.2831853) * Mathf.Exp(-_t * 38f) * gain;
                    _t += dt;
                    if (_t > 0.25f) _t = -1;
                }
                else
                {
                    _wait -= dt;
                    if (_wait <= 0) { _t = 0; _f = 700f + Rand01() * 900f; _pan = Rand01(); _wait = (0.3f + Rand01() * 1.4f) / density; }
                }
                data[f * channels] = s * (1f - _pan * 0.7f);
                if (channels > 1) data[f * channels + 1] = s * (0.3f + _pan * 0.7f);
            }
        }
    }

    /// <summary>Distant thunder rumble, fired from the main thread via Trigger().</summary>
    public class ThunderVoice : SynthVoice
    {
        public float gain = 0.9f;
        volatile bool _trigger;
        float _t = -1, _lp, _lp2, _len = 5f;
        public ThunderVoice(int seed) : base(seed) { }
        public void Trigger() { _trigger = true; }

        public override void Fill(float[] data, int channels, int rate)
        {
            int frames = data.Length / channels;
            float dt = 1f / rate;
            for (int f = 0; f < frames; f++)
            {
                if (_trigger) { _trigger = false; _t = 0; _len = 4f + Rand01() * 3f; }
                float s = 0;
                if (_t >= 0)
                {
                    float attack = Mathf.Clamp01(_t / 0.6f);
                    float env = attack * Mathf.Exp(-_t * 5f / _len) * (0.7f + 0.3f * Mathf.Sin(_t * 3.1f) * Mathf.Sin(_t * 1.7f));
                    _lp += 0.02f * (Noise() - _lp);
                    _lp2 += 0.02f * (_lp - _lp2);
                    s = _lp2 * env * gain * 6f;
                    _t += dt;
                    if (_t > _len) _t = -1;
                }
                data[f * channels] = s;
                if (channels > 1) data[f * channels + 1] = s;
            }
        }
    }

    public static class Chime
    {
        static AudioClip _bowl;

        /// <summary>A soft singing-bowl strike, generated once.</summary>
        public static AudioClip Bowl
        {
            get
            {
                if (_bowl != null) return _bowl;
                int rate = AudioSettings.outputSampleRate > 0 ? AudioSettings.outputSampleRate : 48000;
                int len = rate * 7;
                var d = new float[len * 2];
                float f = 196f;
                float[] partials = { 1f, 2.76f, 5.40f, 8.93f };
                float[] amps = { 1f, 0.5f, 0.25f, 0.12f };
                float[] decay = { 0.45f, 0.7f, 1.2f, 1.9f };
                for (int i = 0; i < len; i++)
                {
                    float t = (float)i / rate;
                    float l = 0, r = 0;
                    for (int p = 0; p < partials.Length; p++)
                    {
                        float env = Mathf.Exp(-t * decay[p]) * Mathf.Clamp01(t * 200f);
                        float beat = 1f + 0.08f * Mathf.Sin(t * 2.2f * (p + 1));
                        l += Mathf.Sin(2f * Mathf.PI * f * partials[p] * t) * amps[p] * env * beat;
                        r += Mathf.Sin(2f * Mathf.PI * f * partials[p] * 1.002f * t) * amps[p] * env * (2f - beat);
                    }
                    d[i * 2] = l * 0.22f;
                    d[i * 2 + 1] = r * 0.22f;
                }
                _bowl = AudioClip.Create("Bowl", len, 2, rate, false);
                _bowl.SetData(d, 0);
                return _bowl;
            }
        }
    }
}
