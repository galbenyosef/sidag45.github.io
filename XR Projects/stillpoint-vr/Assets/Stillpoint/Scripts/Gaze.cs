using System;
using System.Collections.Generic;
using UnityEngine;

namespace Stillpoint
{
    /// <summary>Something you can select by looking at it (dwell) or by tapping while looking at it.</summary>
    public class GazeTarget : MonoBehaviour
    {
        public static readonly List<GazeTarget> All = new List<GazeTarget>();

        public Vector2 halfSize = new Vector2(0.5f, 0.5f);   // world units, in the target's local XY plane
        public float dwell = 1.4f;
        public Action onSelect;
        public Renderer tint;
        public Color baseColor = Color.white, hoverColor = Color.white;
        public float hoverScale = 0.06f;

        [NonSerialized] public bool hovered;
        float _h;
        Vector3 _baseScale;

        void Awake() { _baseScale = transform.localScale; }
        void OnEnable() { All.Add(this); }
        void OnDisable() { All.Remove(this); hovered = false; }

        public void SetBaseScale(Vector3 s) { _baseScale = s; transform.localScale = s; }

        void Update()
        {
            _h = Mathf.MoveTowards(_h, hovered ? 1f : 0f, Time.deltaTime * 6f);
            float e = _h * _h * (3f - 2f * _h);
            transform.localScale = _baseScale * (1f + hoverScale * e);
            if (tint != null) tint.material.SetColor("_Color", Color.Lerp(baseColor, hoverColor, e));
        }

        /// <summary>Ray vs. oriented rectangle. Returns distance or -1.</summary>
        public float Hit(Vector3 origin, Vector3 dir)
        {
            Vector3 n = transform.forward;
            float denom = Vector3.Dot(dir, n);
            if (Mathf.Abs(denom) < 1e-4f) return -1;
            float t = Vector3.Dot(transform.position - origin, n) / denom;
            if (t <= 0) return -1;
            Vector3 local = Quaternion.Inverse(transform.rotation) * (origin + dir * t - transform.position);
            float scale = 1f + hoverScale * _h;
            return Mathf.Abs(local.x) <= halfSize.x * scale && Mathf.Abs(local.y) <= halfSize.y * scale ? t : -1;
        }
    }

    /// <summary>Head-gaze pointer with a dwell ring reticle.</summary>
    public class GazePointer : MonoBehaviour
    {
        public CardboardRig rig;
        /// <summary>True when this frame's tap was used to select a target.</summary>
        public bool ConsumedTrigger { get; private set; }
        public GazeTarget Current { get; private set; }

        Transform _reticle;
        Material _ringMat, _dotMat;
        float _progress, _cooldown, _dist = 3f, _visible = 1f;
        GazeTarget _lockedOut;

        void Start()
        {
            _reticle = new GameObject("Reticle").transform;
            _reticle.SetParent(rig.Head, false);
            _dotMat = SP.Soft(SP.Disc, new Color(1, 1, 1, 0.85f), false, true);
            _ringMat = SP.Ring(new Color(1f, 1f, 1f, 0.95f), new Color(1, 1, 1, 0.0f), 0.30f, 0.46f, true);
            var dot = SP.Quad("Dot", _reticle, _dotMat, Vector2.one * 0.25f);
            dot.transform.localPosition = Vector3.zero;
            SP.Quad("Ring", _reticle, _ringMat, Vector2.one);
        }

        void Update()
        {
            ConsumedTrigger = false;
            var origin = rig.Head.position;
            var dir = rig.Head.forward;

            GazeTarget best = null;
            float bestT = float.MaxValue;
            foreach (var t in GazeTarget.All)
            {
                if (!t.isActiveAndEnabled) continue;
                float d = t.Hit(origin, dir);
                if (d > 0 && d < bestT) { best = t; bestT = d; }
            }

            if (best != Current)
            {
                if (Current != null) Current.hovered = false;
                Current = best;
                _progress = 0;
                if (_lockedOut != null && _lockedOut != best) _lockedOut = null;
            }
            if (Current != null) Current.hovered = true;

            _cooldown -= Time.deltaTime;
            bool canSelect = Current != null && _cooldown <= 0 && Current != _lockedOut;
            if (canSelect)
            {
                _progress += Time.deltaTime / Mathf.Max(0.1f, Current.dwell);
                if (rig.TriggerDown) { ConsumedTrigger = true; _progress = 1f; }
                if (_progress >= 1f) Select(Current);
            }
            else _progress = 0;

            // Reticle sits on whatever we look at, constant angular size.
            float targetDist = Current != null ? Mathf.Clamp(bestT - 0.02f, 0.5f, 20f) : 3f;
            _dist = Mathf.Lerp(_dist, targetDist, 1f - Mathf.Exp(-Time.deltaTime * 18f));
            _visible = Mathf.MoveTowards(_visible, Current != null ? 1f : 0.45f, Time.deltaTime * 4f);
            _reticle.localPosition = new Vector3(0, 0, _dist);
            float size = _dist * 0.018f * (Current != null ? 1.6f : 1f);
            _reticle.localScale = Vector3.one * size * 2.2f;
            _ringMat.SetFloat("_Fill", Current != null ? Mathf.Clamp01(_progress) : 0f);
            _ringMat.SetColor("_BaseColor", new Color(1, 1, 1, Current != null ? 0.25f : 0f));
            _dotMat.SetColor("_Color", new Color(1, 1, 1, 0.85f * _visible));
        }

        void Select(GazeTarget t)
        {
            _progress = 0;
            _cooldown = 0.6f;
            _lockedOut = t;  // must look away before re-selecting the same target
            Sfx.Click();
            t.onSelect?.Invoke();
        }
    }

    /// <summary>Tiny UI click sound.</summary>
    public static class Sfx
    {
        static AudioSource _src;
        static AudioClip _click;

        static void Ensure()
        {
            if (_src == null)
            {
                var go = new GameObject("Sfx");
                UnityEngine.Object.DontDestroyOnLoad(go);
                _src = go.AddComponent<AudioSource>();
                _src.spatialBlend = 0;
            }
        }

        public static void Click()
        {
            Ensure();
            if (_click == null)
            {
                int rate = AudioSettings.outputSampleRate > 0 ? AudioSettings.outputSampleRate : 48000;
                int n = rate / 6;
                var d = new float[n];
                for (int i = 0; i < n; i++)
                {
                    float t = (float)i / rate;
                    d[i] = (Mathf.Sin(2 * Mathf.PI * 880f * t) * 0.6f + Mathf.Sin(2 * Mathf.PI * 1320f * t) * 0.3f) * Mathf.Exp(-t * 28f) * Mathf.Clamp01(t * 400f) * 0.25f;
                }
                _click = AudioClip.Create("Click", n, 1, rate, false);
                _click.SetData(d, 0);
            }
            _src.PlayOneShot(_click, 0.8f);
        }

        public static void Bowl(float volume = 0.9f)
        {
            Ensure();
            _src.PlayOneShot(Chime.Bowl, volume);
        }
    }
}
