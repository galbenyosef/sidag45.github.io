using System;
using UnityEngine;

namespace Stillpoint
{
    /// <summary>World-space gaze UI pieces: cards, pills, labels.</summary>
    public static class UI
    {
        static readonly Color PillBase = new Color(0.13f, 0.13f, 0.24f, 0.62f);
        static readonly Color PillHover = new Color(0.38f, 0.36f, 0.62f, 0.92f);

        public static TextMesh Label(Transform parent, string text, float yaw, float pitch, float dist, float height, Color color, FontStyle style = FontStyle.Normal)
        {
            var root = new GameObject("Label").transform;
            root.SetParent(parent, false);
            SP.PlaceAround(root, yaw, pitch, dist);
            return SP.Text(root, text, height, color, TextAnchor.MiddleCenter, style);
        }

        public static GazeTarget Pill(Transform parent, string text, float yaw, float pitch, float dist, Vector2 size, Action onSelect, out TextMesh label, float textHeight = 0.075f)
        {
            var root = new GameObject("Pill " + text).transform;
            root.SetParent(parent, false);
            SP.PlaceAround(root, yaw, pitch, dist);
            var tex = SP.RoundRect(size.x / size.y, 0.5f, Color.white, Color.white, "pill" + Mathf.RoundToInt(size.x / size.y * 100));
            var bg = SP.Quad("Bg", root, SP.Soft(tex, PillBase, false), size);
            label = SP.Text(root, text, textHeight, Color.white);
            label.transform.localPosition = new Vector3(0, 0, -0.01f);
            var gt = root.gameObject.AddComponent<GazeTarget>();
            gt.halfSize = size * 0.5f;
            gt.tint = bg.GetComponent<Renderer>();
            gt.baseColor = PillBase;
            gt.hoverColor = PillHover;
            gt.dwell = 1.3f;
            gt.onSelect = onSelect;
            return gt;
        }

        public static GazeTarget Card(Transform parent, ScenePreset p, float yaw, float pitch, float dist, Action onSelect)
        {
            var size = new Vector2(1.05f, 1.4f);
            var root = new GameObject("Card " + p.title).transform;
            root.SetParent(parent, false);
            SP.PlaceAround(root, yaw, pitch, dist);

            var bgTex = SP.RoundRect(size.x / size.y, 0.07f, p.cardTop, p.cardBottom, "card_" + p.id);
            var bg = SP.Quad("Bg", root, SP.Soft(bgTex, new Color(0.82f, 0.82f, 0.82f, 0.9f), false), size);

            // emblem: a soft "sun" in the scene's accent colour over a horizon line
            var glow = SP.Quad("Glow", root, SP.Soft(SP.Dot, new Color(p.accent.r, p.accent.g, p.accent.b, 0.55f), true), Vector2.one * 0.7f);
            glow.transform.localPosition = new Vector3(0, 0.2f, -0.005f);
            var disc = SP.Quad("Disc", root, SP.Soft(SP.Disc, new Color(p.accent.r, p.accent.g, p.accent.b, 0.95f), false), Vector2.one * 0.2f);
            disc.transform.localPosition = new Vector3(0, 0.2f, -0.008f);
            var line = SP.Quad("Horizon", root, SP.Soft(Texture2D.whiteTexture, new Color(1, 1, 1, 0.35f), false), new Vector2(0.7f, 0.006f));
            line.transform.localPosition = new Vector3(0, 0.08f, -0.009f);

            var title = SP.Text(root, SP.Wrap(p.title, 16), 0.085f, Color.white, TextAnchor.MiddleCenter, FontStyle.Bold);
            title.transform.localPosition = new Vector3(0, -0.3f, -0.01f);
            var sub = SP.Text(root, SP.Wrap(p.subtitle, 22), 0.05f, new Color(1, 1, 1, 0.75f));
            sub.transform.localPosition = new Vector3(0, -0.5f, -0.01f);

            var gt = root.gameObject.AddComponent<GazeTarget>();
            gt.halfSize = size * 0.5f;
            gt.tint = bg.GetComponent<Renderer>();
            gt.baseColor = new Color(0.82f, 0.82f, 0.82f, 0.9f);
            gt.hoverColor = Color.white;
            gt.hoverScale = 0.07f;
            gt.dwell = 1.5f;
            gt.onSelect = onSelect;
            return gt;
        }
    }
}
