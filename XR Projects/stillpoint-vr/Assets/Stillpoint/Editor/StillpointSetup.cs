using System;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

namespace Stillpoint.EditorTools
{
    /// <summary>
    /// One-click project configuration for Google Cardboard on iPhone.
    /// Runs automatically the first time the project opens; re-run from the
    /// "Stillpoint" menu any time.
    /// </summary>
    [InitializeOnLoad]
    public static class StillpointSetup
    {
        const string ScenePath = "Assets/Stillpoint/Scenes/Stillpoint.unity";
        static readonly string[] Shaders =
        {
            "Stillpoint/GradientSky", "Stillpoint/Flat", "Stillpoint/Water", "Stillpoint/Soft",
            "Stillpoint/Text", "Stillpoint/RingFill", "Stillpoint/Video360"
        };

        static StillpointSetup()
        {
            EditorApplication.delayCall += () =>
            {
                if (File.Exists(ScenePath) || SessionState.GetBool("sp_setup_ran", false)) return;
                SessionState.SetBool("sp_setup_ran", true);
                Configure();
            };
        }

        [MenuItem("Stillpoint/Configure Project for Cardboard (iOS)")]
        public static void Configure()
        {
            CreateScene();
            ConfigurePlayer();
            IncludeShaders();
            bool xr = ConfigureXR();
            AssetDatabase.SaveAssets();
            Debug.Log("[Stillpoint] Project configured." + (xr ? "" : " Enable 'Cardboard XR Plugin' for iOS in Project Settings > XR Plug-in Management."));
        }

        [MenuItem("Stillpoint/Switch Build Target to iOS")]
        public static void SwitchToIOS()
        {
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.iOS, BuildTarget.iOS);
        }

        static void CreateScene()
        {
            if (!File.Exists(ScenePath))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                new GameObject("Stillpoint").AddComponent<AppController>();
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            else EditorSceneManager.OpenScene(ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        }

        static void ConfigurePlayer()
        {
            PlayerSettings.companyName = "Enclave Labs";
            PlayerSettings.productName = "Stillpoint";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, "com.enclavelabs.stillpoint");
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.enclavelabs.stillpoint");
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.iOS.cameraUsageDescription = "Stillpoint uses the camera once to scan your Cardboard viewer's QR code.";
            PlayerSettings.iOS.targetOSVersionString = "13.0";
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.iOS, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.iOS, new[] { GraphicsDeviceType.Metal });
            PlayerSettings.statusBarHidden = true;
        }

        static void IncludeShaders()
        {
            var gs = AssetDatabase.LoadAssetAtPath<GraphicsSettings>("ProjectSettings/GraphicsSettings.asset");
            if (gs == null) { Debug.LogWarning("[Stillpoint] Could not open GraphicsSettings."); return; }
            var so = new SerializedObject(gs);
            var arr = so.FindProperty("m_AlwaysIncludedShaders");
            foreach (var name in Shaders)
            {
                var sh = Shader.Find(name);
                if (sh == null) { Debug.LogWarning("[Stillpoint] Missing shader " + name); continue; }
                bool found = false;
                for (int i = 0; i < arr.arraySize; i++)
                    if (arr.GetArrayElementAtIndex(i).objectReferenceValue == sh) { found = true; break; }
                if (found) continue;
                arr.InsertArrayElementAtIndex(arr.arraySize);
                arr.GetArrayElementAtIndex(arr.arraySize - 1).objectReferenceValue = sh;
            }
            so.ApplyModifiedProperties();
        }

        /// <summary>Assigns the Cardboard loader for iOS + Android via reflection (no hard compile dependency on XR editor APIs).</summary>
        static bool ConfigureXR()
        {
            try
            {
                var perTargetType = FindType("UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget");
                var metadataType = FindType("UnityEditor.XR.Management.Metadata.XRPackageMetadataStore");
                var generalType = FindType("UnityEngine.XR.Management.XRGeneralSettings");
                if (perTargetType == null || metadataType == null || generalType == null) return false;

                const string key = "com.unity.xr.management.loader_settings";
                EditorBuildSettings.TryGetConfigObject(key, out UnityEngine.Object existing);
                var perTarget = existing as ScriptableObject;
                if (perTarget == null)
                {
                    perTarget = ScriptableObject.CreateInstance(perTargetType);
                    Directory.CreateDirectory("Assets/XR");
                    AssetDatabase.CreateAsset(perTarget, "Assets/XR/XRGeneralSettingsPerBuildTarget.asset");
                    EditorBuildSettings.AddConfigObject(key, perTarget, true);
                }

                const BindingFlags F = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;
                var hasSettings = perTargetType.GetMethod("HasSettingsForBuildTarget", F);
                var createSettings = perTargetType.GetMethod("CreateDefaultSettingsForBuildTarget", F);
                var settingsFor = perTargetType.GetMethod("SettingsForBuildTarget", F);
                var hasMgr = perTargetType.GetMethod("HasManagerSettingsForBuildTarget", F);
                var createMgr = perTargetType.GetMethod("CreateDefaultManagerSettingsForBuildTarget", F);
                var mgrFor = perTargetType.GetMethod("ManagerSettingsForBuildTarget", F);
                var assign = metadataType.GetMethods(BindingFlags.Public | BindingFlags.Static)
                    .FirstOrDefault(m => m.Name == "AssignLoader" && m.GetParameters().Length == 3);
                if (settingsFor == null || assign == null) return false;

                bool ok = true;
                foreach (var group in new[] { BuildTargetGroup.iOS, BuildTargetGroup.Android })
                {
                    if (hasSettings != null && createSettings != null && !(bool)hasSettings.Invoke(perTarget, new object[] { group }))
                        createSettings.Invoke(perTarget, new object[] { group });
                    if (hasMgr != null && createMgr != null && !(bool)hasMgr.Invoke(perTarget, new object[] { group }))
                        createMgr.Invoke(perTarget, new object[] { group });

                    var general = settingsFor.Invoke(perTarget, new object[] { group });
                    if (general != null)
                    {
                        var init = generalType.GetProperty("InitManagerOnStart");
                        init?.SetValue(general, true);
                        EditorUtility.SetDirty((UnityEngine.Object)general);
                    }
                    var mgr = mgrFor?.Invoke(perTarget, new object[] { group }) ?? generalType.GetProperty("Manager")?.GetValue(general);
                    if (mgr == null) { ok = false; continue; }
                    var result = assign.Invoke(null, new object[] { mgr, "Google.XR.Cardboard.XRLoader", group });
                    if (result is bool b && !b) ok = false;
                    EditorUtility.SetDirty((UnityEngine.Object)mgr);
                }
                EditorUtility.SetDirty(perTarget);
                return ok;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[Stillpoint] Automatic XR setup failed: " + e.Message);
                return false;
            }
        }

        static Type FindType(string fullName)
        {
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                var t = asm.GetType(fullName);
                if (t != null) return t;
            }
            return null;
        }
    }
}
