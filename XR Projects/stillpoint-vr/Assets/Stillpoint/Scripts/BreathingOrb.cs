using UnityEngine;

namespace Stillpoint
{
    /// <summary>A soft light that grows as you breathe in and shrinks as you breathe out.</summary>
    public class BreathingOrb : MonoBehaviour
    {
        public float inhale = 4f, holdIn = 0f, exhale = 4f, holdOut = 0f;

        Transform _core, _halo;
        Material _coreMat, _haloMat, _guideMat;
        TextMesh _label;
        Color _accent;
        float _t, _vis, _visTarget = 1f;
        int _cycles;

        public bool Visible
        {
            get => _visTarget > 0.5f;
            set => _visTarget = value ? 1f : 0f;
        }

        public void Init(Color accent)
        {
            _accent = accent;
            _haloMat = SP.Soft(SP.Dot, new Color(accent.r, accent.g, accent.b, 0.35f), true);
            _coreMat = SP.Soft(SP.Dot, new Color(1f, 1f, 1f, 0.9f), true);
            _guideMat = SP.Ring(new Color(1, 1, 1, 0), new Color(accent.r, accent.g, accent.b, 0.18f), 0.485f, 0.5f);
            _halo = SP.Quad("Halo", transform, _haloMat, Vector2.one).transform;
            _core = SP.Quad("Core", transform, _coreMat, Vector2.one).transform;
            _core.localPosition = new Vector3(0, 0, -0.01f);
            var guide = SP.Quad("Guide", transform, _guideMat, Vector2.one * 0.78f);
            guide.transform.localPosition = new Vector3(0, 0, 0.01f);
            _label = SP.Text(transform, "", 0.07f, new Color(1, 1, 1, 0));
            _label.transform.localPosition = new Vector3(0, -0.58f, -0.02f);
        }

        void Update()
        {
            _vis = Mathf.MoveTowards(_vis, _visTarget, Time.deltaTime * 0.8f);
            float cycle = inhale + holdIn + exhale + holdOut;
            _t += Time.deltaTime;
            if (_t >= cycle) { _t -= cycle; _cycles++; }

            float v; string word;
            if (_t < inhale) { v = Ease(_t / inhale); word = "Breathe in"; }
            else if (_t < inhale + holdIn) { v = 1; word = "Hold"; }
            else if (_t < inhale + holdIn + exhale) { v = 1 - Ease((_t - inhale - holdIn) / exhale); word = "Breathe out"; }
            else { v = 0; word = "Hold"; }

            float coreSize = Mathf.Lerp(0.26f, 0.62f, v);
            _core.localScale = new Vector3(coreSize, coreSize, 1);
            float haloSize = coreSize * Mathf.Lerp(2.4f, 3.1f, v);
            _halo.localScale = new Vector3(haloSize, haloSize, 1);

            float pulse = 0.55f + 0.45f * v;
            _coreMat.SetColor("_Color", new Color(1f, Mathf.Lerp(1f, _accent.g, 0.3f), Mathf.Lerp(1f, _accent.b, 0.3f), 0.9f * _vis * pulse));
            _haloMat.SetColor("_Color", new Color(_accent.r, _accent.g, _accent.b, 0.38f * _vis * pulse));
            _guideMat.SetColor("_BaseColor", new Color(_accent.r, _accent.g, _accent.b, 0.18f * _vis));

            // Words help at first, then quietly fade so they don't distract.
            float wordsAlpha = Mathf.Lerp(0.75f, 0.25f, Mathf.Clamp01(_cycles / 10f));
            float local = _t < inhale ? _t / inhale : (_t < inhale + holdIn ? 1 : Mathf.Clamp01((_t - inhale - holdIn) / Mathf.Max(0.01f, exhale)));
            float fade = Mathf.Sin(Mathf.Clamp01(local) * Mathf.PI);
            _label.text = word;
            _label.color = new Color(1, 1, 1, wordsAlpha * _vis * Mathf.Clamp01(fade * 2.5f));
        }

        static float Ease(float x)
        {
            x = Mathf.Clamp01(x);
            return 0.5f - 0.5f * Mathf.Cos(x * Mathf.PI);
        }
    }
}
