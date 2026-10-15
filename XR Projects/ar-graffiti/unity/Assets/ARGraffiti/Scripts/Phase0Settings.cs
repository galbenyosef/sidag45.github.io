using UnityEngine;

namespace ARGraffiti.Phase0
{
    /// <summary>
    /// Everything you might want to tweak between field tests, in one asset.
    /// Created by "AR Graffiti > 2. Build Phase 0 Scene" at Assets/ARGraffiti/Settings/Phase0Settings.asset.
    /// </summary>
    [CreateAssetMenu(fileName = "Phase0Settings", menuName = "AR Graffiti/Phase 0 Settings")]
    public class Phase0Settings : ScriptableObject
    {
        [Header("Supabase (Project Settings > API in the Supabase dashboard)")]
        [Tooltip("e.g. https://abcdefghijklmnop.supabase.co")]
        public string supabaseUrl = "";

        [Tooltip("The publishable key (sb_publishable_...) or the legacy anon key. Never the secret/service_role key.")]
        public string supabaseKey = "";

        [Header("Placing a marker: localization must be at least this good")]
        [Tooltip("Metres. Google's VPS usually gets well under 1 m when it has a good view of mapped buildings.")]
        public float placeMaxHorizontalAccuracy = 1.0f;

        [Tooltip("Degrees.")]
        public float placeMaxYawAccuracy = 4f;

        [Header("Loading / measuring: below this we still run, but flag the result as low-confidence")]
        public float resolveMaxHorizontalAccuracy = 1.5f;
        public float resolveMaxYawAccuracy = 6f;

        [Tooltip("How long to wait for localization before resolving anyway (seconds). The wait is logged.")]
        public float resolveGateTimeout = 45f;

        [Header("Placement")]
        [Tooltip("Minimum distance between the X and the facing mark, so the facing direction is well defined.")]
        public float minFacingMarkDistance = 0.4f;

        [Header("Materials (assigned by the setup script; leave as-is)")]
        public Material markerBody;
        public Material markerFront;
        public Material markerBack;
        public Material markerArrow;
        public Material reticle;
        public Material measurePoint;
    }
}
