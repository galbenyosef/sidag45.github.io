using UnityEngine;

namespace Stillpoint
{
    public class ScenePreset
    {
        public string id, title, subtitle;
        public Color skyTop, skyHorizon, skyBottom, sunColor;
        public Vector3 sunDir = new Vector3(0, 0.1f, 1);
        public float sunSize = 900f, skyExp = 0.6f;
        public Color fog;
        public float fogStart = 20, fogEnd = 200, fogStrength = 1;
        public Color accent = new Color(1f, 0.85f, 0.65f);
        public Color cardTop, cardBottom;
    }

    public static class SceneLibrary
    {
        static Color C(float r, float g, float b) => new Color(r, g, b, 1);

        public static readonly ScenePreset Lobby = new ScenePreset
        {
            id = "lobby", title = "Stillpoint",
            skyTop = C(0.03f, 0.04f, 0.10f), skyHorizon = C(0.30f, 0.20f, 0.40f), skyBottom = C(0.02f, 0.02f, 0.05f),
            sunDir = new Vector3(0, 0.03f, 1), sunColor = C(0.45f, 0.25f, 0.4f), sunSize = 60f, skyExp = 0.45f,
            fog = C(0.16f, 0.12f, 0.24f), fogStart = 30, fogEnd = 220, fogStrength = 0.9f,
            accent = C(0.85f, 0.8f, 1f)
        };

        public static readonly ScenePreset Ocean = new ScenePreset
        {
            id = "ocean", title = "Ocean at Dusk", subtitle = "Slow waves on a quiet shore",
            skyTop = C(0.10f, 0.14f, 0.36f), skyHorizon = C(0.98f, 0.60f, 0.42f), skyBottom = C(0.10f, 0.08f, 0.10f),
            sunDir = new Vector3(0, 0.035f, 1), sunColor = C(1f, 0.62f, 0.32f), sunSize = 1600f, skyExp = 0.42f,
            fog = C(0.86f, 0.56f, 0.46f), fogStart = 30, fogEnd = 260, fogStrength = 0.9f,
            accent = C(1f, 0.78f, 0.55f),
            cardTop = C(0.98f, 0.58f, 0.40f), cardBottom = C(0.16f, 0.16f, 0.40f)
        };

        public static readonly ScenePreset Forest = new ScenePreset
        {
            id = "forest", title = "Forest Glade", subtitle = "Birdsong under tall pines",
            skyTop = C(0.34f, 0.55f, 0.76f), skyHorizon = C(0.78f, 0.86f, 0.76f), skyBottom = C(0.10f, 0.15f, 0.10f),
            sunDir = new Vector3(0.4f, 0.6f, 0.7f), sunColor = C(1f, 0.95f, 0.8f), sunSize = 600f,
            fog = C(0.55f, 0.68f, 0.58f), fogStart = 6, fogEnd = 60, fogStrength = 1f,
            accent = C(0.85f, 1f, 0.7f),
            cardTop = C(0.62f, 0.80f, 0.55f), cardBottom = C(0.08f, 0.22f, 0.14f)
        };

        public static readonly ScenePreset Rain = new ScenePreset
        {
            id = "rain", title = "Rain on the Porch", subtitle = "A storm passing slowly",
            skyTop = C(0.11f, 0.13f, 0.17f), skyHorizon = C(0.33f, 0.37f, 0.43f), skyBottom = C(0.07f, 0.08f, 0.09f),
            sunDir = new Vector3(0, 1, 0), sunColor = C(0, 0, 0), sunSize = 10f,
            fog = C(0.30f, 0.34f, 0.40f), fogStart = 4, fogEnd = 75, fogStrength = 1f,
            accent = C(1f, 0.82f, 0.55f),
            cardTop = C(0.45f, 0.52f, 0.62f), cardBottom = C(0.10f, 0.12f, 0.16f)
        };

        public static readonly ScenePreset Stars = new ScenePreset
        {
            id = "stars", title = "Starry Night", subtitle = "A sky full of quiet light",
            skyTop = C(0.008f, 0.012f, 0.035f), skyHorizon = C(0.07f, 0.08f, 0.17f), skyBottom = C(0.01f, 0.01f, 0.02f),
            sunDir = new Vector3(-0.5f, 0.35f, 0.8f), sunColor = C(0.65f, 0.7f, 0.85f), sunSize = 4000f, skyExp = 0.5f,
            fog = C(0.05f, 0.06f, 0.12f), fogStart = 40, fogEnd = 300, fogStrength = 0.7f,
            accent = C(0.75f, 0.82f, 1f),
            cardTop = C(0.20f, 0.22f, 0.45f), cardBottom = C(0.02f, 0.02f, 0.06f)
        };

        public static readonly ScenePreset Waterfall = new ScenePreset
        {
            id = "waterfall", title = "Hidden Waterfall", subtitle = "Mist, stone and falling water",
            skyTop = C(0.34f, 0.55f, 0.80f), skyHorizon = C(0.80f, 0.88f, 0.90f), skyBottom = C(0.20f, 0.25f, 0.25f),
            sunDir = new Vector3(-0.3f, 0.7f, 0.6f), sunColor = C(1f, 0.97f, 0.9f), sunSize = 700f,
            fog = C(0.62f, 0.72f, 0.75f), fogStart = 10, fogEnd = 130, fogStrength = 1f,
            accent = C(0.75f, 0.95f, 1f),
            cardTop = C(0.65f, 0.85f, 0.88f), cardBottom = C(0.12f, 0.26f, 0.28f)
        };

        public static readonly ScenePreset[] All = { Ocean, Forest, Rain, Stars, Waterfall };
    }
}
