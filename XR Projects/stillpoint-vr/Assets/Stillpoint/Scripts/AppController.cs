using System;
using System.Collections;
using UnityEngine;

namespace Stillpoint
{
    /// <summary>
    /// App flow: Lobby (choose a place) → choose length → Session → Complete.
    /// Everything is built in code, so the app runs from any (even empty) scene.
    /// </summary>
    public class AppController : MonoBehaviour
    {
        CardboardRig _rig;
        GazePointer _gaze;
        Environment _env;
        Transform _ui;
        MeditationSession _session;
        bool _busy;
        enum State { Lobby, Durations, Session, Complete }
        State _state;

        ScenePreset _scene;
        int _minutes = 10;

        bool VoiceOn { get => PlayerPrefs.GetInt("sp_voice", 1) == 1; set => PlayerPrefs.SetInt("sp_voice", value ? 1 : 0); }
        bool OrbOn { get => PlayerPrefs.GetInt("sp_orb", 1) == 1; set => PlayerPrefs.SetInt("sp_orb", value ? 1 : 0); }

        void Start()
        {
            Screen.orientation = ScreenOrientation.LandscapeLeft;
            _rig = new GameObject("CardboardRig").AddComponent<CardboardRig>();
            _gaze = _rig.gameObject.AddComponent<GazePointer>();
            _gaze.rig = _rig;
            StartCoroutine(Transition(BuildLobby, 0.1f));
        }

        void Update()
        {
            if (_busy || _rig == null) return;
            if (_rig.CloseDown && _state == State.Durations) StartCoroutine(Transition(BuildLobby));
        }

        IEnumerator Transition(Action build, float fadeOut = 0.9f)
        {
            _busy = true;
            _rig.Fader.FadeTo(1f, fadeOut);
            if (_env != null) _env.FadeAudio(0f, fadeOut);
            yield return new WaitForSeconds(fadeOut + 0.05f);
            if (_env != null) Destroy(_env.gameObject);
            ClearUI();
            if (_session != null) { Destroy(_session.gameObject); _session = null; }
            yield return null;
            build();
            _rig.Recenter();
            _rig.Fader.FadeTo(0f, 1.4f);
            _busy = false;
        }

        void ClearUI()
        {
            if (_ui != null) Destroy(_ui.gameObject);
            _ui = new GameObject("UI").transform;
        }

        // ------------------------------------------------------------------
        void BuildLobby()
        {
            _state = State.Lobby;
            _env = Environment.Build(SceneLibrary.Lobby);
            _env.FadeAudio(1f, 2f);
            BuildLobbyUI();
        }

        void BuildLobbyUI()
        {
            ClearUI();
            UI.Label(_ui, "Stillpoint", 0, 22, 4.4f, 0.38f, Color.white);
            UI.Label(_ui, "Look at a place and hold your gaze to choose", 0, 16.5f, 4.4f, 0.1f, new Color(1, 1, 1, 0.65f));

            var scenes = SceneLibrary.All;
            for (int i = 0; i < scenes.Length; i++)
            {
                var p = scenes[i];
                float yaw = (i - (scenes.Length - 1) / 2f) * 26f;
                UI.Card(_ui, p, yaw, 2f, 3.4f, () => ShowDurations(p));
            }

            TextMesh voiceLabel = null, orbLabel = null;
            UI.Pill(_ui, VoiceText(), -26, -14, 3f, new Vector2(0.86f, 0.2f), () => { VoiceOn = !VoiceOn; voiceLabel.text = VoiceText(); }, out voiceLabel);
            UI.Pill(_ui, "Recenter", 0, -14, 3f, new Vector2(0.6f, 0.2f), () => _rig.Recenter(), out _);
            UI.Pill(_ui, OrbText(), 26, -14, 3f, new Vector2(0.86f, 0.2f), () => { OrbOn = !OrbOn; orbLabel.text = OrbText(); }, out orbLabel);

            UI.Label(_ui, Stats.Summary(), 0, -21.5f, 3f, 0.06f, new Color(1, 1, 1, 0.55f));
        }

        string VoiceText() => "Voice guide: " + (VoiceOn ? "On" : "Off");
        string OrbText() => "Breathing light: " + (OrbOn ? "On" : "Off");

        void ShowDurations(ScenePreset p)
        {
            _scene = p;
            _state = State.Durations;
            ClearUI();
            UI.Label(_ui, p.title, 0, 13, 3.4f, 0.24f, Color.white);
            UI.Label(_ui, "How long would you like to sit?", 0, 8f, 3.4f, 0.09f, new Color(1, 1, 1, 0.7f));
            int[] lengths = { 5, 10, 20 };
            for (int i = 0; i < lengths.Length; i++)
            {
                int m = lengths[i];
                UI.Pill(_ui, m + " min", (i - 1) * 19f, 0, 3f, new Vector2(0.7f, 0.32f), () => { _minutes = m; StartCoroutine(Transition(BuildSession)); }, out _, 0.1f);
            }
            UI.Pill(_ui, "Back", 0, -13, 3f, new Vector2(0.5f, 0.18f), BuildLobbyUI2, out _);
        }

        void BuildLobbyUI2() { _state = State.Lobby; BuildLobbyUI(); }

        void BuildSession()
        {
            _state = State.Session;
            _env = Environment.Build(_scene);
            _env.FadeAudio(1f, 3f);
            _session = new GameObject("Session").AddComponent<MeditationSession>();
            _session.preset = _scene;
            _session.minutes = _minutes;
            _session.voice = VoiceOn;
            _session.orbOn = OrbOn;
            _session.rig = _rig;
            _session.gaze = _gaze;
            _session.env = _env;
            _session.onFinished = OnSessionFinished;
        }

        void OnSessionFinished(bool completed)
        {
            if (!completed)
            {
                StartCoroutine(Transition(BuildLobby));
                return;
            }
            Stats.Record(_minutes);
            StartCoroutine(ShowComplete());
        }

        IEnumerator ShowComplete()
        {
            _state = State.Complete;
            yield return new WaitForSeconds(1.2f);
            if (_session != null) { Destroy(_session.gameObject); _session = null; }
            ClearUI();
            UI.Label(_ui, "Session complete", 0, 10, 3.2f, 0.2f, Color.white);
            UI.Label(_ui, _minutes + " minutes of stillness  ·  " + Stats.StreakText(), 0, 5f, 3.2f, 0.08f, new Color(1, 1, 1, 0.7f));
            UI.Pill(_ui, "Sit again", -14, -3, 3f, new Vector2(0.7f, 0.22f), () => StartCoroutine(Transition(BuildSession)), out _);
            UI.Pill(_ui, "Back to lobby", 14, -3, 3f, new Vector2(0.8f, 0.22f), () => StartCoroutine(Transition(BuildLobby)), out _);
        }
    }

    /// <summary>Local progress: total sessions, minutes and daily streak.</summary>
    public static class Stats
    {
        public static void Record(int minutes)
        {
            PlayerPrefs.SetInt("sp_sessions", PlayerPrefs.GetInt("sp_sessions", 0) + 1);
            PlayerPrefs.SetInt("sp_minutes", PlayerPrefs.GetInt("sp_minutes", 0) + minutes);
            var today = DateTime.Now.Date;
            var last = PlayerPrefs.GetString("sp_last", "");
            int streak = PlayerPrefs.GetInt("sp_streak", 0);
            if (DateTime.TryParse(last, out var lastDay))
            {
                int gap = (today - lastDay.Date).Days;
                if (gap == 1) streak++;
                else if (gap > 1) streak = 1;
                else if (streak == 0) streak = 1;
            }
            else streak = 1;
            PlayerPrefs.SetInt("sp_streak", streak);
            PlayerPrefs.SetString("sp_last", today.ToString("yyyy-MM-dd"));
            PlayerPrefs.Save();
        }

        public static string StreakText()
        {
            int s = PlayerPrefs.GetInt("sp_streak", 0);
            return s <= 1 ? "day 1 of your streak" : s + "-day streak";
        }

        public static string Summary()
        {
            int n = PlayerPrefs.GetInt("sp_sessions", 0);
            if (n == 0) return "Your first session is waiting";
            int m = PlayerPrefs.GetInt("sp_minutes", 0);
            return n + (n == 1 ? " session" : " sessions") + "  ·  " + m + " minutes  ·  " + StreakText();
        }
    }

    public static class Boot
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Init()
        {
#if UNITY_2023_1_OR_NEWER
            var existing = UnityEngine.Object.FindFirstObjectByType<AppController>();
#else
            var existing = UnityEngine.Object.FindObjectOfType<AppController>();
#endif
            if (existing == null) new GameObject("Stillpoint").AddComponent<AppController>();
        }
    }
}
