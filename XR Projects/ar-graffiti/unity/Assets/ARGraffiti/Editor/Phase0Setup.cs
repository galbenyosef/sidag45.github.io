using System.IO;
using System.Linq;
using ARGraffiti.Phase0;
using Google.XR.ARCoreExtensions;
using Unity.XR.CoreUtils;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

namespace ARGraffiti.Phase0.EditorTools
{
    /// <summary>One-click setup for the Phase 0 test app. Menu: AR Graffiti.</summary>
    public static class Phase0Setup
    {
        const string Root = "Assets/ARGraffiti";
        const string SettingsDir = Root + "/Settings";
        const string MaterialsDir = Root + "/Materials";
        const string ScenesDir = Root + "/Scenes";
        const string ScenePath = ScenesDir + "/Phase0.unity";
        const string SettingsPath = SettingsDir + "/Phase0Settings.asset";
        const string ExtConfigPath = SettingsDir + "/Phase0ExtensionsConfig.asset";
        const string CamFilterPath = SettingsDir + "/Phase0CameraConfigFilter.asset";

        // ───────────────────────────── 1. project settings ─────────────────────────────

        [MenuItem("AR Graffiti/1. Configure Project Settings", priority = 1)]
        public static void ConfigureProject()
        {
            var log = new System.Text.StringBuilder();

            // Active Input Handling = Both (Input.location needs the old system, AR camera needs the new one).
            bool needsRestart = false;
            var ps = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset").FirstOrDefault();
            if (ps != null)
            {
                var so = new SerializedObject(ps);
                var prop = so.FindProperty("activeInputHandler");
                if (prop != null && prop.intValue != 2)
                {
                    prop.intValue = 2;
                    so.ApplyModifiedProperties();
                    needsRestart = true;
                    log.AppendLine("• Active Input Handling → Both (restart Unity when asked).");
                }
            }

            PlayerSettings.iOS.cameraUsageDescription = "The camera is used to show AR markers placed in the real world.";
            PlayerSettings.iOS.locationUsageDescription = "Your precise location is used to place and find AR markers at real-world spots.";
            log.AppendLine("• iOS camera + location usage descriptions set.");

            if ((int)PlayerSettings.Android.minSdkVersion < 24)
            {
                PlayerSettings.Android.minSdkVersion = (AndroidSdkVersions)24;
                log.AppendLine("• Android minimum API level → 24.");
            }
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.forceInternetPermission = true;
            log.AppendLine("• Android: IL2CPP, ARM64, Internet access required.");

            AssetDatabase.SaveAssets();

            log.AppendLine();
            log.AppendLine("Still to do by hand (see README step 4):");
            log.AppendLine("• Project Settings > XR Plug-in Management: ARCore ticked on Android, ARKit on iOS.");
            log.AppendLine("• Project Settings > XR Plug-in Management > ARCore Extensions: Geospatial ON, iOS support ON, auth = API Key (paste your key).");

            EditorUtility.DisplayDialog("AR Graffiti — project configured", log.ToString(), "OK");
            if (needsRestart)
            {
                Debug.Log("[ARGraffiti] Active Input Handling changed — Unity needs a restart for it to take effect.");
            }
        }

        // ───────────────────────────── 2. scene ─────────────────────────────

        [MenuItem("AR Graffiti/2. Build Phase 0 Scene", priority = 2)]
        public static void BuildScene()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;

            EnsureFolder(SettingsDir);
            EnsureFolder(MaterialsDir);
            EnsureFolder(ScenesDir);

            var settings = LoadOrCreate<Phase0Settings>(SettingsPath);
            settings.markerBody = OrMake(settings.markerBody, "MarkerBody", new Color(0.96f, 0.96f, 0.94f));
            settings.markerFront = OrMake(settings.markerFront, "MarkerFront", new Color(1f, 0.32f, 0.12f));
            settings.markerBack = OrMake(settings.markerBack, "MarkerBack", new Color(0.18f, 0.18f, 0.2f));
            settings.markerArrow = OrMake(settings.markerArrow, "MarkerArrow", new Color(1f, 0.84f, 0.1f));
            settings.reticle = OrMake(settings.reticle, "Reticle", new Color(0.1f, 0.9f, 1f));
            settings.measurePoint = OrMake(settings.measurePoint, "MeasurePoint", new Color(0.95f, 0.2f, 0.85f));
            EditorUtility.SetDirty(settings);

            var extConfig = LoadOrCreate<ARCoreExtensionsConfig>(ExtConfigPath);
            extConfig.GeospatialMode = GeospatialMode.Enabled; // the app starts it disabled and turns it on once the phone reports support
            extConfig.StreetscapeGeometryMode = StreetscapeGeometryMode.Disabled;
            extConfig.CloudAnchorMode = CloudAnchorMode.Disabled;
            EditorUtility.SetDirty(extConfig);
            var camFilter = LoadOrCreate<ARCoreExtensionsCameraConfigFilter>(CamFilterPath);

            // Fresh scene.
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var light = new GameObject("Directional Light").AddComponent<Light>();
            light.type = LightType.Directional;
            light.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            Selection.activeObject = null;
            if (Object.FindFirstObjectByType<ARSession>() == null)
            {
                EditorApplication.ExecuteMenuItem("GameObject/XR/AR Session");
            }
            if (Object.FindFirstObjectByType<XROrigin>() == null)
            {
                Selection.activeObject = null;
                if (!EditorApplication.ExecuteMenuItem("GameObject/XR/XR Origin (Mobile AR)"))
                {
                    EditorApplication.ExecuteMenuItem("GameObject/XR/XR Origin (AR)");
                }
            }

            var session = Object.FindFirstObjectByType<ARSession>();
            var origin = Object.FindFirstObjectByType<XROrigin>();
            if (session == null || origin == null || origin.Camera == null)
            {
                EditorUtility.DisplayDialog("AR Graffiti — missing AR objects",
                    "Couldn't create the AR Session / XR Origin automatically.\n\n" +
                    "Make sure ARCore (Android) and ARKit (iOS) are ticked in Project Settings > XR Plug-in Management, " +
                    "then in this scene right-click the Hierarchy > XR > AR Session, and > XR > XR Origin (Mobile AR), " +
                    "save the scene as " + ScenePath + " and run this menu again with that scene open.", "OK");
                return;
            }

            origin.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
            var originGo = origin.gameObject;
            var planes = GetOrAdd<ARPlaneManager>(originGo);
            planes.requestedDetectionMode = PlaneDetectionMode.Horizontal;
            var raycast = GetOrAdd<ARRaycastManager>(originGo);
            var anchors = GetOrAdd<ARAnchorManager>(originGo);
            var earth = GetOrAdd<AREarthManager>(originGo);

            var camManager = origin.Camera.GetComponent<ARCameraManager>();
            if (camManager != null) camManager.requestedFacingDirection = CameraFacingDirection.World;

            var extGo = new GameObject("ARCore Extensions");
            var ext = extGo.AddComponent<ARCoreExtensions>();
            ext.Session = session;
            ext.Origin = origin;
            ext.CameraManager = camManager;
            ext.ARCoreExtensionsConfig = extConfig;
            ext.CameraConfigFilter = camFilter;

            var controllerGo = new GameObject("Phase0");
            var c = controllerGo.AddComponent<Phase0Controller>();
            c.settings = settings;
            c.session = session;
            c.origin = origin;
            c.raycastManager = raycast;
            c.anchorManager = anchors;
            c.earthManager = earth;
            c.arCoreExtensions = ext;

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, ScenePath);

            var others = EditorBuildSettings.scenes.Where(s => s.path != ScenePath)
                .Select(s => new EditorBuildSettingsScene(s.path, false));
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) }.Concat(others).ToArray();

            AssetDatabase.SaveAssets();
            Selection.activeObject = settings;
            EditorGUIUtility.PingObject(settings);

            var missing = string.IsNullOrWhiteSpace(settings.supabaseUrl) || string.IsNullOrWhiteSpace(settings.supabaseKey);
            EditorUtility.DisplayDialog("AR Graffiti — Phase 0 scene ready",
                "Saved " + ScenePath + " and made it the only scene in the build.\n\n" +
                (missing
                    ? "Next: paste your Supabase URL and publishable key into Phase0Settings (selected in the Inspector)."
                    : "Supabase settings are filled in. Build to two phones and head out."), "OK");
        }

        // ───────────────────────────── helpers ─────────────────────────────

        static T GetOrAdd<T>(GameObject go) where T : Component
        {
            var c = go.GetComponent<T>();
            return c != null ? c : go.AddComponent<T>();
        }

        static T LoadOrCreate<T>(string path) where T : ScriptableObject
        {
            var asset = AssetDatabase.LoadAssetAtPath<T>(path);
            if (asset != null) return asset;
            asset = ScriptableObject.CreateInstance<T>();
            AssetDatabase.CreateAsset(asset, path);
            return asset;
        }

        static Material OrMake(Material current, string name, Color color) => current != null ? current : MakeMaterial(name, color);

        static Material MakeMaterial(string name, Color color)
        {
            var path = $"{MaterialsDir}/{name}.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing != null) return existing;

            // Unlit so the marker reads clearly in bright sun; URP if the project uses it.
            var shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color") ?? Shader.Find("Standard");
            var m = new Material(shader) { name = name, color = color };
            AssetDatabase.CreateAsset(m, path);
            return m;
        }

        static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            var parent = Path.GetDirectoryName(path)?.Replace('\\', '/');
            if (!string.IsNullOrEmpty(parent) && !AssetDatabase.IsValidFolder(parent)) EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }
    }
}
