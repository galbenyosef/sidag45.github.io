using System;
using System.Collections.Generic;
using UnityEngine;

namespace Stillpoint
{
    /// <summary>One timed meditation: breathing light, AI-voiced guidance with captions, timer and end chime.</summary>
    public class MeditationSession : MonoBehaviour
    {
        public ScenePreset preset;
        public int minutes = 5;
        public bool voice = true, orbOn = true;
        public CardboardRig rig;
        public GazePointer gaze;
        public Environment env;
        public Action<bool> onFinished; // true = completed, false = ended early

        float _duration, _elapsed;
        List<NarrationCue> _cues;
        int _next;
        AudioSource _voice;
        BreathingOrb _orb;
        TextMesh _caption, _timer;
        Material _timerRing;
        float _captionAlpha, _captionTarget, _captionUntil = -1, _speakingUntil = -1;
        bool _done;
        TextMesh _tapHint;
        float _hintAlpha = 0.6f;

        public float Elapsed => _elapsed;

        void Start()
        {
            _duration = minutes * 60f;
            _cues = voice ? Narration.Schedule(_duration) : new List<NarrationCue>();

            _voice = gameObject.AddComponent<AudioSource>();
            _voice.spatialBlend = 0;
            _voice.volume = 1f;

            var orbRoot = new GameObject("BreathingOrb").transform;
            orbRoot.SetParent(transform, false);
            SP.PlaceAround(orbRoot, 0, -2, 2.6f);
            _orb = orbRoot.gameObject.AddComponent<BreathingOrb>();
            _orb.Init(preset.accent);
            _orb.Visible = orbOn;

            _caption = UI.Label(transform, "", 0, -13, 2.6f, 0.075f, new Color(1, 1, 1, 0));

            // HUD below the horizon: look down to see time left or to end.
            var ringRoot = new GameObject("TimerRing").transform;
            ringRoot.SetParent(transform, false);
            SP.PlaceAround(ringRoot, 0, -40, 2f);
            _timerRing = SP.Ring(new Color(1, 1, 1, 0.55f), new Color(1, 1, 1, 0.12f), 0.44f, 0.48f);
            SP.Quad("Ring", ringRoot, _timerRing, Vector2.one * 0.42f);
            _timer = SP.Text(ringRoot, SP.Clock(_duration), 0.075f, new Color(1, 1, 1, 0.7f));
            _timer.transform.localPosition = new Vector3(0, 0, -0.01f);
            UI.Pill(transform, "End session", 0, -55, 2f, new Vector2(0.6f, 0.16f), () => Finish(false), out _, 0.055f).dwell = 2f;
            _tapHint = UI.Label(transform, "Tap to show or hide the breathing light", 0, -47, 2f, 0.04f, new Color(1, 1, 1, 0.45f));

            Sfx.Bowl(0.8f);
        }

        void Update()
        {
            if (_done) return;
            _elapsed += Time.deltaTime;
            float left = _duration - _elapsed;

            _timer.text = SP.Clock(left);
            _timerRing.SetFloat("_Fill", Mathf.Clamp01(_elapsed / _duration));

            if (rig.TriggerDown && !gaze.ConsumedTrigger) _orb.Visible = !_orb.Visible;
            if (rig.CloseDown) { Finish(false); return; }

            // narration
            if (_next < _cues.Count && _elapsed >= _cues[_next].time)
            {
                var c = _cues[_next++];
                float len = Narration.Length(c);
                if (c.clip != null) _voice.PlayOneShot(c.clip, 1f);
                _caption.text = SP.Wrap(c.line.text, 44);
                _captionTarget = 1;
                _captionUntil = _elapsed + len + 0.6f;
                _speakingUntil = _elapsed + len;
                env?.Duck(true);
            }
            if (_captionUntil > 0 && _elapsed > _captionUntil) { _captionTarget = 0; _captionUntil = -1; }
            if (_speakingUntil > 0 && _elapsed > _speakingUntil) { env?.Duck(false); _speakingUntil = -1; }
            _captionAlpha = Mathf.MoveTowards(_captionAlpha, _captionTarget, Time.deltaTime * 1.2f);
            _caption.color = new Color(1, 1, 1, 0.85f * _captionAlpha);

            _hintAlpha = Mathf.MoveTowards(_hintAlpha, _elapsed > 30 ? 0f : 0.45f, Time.deltaTime * 0.3f);
            _tapHint.color = new Color(1, 1, 1, _hintAlpha);

            if (left <= 0) Finish(true);
        }

        void Finish(bool completed)
        {
            if (_done) return;
            _done = true;
            _orb.Visible = false;
            env?.Duck(false);
            if (completed) Sfx.Bowl(1f);
            onFinished?.Invoke(completed);
        }
    }
}
