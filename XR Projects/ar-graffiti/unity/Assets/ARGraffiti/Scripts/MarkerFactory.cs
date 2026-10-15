using UnityEngine;

namespace ARGraffiti.Phase0
{
    /// <summary>
    /// Builds the test marker out of Unity primitives, so there are no model files to manage.
    ///
    /// Marker layout (local space; origin = the X on the ground, +Z = the way it faces):
    ///   • a white cross on the ground, 60 cm across, centred on the X
    ///   • a yellow arrow on the ground pointing +Z, 80 cm long
    ///   • a 1.6 m pole on the X with a sign at head height: orange-red on the front, dark grey on the back
    /// The sign makes facing readable from any side; the cross and arrow make position and heading easy to judge
    /// against the chalk marks.
    /// </summary>
    public static class MarkerFactory
    {
        public static GameObject CreateMarker(Phase0Settings s, Transform parent)
        {
            var root = new GameObject("TestMarker");
            root.transform.SetParent(parent, false);

            var body = Mat(s.markerBody, new Color(0.96f, 0.96f, 0.94f));
            var front = Mat(s.markerFront, new Color(1f, 0.32f, 0.12f));
            var back = Mat(s.markerBack, new Color(0.18f, 0.18f, 0.2f));
            var arrow = Mat(s.markerArrow, new Color(1f, 0.84f, 0.1f));

            // Ground cross (2 cm wide bars, 4 mm thick, lifted 3 mm to avoid z-fighting with the ground).
            Box(root, "CrossNS", new Vector3(0f, 0.005f, 0f), new Vector3(0.02f, 0.004f, 0.6f), body);
            Box(root, "CrossEW", new Vector3(0f, 0.005f, 0f), new Vector3(0.6f, 0.004f, 0.02f), body);

            // Arrow along +Z.
            Box(root, "ArrowShaft", new Vector3(0f, 0.009f, 0.45f), new Vector3(0.04f, 0.004f, 0.5f), arrow);
            var head = Box(root, "ArrowHead", new Vector3(0f, 0.009f, 0.72f), new Vector3(0.14f, 0.004f, 0.14f), arrow);
            head.transform.localRotation = Quaternion.Euler(0f, 45f, 0f);

            // Pole + sign.
            var pole = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pole.name = "Pole";
            Strip(pole);
            pole.transform.SetParent(root.transform, false);
            pole.transform.localScale = new Vector3(0.035f, 0.8f, 0.035f); // cylinder is 2 units tall
            pole.transform.localPosition = new Vector3(0f, 0.8f, 0f);
            pole.GetComponent<Renderer>().sharedMaterial = body;

            Box(root, "SignFront", new Vector3(0f, 1.35f, 0.012f), new Vector3(0.36f, 0.36f, 0.012f), front);
            Box(root, "SignBack", new Vector3(0f, 1.35f, -0.004f), new Vector3(0.36f, 0.36f, 0.012f), back);

            var cap = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            cap.name = "Cap";
            Strip(cap);
            cap.transform.SetParent(root.transform, false);
            cap.transform.localScale = Vector3.one * 0.1f;
            cap.transform.localPosition = new Vector3(0f, 1.62f, 0f);
            cap.GetComponent<Renderer>().sharedMaterial = front;

            return root;
        }

        /// <summary>The aiming reticle that sits on detected ground.</summary>
        public static GameObject CreateReticle(Phase0Settings s)
        {
            var root = new GameObject("Reticle");
            var m = Mat(s.reticle, new Color(0.1f, 0.9f, 1f));
            var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ring.name = "Dot";
            Strip(ring);
            ring.transform.SetParent(root.transform, false);
            ring.transform.localScale = new Vector3(0.03f, 0.001f, 0.03f);
            ring.GetComponent<Renderer>().sharedMaterial = m;
            Box(root, "H", new Vector3(0f, 0.002f, 0f), new Vector3(0.25f, 0.002f, 0.006f), m);
            Box(root, "V", new Vector3(0f, 0.002f, 0f), new Vector3(0.006f, 0.002f, 0.25f), m);
            return root;
        }

        /// <summary>A small upright pin used to show where the tester marked the real X / facing mark.</summary>
        public static GameObject CreatePin(Phase0Settings s, string name, Vector3 position)
        {
            var root = new GameObject(name);
            root.transform.position = position;
            var m = Mat(s.measurePoint, new Color(0.95f, 0.2f, 0.85f));
            var stick = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Strip(stick);
            stick.transform.SetParent(root.transform, false);
            stick.transform.localScale = new Vector3(0.012f, 0.15f, 0.012f);
            stick.transform.localPosition = new Vector3(0f, 0.15f, 0f);
            stick.GetComponent<Renderer>().sharedMaterial = m;
            var ball = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Strip(ball);
            ball.transform.SetParent(root.transform, false);
            ball.transform.localScale = Vector3.one * 0.05f;
            ball.transform.localPosition = new Vector3(0f, 0.3f, 0f);
            ball.GetComponent<Renderer>().sharedMaterial = m;
            return root;
        }

        static GameObject Box(GameObject parent, string name, Vector3 pos, Vector3 scale, Material m)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            Strip(go);
            go.transform.SetParent(parent.transform, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = m;
            return go;
        }

        static void Strip(GameObject go)
        {
            var c = go.GetComponent<Collider>();
            if (c != null) Object.Destroy(c);
        }

        static Material Mat(Material assigned, Color fallbackColor)
        {
            if (assigned != null) return assigned;
            // Fallback only if the setup script wasn't run; these shaders may be stripped from builds.
            var shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color") ?? Shader.Find("Standard");
            var m = new Material(shader) { color = fallbackColor };
            return m;
        }
    }
}
