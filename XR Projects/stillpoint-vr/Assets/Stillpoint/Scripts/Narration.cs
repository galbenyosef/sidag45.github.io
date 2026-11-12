using System;
using System.Collections.Generic;
using UnityEngine;

namespace Stillpoint
{
    [Serializable]
    public class NarrationLine
    {
        public string id;
        public string anchor = "start"; // start | frac | end
        public float at;
        public float minMinutes;
        public string text;
    }

    [Serializable]
    public class NarrationScript { public NarrationLine[] lines; }

    public struct NarrationCue
    {
        public float time;
        public NarrationLine line;
        public AudioClip clip;   // null until you generate audio (captions still show)
    }

    /// <summary>
    /// Reads Assets/Resources/narration_script.json and matches each line with an
    /// AI-generated clip at Assets/Resources/Narration/&lt;id&gt; (see Tools/generate_narration.py).
    /// </summary>
    public static class Narration
    {
        public static List<NarrationCue> Schedule(float durationSeconds)
        {
            var cues = new List<NarrationCue>();
            var ta = Resources.Load<TextAsset>("narration_script");
            if (ta == null) return cues;
            NarrationScript script;
            try { script = JsonUtility.FromJson<NarrationScript>(ta.text); }
            catch (Exception e) { Debug.LogWarning("[Stillpoint] narration_script.json: " + e.Message); return cues; }
            if (script?.lines == null) return cues;

            float minutes = durationSeconds / 60f;
            foreach (var l in script.lines)
            {
                if (l == null || string.IsNullOrEmpty(l.id) || minutes + 0.01f < l.minMinutes) continue;
                float t;
                switch (l.anchor)
                {
                    case "frac": t = l.at * durationSeconds; break;
                    case "end": t = durationSeconds - l.at; break;
                    default: t = l.at; break;
                }
                if (t < 0 || t > durationSeconds - 3f) continue;
                cues.Add(new NarrationCue { time = t, line = l, clip = Resources.Load<AudioClip>("Narration/" + l.id) });
            }
            cues.Sort((a, b) => a.time.CompareTo(b.time));

            // keep lines from overlapping
            float free = 0;
            for (int i = 0; i < cues.Count; i++)
            {
                var c = cues[i];
                if (c.time < free) c.time = free;
                free = c.time + Length(c) + 4f;
                cues[i] = c;
            }
            cues.RemoveAll(c => c.time > durationSeconds - 3f);
            return cues;
        }

        public static float Length(NarrationCue c)
        {
            if (c.clip != null) return c.clip.length;
            int words = string.IsNullOrEmpty(c.line.text) ? 0 : c.line.text.Split(' ').Length;
            return 1.5f + words / 2.3f;
        }
    }
}
