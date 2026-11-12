using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Rendering;

namespace Stillpoint
{
    /// <summary>Shared helpers: fonts, materials, procedural textures, meshes and text.</summary>
    public static class SP
    {
        public const float EyeHeight = 1.2f;

        // ---------- Fonts & text ----------
        static Font _font;
        static Material _textMat;

        public static Font Font
        {
            get
            {
                if (_font == null)
                {
                    try { _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch { }
                    if (_font == null) { try { _font = Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch { } }
                }
                return _font;
            }
        }

        static Material TextMaterial
        {
            get
            {
                if (_textMat == null)
                {
                    _textMat = Mat("Stillpoint/Text");
                    _textMat.mainTexture = Font.material.mainTexture;
                    Font.textureRebuilt += f => { if (f == _font && _textMat != null) _textMat.mainTexture = f.material.mainTexture; };
                }
                return _textMat;
            }
        }

        public static TextMesh Text(Transform parent, string s, float lineHeight, Color c,
            TextAnchor anchor = TextAnchor.MiddleCenter, FontStyle style = FontStyle.Normal)
        {
            var go = new GameObject("Text");
            go.transform.SetParent(parent, false);
            var tm = go.AddComponent<TextMesh>();
            tm.font = Font;
            tm.fontSize = 96;
            tm.fontStyle = style;
            tm.characterSize = lineHeight * 10f / 96f;
            tm.anchor = anchor;
            tm.alignment = TextAlignment.Center;
            if (anchor == TextAnchor.MiddleLeft || anchor == TextAnchor.UpperLeft || anchor == TextAnchor.LowerLeft) tm.alignment = TextAlignment.Left;
            tm.color = c;
            tm.text = s;
            go.GetComponent<MeshRenderer>().sharedMaterial = TextMaterial;
            return tm;
        }

        /// <summary>Simple word wrap since TextMesh has none.</summary>
        public static string Wrap(string s, int maxChars)
        {
            if (string.IsNullOrEmpty(s)) return s;
            var sb = new StringBuilder();
            int line = 0;
            foreach (var word in s.Split(' '))
            {
                if (line > 0 && line + word.Length + 1 > maxChars) { sb.Append('\n'); line = 0; }
                else if (line > 0) { sb.Append(' '); line++; }
                sb.Append(word);
                line += word.Length;
            }
            return sb.ToString();
        }

        // ---------- Materials ----------
        public static Material Mat(string shaderName)
        {
            var s = Shader.Find(shaderName);
            if (s == null)
            {
                Debug.LogWarning("[Stillpoint] Shader not found: " + shaderName + " (run Stillpoint > Configure Project)");
                s = Shader.Find("Sprites/Default");
            }
            return new Material(s);
        }

        public static Material Flat(Color c, float ambient = 0.55f)
        {
            var m = Mat("Stillpoint/Flat");
            m.SetColor("_Color", c);
            m.SetFloat("_Ambient", ambient);
            return m;
        }

        public static Material Soft(Texture tex, Color c, bool additive, bool onTop = false)
        {
            var m = Mat("Stillpoint/Soft");
            m.mainTexture = tex;
            m.SetColor("_Color", c);
            m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
            m.SetFloat("_DstBlend", additive ? (float)BlendMode.One : (float)BlendMode.OneMinusSrcAlpha);
            if (onTop)
            {
                m.SetFloat("_ZTest", (float)CompareFunction.Always);
                m.renderQueue = 4000;
            }
            return m;
        }

        public static Material Ring(Color fill, Color track, float inner, float outer, bool onTop = false)
        {
            var m = Mat("Stillpoint/RingFill");
            m.SetColor("_Color", fill);
            m.SetColor("_BaseColor", track);
            m.SetFloat("_Inner", inner);
            m.SetFloat("_Outer", outer);
            if (onTop)
            {
                m.SetFloat("_ZTest", (float)CompareFunction.Always);
                m.renderQueue = 4001;
            }
            return m;
        }

        public static void SetFog(Color c, float start, float end, float strength = 1f)
        {
            Shader.SetGlobalColor("_SP_FogColor", c);
            Shader.SetGlobalVector("_SP_FogParams", new Vector4(start, end, strength, 0));
        }

        public static void SetLight(Vector3 dir)
        {
            Shader.SetGlobalVector("_SP_LightDir", dir.normalized);
        }

        // ---------- Textures ----------
        static readonly Dictionary<string, Texture2D> _texCache = new Dictionary<string, Texture2D>();

        public static Texture2D Dot
        {
            get
            {
                if (_texCache.TryGetValue("dot", out var t)) return t;
                const int n = 128;
                t = NewTex(n, n);
                var px = new Color32[n * n];
                for (int y = 0; y < n; y++)
                    for (int x = 0; x < n; x++)
                    {
                        float dx = (x + 0.5f) / n - 0.5f, dy = (y + 0.5f) / n - 0.5f;
                        float r = Mathf.Sqrt(dx * dx + dy * dy) * 2f;
                        float a = Mathf.Clamp01(1f - r);
                        a = a * a * (3f - 2f * a);
                        a = Mathf.Pow(a, 1.6f);
                        px[y * n + x] = new Color32(255, 255, 255, (byte)(a * 255));
                    }
                t.SetPixels32(px);
                t.Apply(true, true);
                _texCache["dot"] = t;
                return t;
            }
        }

        /// <summary>A crisp anti-aliased disc.</summary>
        public static Texture2D Disc
        {
            get
            {
                if (_texCache.TryGetValue("disc", out var t)) return t;
                const int n = 128;
                t = NewTex(n, n);
                var px = new Color32[n * n];
                for (int y = 0; y < n; y++)
                    for (int x = 0; x < n; x++)
                    {
                        float dx = (x + 0.5f) - n / 2f, dy = (y + 0.5f) - n / 2f;
                        float r = Mathf.Sqrt(dx * dx + dy * dy);
                        float a = Mathf.Clamp01(n / 2f - 1.5f - r + 0.5f);
                        px[y * n + x] = new Color32(255, 255, 255, (byte)(a * 255));
                    }
                t.SetPixels32(px);
                t.Apply(true, true);
                _texCache["disc"] = t;
                return t;
            }
        }

        /// <summary>Rounded rectangle with a vertical gradient (top -> bottom). Aspect = w/h.</summary>
        public static Texture2D RoundRect(float aspect, float radius, Color top, Color bottom, string key = null)
        {
            key = key ?? ("rr" + aspect + "_" + radius + top + bottom);
            if (_texCache.TryGetValue(key, out var t)) return t;
            int h = 256;
            int w = Mathf.Max(8, Mathf.RoundToInt(h * aspect));
            t = NewTex(w, h);
            float rad = radius * h;
            var px = new Color32[w * h];
            for (int y = 0; y < h; y++)
            {
                Color row = Color.Lerp(bottom, top, (y + 0.5f) / h);
                for (int x = 0; x < w; x++)
                {
                    float cx = Mathf.Clamp(x + 0.5f, rad, w - rad);
                    float cy = Mathf.Clamp(y + 0.5f, rad, h - rad);
                    float dx = x + 0.5f - cx, dy = y + 0.5f - cy;
                    float d = Mathf.Sqrt(dx * dx + dy * dy);
                    float a = Mathf.Clamp01(rad - d + 0.5f);
                    if (rad <= 0) a = 1;
                    var c = row;
                    c.a *= a;
                    px[y * w + x] = c;
                }
            }
            t.SetPixels32(px);
            t.Apply(true, true);
            _texCache[key] = t;
            return t;
        }

        static Texture2D NewTex(int w, int h)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, true);
            t.wrapMode = TextureWrapMode.Clamp;
            t.filterMode = FilterMode.Trilinear;
            t.anisoLevel = 4;
            return t;
        }

        // ---------- Meshes ----------
        static Mesh _quad, _sphere, _box;

        public static Mesh QuadMesh
        {
            get
            {
                if (_quad != null) return _quad;
                _quad = new Mesh { name = "SP_Quad" };
                _quad.vertices = new[] { new Vector3(-.5f, -.5f, 0), new Vector3(.5f, -.5f, 0), new Vector3(-.5f, .5f, 0), new Vector3(.5f, .5f, 0) };
                _quad.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1), new Vector2(1, 1) };
                _quad.colors32 = new[] { new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255) };
                _quad.normals = new[] { Vector3.back, Vector3.back, Vector3.back, Vector3.back };
                _quad.triangles = new[] { 0, 2, 3, 0, 3, 1 };
                _quad.RecalculateBounds();
                return _quad;
            }
        }

        public static Mesh SphereMesh
        {
            get
            {
                if (_sphere != null) return _sphere;
                const int lon = 48, lat = 24;
                var verts = new List<Vector3>();
                var norms = new List<Vector3>();
                var tris = new List<int>();
                for (int y = 0; y <= lat; y++)
                {
                    float v = (float)y / lat;
                    float phi = Mathf.PI * (v - 0.5f);
                    for (int x = 0; x <= lon; x++)
                    {
                        float u = (float)x / lon;
                        float th = u * Mathf.PI * 2f;
                        var p = new Vector3(Mathf.Cos(phi) * Mathf.Sin(th), Mathf.Sin(phi), Mathf.Cos(phi) * Mathf.Cos(th));
                        verts.Add(p * 0.5f);
                        norms.Add(p);
                    }
                }
                for (int y = 0; y < lat; y++)
                    for (int x = 0; x < lon; x++)
                    {
                        int a = y * (lon + 1) + x, b = a + lon + 1;
                        tris.Add(a); tris.Add(b); tris.Add(a + 1);
                        tris.Add(a + 1); tris.Add(b); tris.Add(b + 1);
                    }
                _sphere = new Mesh { name = "SP_Sphere" };
                _sphere.SetVertices(verts);
                _sphere.SetNormals(norms);
                _sphere.SetTriangles(tris, 0);
                _sphere.RecalculateBounds();
                return _sphere;
            }
        }

        public static Mesh BoxMesh
        {
            get
            {
                if (_box != null) return _box;
                var verts = new List<Vector3>();
                var norms = new List<Vector3>();
                var tris = new List<int>();
                Vector3[] dirs = { Vector3.right, Vector3.left, Vector3.up, Vector3.down, Vector3.forward, Vector3.back };
                foreach (var n in dirs)
                {
                    Vector3 a = new Vector3(n.y, n.z, n.x);
                    Vector3 b = Vector3.Cross(n, a);
                    int i = verts.Count;
                    verts.Add((n - a - b) * 0.5f); verts.Add((n + a - b) * 0.5f);
                    verts.Add((n + a + b) * 0.5f); verts.Add((n - a + b) * 0.5f);
                    for (int k = 0; k < 4; k++) norms.Add(n);
                    tris.AddRange(new[] { i, i + 1, i + 2, i, i + 2, i + 3 });
                }
                _box = new Mesh { name = "SP_Box" };
                _box.SetVertices(verts);
                _box.SetNormals(norms);
                _box.SetTriangles(tris, 0);
                _box.RecalculateBounds();
                return _box;
            }
        }

        /// <summary>Cone / truncated cone along +Y from 0 to height.</summary>
        public static Mesh Cone(float rBottom, float rTop, float height, int seg = 10)
        {
            var verts = new List<Vector3>();
            var norms = new List<Vector3>();
            var tris = new List<int>();
            float slope = (rBottom - rTop) / height;
            for (int i = 0; i <= seg; i++)
            {
                float a = i * Mathf.PI * 2f / seg;
                var dir = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a));
                var n = (dir + Vector3.up * slope).normalized;
                verts.Add(dir * rBottom); norms.Add(n);
                verts.Add(dir * rTop + Vector3.up * height); norms.Add(n);
            }
            for (int i = 0; i < seg; i++)
            {
                int a = i * 2;
                tris.AddRange(new[] { a, a + 3, a + 1, a, a + 2, a + 3 });
            }
            var m = new Mesh { name = "SP_Cone" };
            m.SetVertices(verts);
            m.SetNormals(norms);
            m.SetTriangles(tris, 0);
            m.RecalculateBounds();
            return m;
        }

        /// <summary>Flat grid on XZ centred at origin, for water.</summary>
        public static Mesh Grid(float size, int cells)
        {
            var verts = new List<Vector3>();
            var tris = new List<int>();
            for (int z = 0; z <= cells; z++)
                for (int x = 0; x <= cells; x++)
                    verts.Add(new Vector3((x / (float)cells - 0.5f) * size, 0, (z / (float)cells - 0.5f) * size));
            for (int z = 0; z < cells; z++)
                for (int x = 0; x < cells; x++)
                {
                    int a = z * (cells + 1) + x, b = a + cells + 1;
                    tris.AddRange(new[] { a, b, a + 1, a + 1, b, b + 1 });
                }
            var m = new Mesh { name = "SP_Grid" };
            if (verts.Count > 65000) m.indexFormat = IndexFormat.UInt32;
            m.SetVertices(verts);
            m.SetTriangles(tris, 0);
            m.RecalculateNormals();
            m.bounds = new Bounds(Vector3.zero, new Vector3(size, 4, size));
            return m;
        }

        /// <summary>A ring of hills around the viewer (height noise), for horizons.</summary>
        public static Mesh HillRing(float radius, float baseY, float minH, float maxH, int seg, int seed)
        {
            var rng = new System.Random(seed);
            var heights = new float[seg + 1];
            float p1 = (float)rng.NextDouble() * 10f, p2 = (float)rng.NextDouble() * 10f;
            for (int i = 0; i <= seg; i++)
            {
                float a = i * Mathf.PI * 2f / seg;
                float n = 0.5f + 0.3f * Mathf.Sin(a * 3f + p1) + 0.2f * Mathf.Sin(a * 7f + p2) + 0.08f * Mathf.Sin(a * 17f);
                heights[i] = Mathf.Lerp(minH, maxH, Mathf.Clamp01(n));
            }
            heights[seg] = heights[0];
            var verts = new List<Vector3>();
            var norms = new List<Vector3>();
            var tris = new List<int>();
            for (int i = 0; i <= seg; i++)
            {
                float a = i * Mathf.PI * 2f / seg;
                var dir = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a));
                verts.Add(dir * radius + Vector3.up * baseY); norms.Add(-dir);
                verts.Add(dir * radius + Vector3.up * (baseY + heights[i])); norms.Add((-dir + Vector3.up).normalized);
            }
            for (int i = 0; i < seg; i++)
            {
                int a = i * 2;
                tris.AddRange(new[] { a, a + 1, a + 3, a, a + 3, a + 2 });
            }
            var m = new Mesh { name = "SP_Hills" };
            m.SetVertices(verts);
            m.SetNormals(norms);
            m.SetTriangles(tris, 0);
            m.RecalculateBounds();
            return m;
        }

        // ---------- Objects ----------
        public static GameObject MeshObject(string name, Transform parent, Mesh mesh, Material mat)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.Off;
            r.receiveShadows = false;
            return go;
        }

        public static GameObject Quad(string name, Transform parent, Material mat, Vector2 size)
        {
            var go = MeshObject(name, parent, QuadMesh, mat);
            go.transform.localScale = new Vector3(size.x, size.y, 1);
            return go;
        }

        public static GameObject Box(Transform parent, Vector3 pos, Vector3 size, Material mat, float yaw = 0)
        {
            var go = MeshObject("Box", parent, BoxMesh, mat);
            go.transform.localPosition = pos;
            go.transform.localRotation = Quaternion.Euler(0, yaw, 0);
            go.transform.localScale = size;
            return go;
        }

        /// <summary>Place an object on a sphere around the eye, facing the viewer.</summary>
        public static void PlaceAround(Transform t, float yawDeg, float pitchDeg, float distance)
        {
            var eye = new Vector3(0, EyeHeight, 0);
            var dir = Quaternion.Euler(-pitchDeg, yawDeg, 0) * Vector3.forward;
            t.position = eye + dir * distance;
            t.rotation = Quaternion.LookRotation(dir, Vector3.up);
        }

        public static string Clock(float seconds)
        {
            int s = Mathf.Max(0, Mathf.CeilToInt(seconds));
            return (s / 60).ToString("00") + ":" + (s % 60).ToString("00");
        }
    }
}
