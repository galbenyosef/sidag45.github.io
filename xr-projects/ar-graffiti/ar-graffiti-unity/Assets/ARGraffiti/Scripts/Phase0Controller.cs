using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Google.XR.ARCoreExtensions;
using Unity.XR.CoreUtils;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
#if UNITY_ANDROID
using UnityEngine.Android;
#endif

namespace ARGraffiti.Phase0
{
    /// <summary>
    /// Phase 0: prove anchoring.
    ///
    /// Placer: stands over a chalk X, aims the reticle at it, then at a second chalk dot that sets the facing,
    /// and saves. The app converts that pose to latitude / longitude / altitude + East-Up-North rotation
    /// using Google's Geospatial API and stores it in Supabase. The placer's own marker is then re-created
    /// from the stored record, exactly like everyone else's, so nobody gets a "local" advantage.
    ///
    /// Anyone (other phone, other account, another day): loads the record, the app waits for VPS
    /// localization, resolves the anchor and shows the marker. They then mark where the real X and facing
    /// dot are, and the app logs how far off the marker is (cm), which way, and how much it's rotated.
    /// </summary>
    public class Phase0Controller : MonoBehaviour
    {
        [Header("Set up by AR Graffiti > 2. Build Phase 0 Scene")]
        public Phase0Settings settings;
        public ARSession session;
        public XROrigin origin;
        public ARRaycastManager raycastManager;
        public ARAnchorManager anchorManager;
        public AREarthManager earthManager;
        public ARCoreExtensions arCoreExtensions;

        enum Mode
        {
            Booting,
            Home,
            PlaceSetX,
            PlaceSetFacing,
            PlaceConfirm,
            Saving,
            PickAnchor,
            Loading,
            Viewing,
            MeasureX,
            MeasureFacing,
            MeasureResult,
        }

        static readonly string[] Spots = { "Open / well-mapped", "Plain / featureless", "Shaded / trees", "Other" };
        static readonly string[] Lights = { "Sunny", "Overcast", "Dusk", "Night", "Rain" };

        Mode _mode = Mode.Booting;
        Phase0Ui _ui;
        SupabaseClient _db;
        GameObject _reticle;
        bool _reticleHit;
        Pose _reticlePose;
        static readonly List<ARRaycastHit> s_Hits = new List<ARRaycastHit>();

        // Geospatial lifecycle.
        bool _geospatialEnabled;
        float _geospatialEnabledAt;
        float _firstLocalizedAt = -1f;
        string _fatal;
        string _vpsAvailability = "checking…";

        // Tags recorded with every result.
        int _spotIndex;
        int _lightIndex;
        bool _coldStart;
        bool _useTerrainAnchor = true;

        // Placement state.
        Vector3 _placeX;
        Quaternion _placeRotation;
        GameObject _previewMarker;
        readonly List<GameObject> _pins = new List<GameObject>();

        // Loaded marker state.
        AnchorRow _activeAnchor;
        GameObject _activeAnchorGo;
        GameObject _activeMarker;
        string _activeSessionId;
        bool _activeIsPlacer;
        Coroutine _loadRoutine;
        ResolveAnchorOnTerrainPromise _pendingPromise;
        string _loadPhase = "";

        // Measurement state.
        Vector3 _measureX;

        // Anchor list.
        AnchorRow[] _anchors = Array.Empty<AnchorRow>();
        int _anchorPage;
        const int PageSize = 5;

        float _nextStatusAt;

        // ───────────────────────────── lifecycle ─────────────────────────────

        void Awake()
        {
            Application.targetFrameRate = 60;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
        }

        void Start()
        {
            if (settings == null)
            {
                Debug.LogError("[ARGraffiti] Phase0Settings is not assigned.");
                enabled = false;
                return;
            }

            // Work on a runtime copy of the extensions config so play-mode changes never touch the asset.
            if (arCoreExtensions != null && arCoreExtensions.ARCoreExtensionsConfig != null)
            {
                var copy = ScriptableObject.CreateInstance<ARCoreExtensionsConfig>();
                copy.CopyFrom(arCoreExtensions.ARCoreExtensionsConfig);
                copy.GeospatialMode = GeospatialMode.Disabled; // enabled once the device reports support
                arCoreExtensions.ARCoreExtensionsConfig = copy;
            }

            _spotIndex = Mathf.Clamp(PlayerPrefs.GetInt("argraffiti.spot", 0), 0, Spots.Length - 1);
            _lightIndex = Mathf.Clamp(PlayerPrefs.GetInt("argraffiti.light", 0), 0, Lights.Length - 1);

            _ui = new Phase0Ui();
            _ui.Build();
            _reticle = MarkerFactory.CreateReticle(settings);
            _reticle.SetActive(false);

            _db = new SupabaseClient(settings.supabaseUrl, settings.supabaseKey);
            StartCoroutine(Boot());
        }

        IEnumerator Boot()
        {
            _ui.SetMessage("Starting AR…");
            _ui.SetRows(new List<List<Phase0Ui.ButtonSpec>>());

            StartLocation();

            if (ARSession.state == ARSessionState.None || ARSession.state == ARSessionState.CheckingAvailability)
            {
                yield return ARSession.CheckAvailability();
            }
            if (ARSession.state == ARSessionState.NeedsInstall)
            {
                yield return ARSession.Install();
            }
            if (ARSession.state == ARSessionState.Unsupported)
            {
                _fatal = "This phone doesn't support AR (ARCore / ARKit).";
            }

            _ui.SetMessage("Signing in…");
            string error = null;
            yield return _db.EnsureSession(e => error = e);
            if (error != null)
            {
                _ui.SetMessage(error, Phase0Ui.Bad);
            }

            GoHome(error == null ? "Hold the phone up and look around at buildings and landmarks so it can localize." : null);
        }

        void StartLocation()
        {
#if UNITY_ANDROID
            if (!Permission.HasUserAuthorizedPermission(Permission.FineLocation))
            {
                Permission.RequestUserPermission(Permission.FineLocation);
            }
#endif
#if ENABLE_LEGACY_INPUT_MANAGER
            // Needed on iOS so the location permission prompt appears; also used for the VPS coverage check.
            Input.location.Start(1f, 0.5f);
#else
            Debug.LogWarning("[ARGraffiti] Active Input Handling must be 'Both' so Input.location can request location (needed on iOS).");
#endif
        }

        void Update()
        {
            UpdateGeospatialLifecycle();
            UpdateReticle();

            if (_firstLocalizedAt < 0f && _geospatialEnabled && MeetsGate(settings.placeMaxHorizontalAccuracy, settings.placeMaxYawAccuracy))
            {
                _firstLocalizedAt = Time.realtimeSinceStartup;
            }

            if (Time.realtimeSinceStartup >= _nextStatusAt)
            {
                _nextStatusAt = Time.realtimeSinceStartup + 0.2f;
                _ui.SetStatus(BuildStatus());
                RefreshLiveButtons();
            }
        }

        void UpdateGeospatialLifecycle()
        {
            if (_geospatialEnabled || _fatal != null) return;
            if (ARSession.state != ARSessionState.SessionInitializing && ARSession.state != ARSessionState.SessionTracking) return;

            switch (earthManager.IsGeospatialModeSupported(GeospatialMode.Enabled))
            {
                case FeatureSupported.Unknown:
                    return;
                case FeatureSupported.Unsupported:
                    _fatal = "This phone doesn't support Google's Geospatial API.";
                    return;
                case FeatureSupported.Supported:
                    arCoreExtensions.ARCoreExtensionsConfig.GeospatialMode = GeospatialMode.Enabled;
                    _geospatialEnabled = true;
                    _geospatialEnabledAt = Time.realtimeSinceStartup;
                    StartCoroutine(CheckVps());
                    break;
            }
        }

        IEnumerator CheckVps()
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            var deadline = Time.realtimeSinceStartup + 20f;
            while (Input.location.status == LocationServiceStatus.Initializing && Time.realtimeSinceStartup < deadline)
            {
                yield return null;
            }
            if (Input.location.status != LocationServiceStatus.Running)
            {
                _vpsAvailability = "unknown (location off)";
                yield break;
            }
            var loc = Input.location.lastData;
            var promise = AREarthManager.CheckVpsAvailabilityAsync(loc.latitude, loc.longitude);
            yield return promise;
            _vpsAvailability = promise.Result.ToString();
#else
            _vpsAvailability = "unknown";
            yield break;
#endif
        }

        // ───────────────────────────── geospatial helpers ─────────────────────────────

        bool EarthTracking =>
            _geospatialEnabled &&
            earthManager.EarthState == EarthState.Enabled &&
            earthManager.EarthTrackingState == TrackingState.Tracking;

        /// <summary>Current camera geospatial pose; accuracies are -1 when not tracking, so logs never show a fake "perfect" 0.</summary>
        GeospatialPose CameraPose => EarthTracking
            ? earthManager.CameraGeospatialPose
            : new GeospatialPose { HorizontalAccuracy = -1, VerticalAccuracy = -1, OrientationYawAccuracy = -1, HeadingAccuracy = -1 };

        bool MeetsGate(float maxHorizontal, float maxYaw)
        {
            if (!EarthTracking) return false;
            var p = earthManager.CameraGeospatialPose;
            return p.HorizontalAccuracy <= maxHorizontal && p.OrientationYawAccuracy <= maxYaw;
        }

        Camera ArCamera => origin != null && origin.Camera != null ? origin.Camera : Camera.main;

        void UpdateReticle()
        {
            bool wanted = _mode == Mode.PlaceSetX || _mode == Mode.PlaceSetFacing ||
                          _mode == Mode.MeasureX || _mode == Mode.MeasureFacing;
            _ui?.ShowCrosshair(wanted);
            _reticleHit = false;

            if (wanted && raycastManager != null)
            {
                var center = new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);
                if (raycastManager.Raycast(center, s_Hits, TrackableType.PlaneWithinPolygon))
                {
                    _reticleHit = true;
                    _reticlePose = s_Hits[0].pose;
                }
            }

            _reticle.SetActive(_reticleHit);
            if (_reticleHit)
            {
                // Keep the reticle flat on the ground and aligned with the camera's heading so it reads naturally.
                var fwd = GeoMath.Flatten(ArCamera.transform.forward);
                _reticle.transform.SetPositionAndRotation(
                    _reticlePose.position,
                    fwd == Vector3.zero ? Quaternion.identity : Quaternion.LookRotation(fwd, Vector3.up));
            }
        }

        // ───────────────────────────── screens ─────────────────────────────

        void GoHome(string message = null)
        {
            _mode = Mode.Home;
            ClearPins();
            if (_previewMarker != null) Destroy(_previewMarker);
            if (message != null) _ui.SetMessage(message);
            BuildButtons();
        }

        void BuildButtons()
        {
            var rows = new List<List<Phase0Ui.ButtonSpec>>();
            switch (_mode)
            {
                case Mode.Home:
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Spot:\n" + Spots[_spotIndex], CycleSpot),
                        new Phase0Ui.ButtonSpec("Light:\n" + Lights[_lightIndex], CycleLight),
                        new Phase0Ui.ButtonSpec("Cold start:\n" + (_coldStart ? "ON" : "off"), ToggleCold),
                    });
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("New account", ResetAccount),
                        new Phase0Ui.ButtonSpec("Place marker", BeginPlace, EarthTracking, true),
                        new Phase0Ui.ButtonSpec("Load marker", OpenAnchorList, _db.IsSignedIn, true),
                    });
                    break;

                case Mode.PlaceSetX:
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Cancel", () => GoHome("Placement cancelled.")),
                        new Phase0Ui.ButtonSpec("Set X here", SetPlaceX, _reticleHit, true),
                    });
                    break;

                case Mode.PlaceSetFacing:
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Redo X", BeginPlace),
                        new Phase0Ui.ButtonSpec("Set facing here", SetPlaceFacing, FacingTargetOk(), true),
                    });
                    break;

                case Mode.PlaceConfirm:
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Anchor type:\n" + (_useTerrainAnchor ? "Terrain" : "WGS84 altitude"), () =>
                        {
                            _useTerrainAnchor = !_useTerrainAnchor;
                            BuildButtons();
                        }),
                    });
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Redo", BeginPlace),
                        new Phase0Ui.ButtonSpec("Save marker", SavePlacement,
                            MeetsGate(settings.placeMaxHorizontalAccuracy, settings.placeMaxYawAccuracy), true),
                    });
                    break;

                case Mode.PickAnchor:
                    var page = PageOfAnchors();
                    foreach (var a in page)
                    {
                        var anchor = a;
                        rows.Add(new List<Phase0Ui.ButtonSpec>
                        {
                            new Phase0Ui.ButtonSpec(AnchorButtonLabel(anchor), () => StartLoad(anchor, false)),
                        });
                    }
                    var nav = new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Back", () => GoHome()),
                        new Phase0Ui.ButtonSpec("Refresh", OpenAnchorList),
                    };
                    if (_anchors.Length > PageSize)
                    {
                        nav.Add(new Phase0Ui.ButtonSpec("More", () =>
                        {
                            _anchorPage = (_anchorPage + 1) % Mathf.CeilToInt(_anchors.Length / (float)PageSize);
                            BuildButtons();
                        }));
                    }
                    rows.Add(nav);
                    break;

                case Mode.Loading:
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Cancel", CancelLoad),
                    });
                    break;

                case Mode.Viewing:
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Done", FinishViewing),
                        new Phase0Ui.ButtonSpec("Measure error", BeginMeasure, true, true),
                    });
                    break;

                case Mode.MeasureX:
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Cancel", EndMeasure),
                        new Phase0Ui.ButtonSpec("Real X is here", SetMeasureX, _reticleHit, true),
                    });
                    break;

                case Mode.MeasureFacing:
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Redo X", BeginMeasure),
                        new Phase0Ui.ButtonSpec("Facing dot is here", SetMeasureFacing, FacingTargetOk(), true),
                    });
                    break;

                case Mode.MeasureResult:
                    rows.Add(new List<Phase0Ui.ButtonSpec>
                    {
                        new Phase0Ui.ButtonSpec("Done", FinishViewing),
                        new Phase0Ui.ButtonSpec("Measure again", BeginMeasure, true, true),
                    });
                    break;
            }
            _ui.SetRows(rows);
        }

        // Some buttons depend on live state (reticle hit, accuracy); rebuild only when that state flips.
        string _liveKey = "";
        void RefreshLiveButtons()
        {
            var key = $"{_mode}|{_reticleHit}|{FacingTargetOk()}|{EarthTracking}|" +
                      $"{MeetsGate(settings.placeMaxHorizontalAccuracy, settings.placeMaxYawAccuracy)}|{_db?.IsSignedIn}";
            if (key == _liveKey) return;
            _liveKey = key;
            if (_mode != Mode.Booting && _mode != Mode.Saving) BuildButtons();
        }

        void CycleSpot()
        {
            _spotIndex = (_spotIndex + 1) % Spots.Length;
            PlayerPrefs.SetInt("argraffiti.spot", _spotIndex);
            BuildButtons();
        }

        void CycleLight()
        {
            _lightIndex = (_lightIndex + 1) % Lights.Length;
            PlayerPrefs.SetInt("argraffiti.light", _lightIndex);
            BuildButtons();
        }

        void ToggleCold()
        {
            _coldStart = !_coldStart;
            BuildButtons();
            _ui.SetMessage(_coldStart
                ? "Cold start ON: loading a marker resets AR first, so lock time includes localizing from scratch."
                : "Cold start off: loading uses the current localization.");
        }

        void ResetAccount()
        {
            _db.ResetAccount();
            StartCoroutine(ResetAccountRoutine());
        }

        IEnumerator ResetAccountRoutine()
        {
            string error = null;
            yield return _db.EnsureSession(e => error = e);
            _ui.SetMessage(error ?? $"Now signed in as a new account: {_db.ShortUserId}", error == null ? Phase0Ui.Good : Phase0Ui.Bad);
            BuildButtons();
        }

        // ───────────────────────────── placing ─────────────────────────────

        void BeginPlace()
        {
            ClearActiveMarker();
            ClearPins();
            if (_previewMarker != null) Destroy(_previewMarker);
            _mode = Mode.PlaceSetX;
            _ui.SetMessage("Stand 1–2 m from the chalk X. Put the crosshair exactly on the centre of the X, then tap Set X here.");
            BuildButtons();
        }

        void SetPlaceX()
        {
            if (!_reticleHit) return;
            _placeX = _reticlePose.position;
            ClearPins();
            _pins.Add(MarkerFactory.CreatePin(settings, "PlaceX", _placeX));
            _mode = Mode.PlaceSetFacing;
            _ui.SetMessage("Now put the crosshair on the facing dot (the second chalk mark). The marker's arrow and sign will point at it.");
            BuildButtons();
        }

        bool FacingTargetOk()
        {
            if (!_reticleHit) return false;
            var from = _mode == Mode.MeasureFacing ? _measureX : _placeX;
            return GeoMath.HorizontalDistance(from, _reticlePose.position) >= settings.minFacingMarkDistance;
        }

        void SetPlaceFacing()
        {
            if (!FacingTargetOk() || !GeoMath.TryFacing(_placeX, _reticlePose.position, out _placeRotation)) return;
            _pins.Add(MarkerFactory.CreatePin(settings, "PlaceFacing", _reticlePose.position));
            if (_previewMarker != null) Destroy(_previewMarker);
            _previewMarker = MarkerFactory.CreateMarker(settings, null);
            _previewMarker.transform.SetPositionAndRotation(_placeX, _placeRotation);
            _mode = Mode.PlaceConfirm;
            _ui.SetMessage("Preview shown. Save is enabled once localization is good enough " +
                           $"(±{settings.placeMaxHorizontalAccuracy:0.#} m, ±{settings.placeMaxYawAccuracy:0.#}°). " +
                           "Keep pointing at buildings if it's greyed out.");
            BuildButtons();
        }

        void SavePlacement()
        {
            if (!MeetsGate(settings.placeMaxHorizontalAccuracy, settings.placeMaxYawAccuracy)) return;
            StartCoroutine(SaveRoutine());
        }

        IEnumerator SaveRoutine()
        {
            _mode = Mode.Saving;
            _ui.SetRows(new List<List<Phase0Ui.ButtonSpec>>());
            _ui.SetMessage("Saving…");

            var cam = earthManager.CameraGeospatialPose;
            var geo = earthManager.Convert(new Pose(_placeX, _placeRotation));
            var row = new AnchorInsert
            {
                label = $"{ShortSpot()} · {DateTime.Now:MMM d HH:mm} · {_db.ShortUserId}",
                spot = Spots[_spotIndex],
                light = Lights[_lightIndex],
                anchor_type = _useTerrainAnchor ? "terrain" : "wgs84",
                latitude = geo.Latitude,
                longitude = geo.Longitude,
                altitude = geo.Altitude,
                altitude_above_terrain = 0,
                eun_x = geo.EunRotation.x,
                eun_y = geo.EunRotation.y,
                eun_z = geo.EunRotation.z,
                eun_w = geo.EunRotation.w,
                heading_deg = GeoMath.HeadingFromEun(geo.EunRotation),
                place_h_acc = cam.HorizontalAccuracy,
                place_v_acc = cam.VerticalAccuracy,
                place_yaw_acc = cam.OrientationYawAccuracy,
                platform = Application.platform.ToString(),
                device_model = SystemInfo.deviceModel,
                app_version = Application.version,
            };

            string json = null, error = null;
            yield return _db.Insert("anchors", row, t => json = t, e => error = e);
            if (error != null)
            {
                _mode = Mode.PlaceConfirm;
                _ui.SetMessage("Couldn't save: " + error, Phase0Ui.Bad);
                BuildButtons();
                yield break;
            }

            var saved = JsonUtility.FromJson<AnchorRow>(json);
            if (_previewMarker != null) Destroy(_previewMarker);
            ClearPins();
            _ui.SetMessage("Saved. Re-creating it from the stored coordinates, the same way other phones will…", Phase0Ui.Good);
            StartLoad(saved, true);
        }

        // ───────────────────────────── loading ─────────────────────────────

        void OpenAnchorList()
        {
            StartCoroutine(OpenAnchorListRoutine());
        }

        IEnumerator OpenAnchorListRoutine()
        {
            _ui.SetMessage("Fetching markers…");
            string json = null, error = null;
            yield return _db.Select("anchors", "select=*&order=created_at.desc&limit=30", t => json = t, e => error = e);
            if (error != null)
            {
                _ui.SetMessage("Couldn't load markers: " + error, Phase0Ui.Bad);
                yield break;
            }
            _anchors = SupabaseClient.ParseArray<AnchorRow>(json);
            _anchorPage = 0;
            _mode = Mode.PickAnchor;
            _ui.SetMessage(_anchors.Length == 0
                ? "No markers yet. Place one first."
                : $"{_anchors.Length} markers. Newest first. Pick the one for the spot you're standing at.");
            BuildButtons();
        }

        IEnumerable<AnchorRow> PageOfAnchors()
        {
            for (int i = _anchorPage * PageSize; i < Mathf.Min(_anchors.Length, (_anchorPage + 1) * PageSize); i++)
            {
                yield return _anchors[i];
            }
        }

        string AnchorButtonLabel(AnchorRow a)
        {
            var mine = a.created_by == _db.UserId ? " (you)" : "";
            var dist = "";
            if (EarthTracking)
            {
                var cam = earthManager.CameraGeospatialPose;
                GeoMath.EastNorthMetres(cam.Latitude, cam.Longitude, a.latitude, a.longitude, out var e, out var n);
                dist = $" · {Math.Sqrt(e * e + n * n):0} m away";
            }
            return $"{a.label}{mine}\n<size=24>{a.anchor_type}{dist} · placed {Ago(a.created_at)}</size>";
        }

        void StartLoad(AnchorRow anchor, bool isPlacer)
        {
            ClearActiveMarker();
            ClearPins();
            _activeAnchor = anchor;
            _activeIsPlacer = isPlacer;
            _mode = Mode.Loading;
            BuildButtons();
            _loadRoutine = StartCoroutine(LoadRoutine(anchor, isPlacer, _coldStart && !isPlacer));
        }

        IEnumerator LoadRoutine(AnchorRow a, bool isPlacer, bool cold)
        {
            var t0 = Time.realtimeSinceStartup;

            if (cold)
            {
                _loadPhase = "Resetting AR (cold start)…";
                session.Reset();
                yield return null;
                yield return new WaitForSeconds(0.5f);
            }

            // 1) Wait for localization to be good enough (or give up waiting and resolve anyway, flagged).
            _loadPhase = "Localizing — point the camera at buildings and landmarks…";
            while (!MeetsGate(settings.resolveMaxHorizontalAccuracy, settings.resolveMaxYawAccuracy) &&
                   Time.realtimeSinceStartup - t0 < settings.resolveGateTimeout)
            {
                yield return null;
            }
            bool gateMet = MeetsGate(settings.resolveMaxHorizontalAccuracy, settings.resolveMaxYawAccuracy);
            float gateWait = Time.realtimeSinceStartup - t0;

            while (!EarthTracking && _mode == Mode.Loading)
            {
                _loadPhase = "Waiting for Earth tracking…";
                yield return null;
            }

            // 2) Resolve.
            var tResolve = Time.realtimeSinceStartup;
            var eun = new Quaternion((float)a.eun_x, (float)a.eun_y, (float)a.eun_z, (float)a.eun_w);
            ARGeospatialAnchor anchor = null;
            string state;

            if (a.anchor_type == "wgs84")
            {
                _loadPhase = "Creating anchor…";
                anchor = anchorManager.AddAnchor(a.latitude, a.longitude, a.altitude, eun);
                state = anchor != null ? "Created" : "AddAnchorFailed";
            }
            else
            {
                _loadPhase = "Resolving terrain anchor…";
                _pendingPromise = anchorManager.ResolveAnchorOnTerrainAsync(a.latitude, a.longitude, a.altitude_above_terrain, eun);
                yield return _pendingPromise;
                var promise = _pendingPromise;
                _pendingPromise = null;
                if (promise.State == PromiseState.Done && promise.Result != null)
                {
                    state = promise.Result.TerrainAnchorState.ToString();
                    if (promise.Result.TerrainAnchorState == TerrainAnchorState.Success) anchor = promise.Result.Anchor;
                }
                else
                {
                    state = "Promise" + promise.State;
                }
            }

            // 3) Wait until it's actually tracking (that's when it appears for the user).
            if (anchor != null)
            {
                _loadPhase = "Anchor resolved, waiting for it to track…";
                var deadline = Time.realtimeSinceStartup + 20f;
                while (anchor != null && anchor.trackingState != TrackingState.Tracking && Time.realtimeSinceStartup < deadline)
                {
                    yield return null;
                }
                if (anchor == null || anchor.trackingState != TrackingState.Tracking)
                {
                    state += "/NotTracking";
                    if (anchor != null) Destroy(anchor.gameObject);
                    anchor = null;
                }
            }

            var now = Time.realtimeSinceStartup;
            var cam = CameraPose;
            var sessionRow = new ResolveSessionInsert
            {
                anchor_id = a.id,
                platform = Application.platform.ToString(),
                device_model = SystemInfo.deviceModel,
                app_version = Application.version,
                spot = Spots[_spotIndex],
                light = Lights[_lightIndex],
                cold_start = cold,
                is_placer = isPlacer,
                success = anchor != null,
                state = state,
                gate_met = gateMet,
                gate_wait_s = gateWait,
                resolve_s = now - tResolve,
                lock_s = now - t0,
                h_acc = cam.HorizontalAccuracy,
                v_acc = cam.VerticalAccuracy,
                yaw_acc = cam.OrientationYawAccuracy,
            };

            if (anchor != null)
            {
                _activeAnchorGo = anchor.gameObject;
                _activeMarker = MarkerFactory.CreateMarker(settings, anchor.transform);
                _mode = Mode.Viewing;
                _ui.SetMessage($"Marker visible after {now - t0:0.0} s{(gateMet ? "" : " (localization was weak — flagged)")}. " +
                               "Walk to the chalk X and compare, then tap Measure error.",
                    gateMet ? Phase0Ui.Good : Phase0Ui.Warn);
            }
            else
            {
                _mode = Mode.Home;
                _ui.SetMessage($"Couldn't resolve this marker ({state}). Logged as a failure.", Phase0Ui.Bad);
            }
            BuildButtons();
            _loadRoutine = null;

            string json = null, error = null;
            yield return _db.Insert("resolve_sessions", sessionRow, t => json = t, e => error = e);
            if (error != null)
            {
                _ui.SetMessage("Resolve result not uploaded: " + error, Phase0Ui.Bad);
            }
            else if (anchor != null)
            {
                var saved = JsonUtility.FromJson<ResolveSessionRow>(json);
                _activeSessionId = saved != null ? saved.id : null;
            }
        }

        void CancelLoad()
        {
            if (_loadRoutine != null) StopCoroutine(_loadRoutine);
            _loadRoutine = null;
            if (_pendingPromise != null)
            {
                _pendingPromise.Cancel();
                _pendingPromise = null;
            }
            GoHome("Load cancelled (not logged).");
        }

        void FinishViewing()
        {
            ClearActiveMarker();
            GoHome("Done. Load another marker or place a new one.");
        }

        void ClearActiveMarker()
        {
            if (_activeAnchorGo != null) Destroy(_activeAnchorGo);
            _activeAnchorGo = null;
            _activeMarker = null;
            _activeSessionId = null;
        }

        // ───────────────────────────── measuring ─────────────────────────────

        void BeginMeasure()
        {
            if (_activeMarker == null) return;
            ClearPins();
            _activeMarker.SetActive(false); // so the real chalk X isn't hidden under the virtual one
            _mode = Mode.MeasureX;
            _ui.SetMessage("Marker hidden so you can see the ground. Put the crosshair on the centre of the REAL chalk X, then tap.");
            BuildButtons();
        }

        void SetMeasureX()
        {
            if (!_reticleHit) return;
            _measureX = _reticlePose.position;
            _pins.Add(MarkerFactory.CreatePin(settings, "MeasureX", _measureX));
            _mode = Mode.MeasureFacing;
            _ui.SetMessage("Now put the crosshair on the REAL facing dot, then tap.");
            BuildButtons();
        }

        void SetMeasureFacing()
        {
            if (!FacingTargetOk() || _activeMarker == null) return;
            var facing = _reticlePose.position;
            _pins.Add(MarkerFactory.CreatePin(settings, "MeasureFacing", facing));
            _activeMarker.SetActive(true);

            var markerPos = _activeMarker.transform.position;
            var markerRot = _activeMarker.transform.rotation;
            var horizontal = GeoMath.HorizontalDistance(markerPos, _measureX);
            var vertical = markerPos.y - _measureX.y;
            var yaw = GeoMath.YawErrorDegrees(markerRot, _measureX, facing);

            double east = double.NaN, north = double.NaN;
            if (EarthTracking)
            {
                var gMarker = earthManager.Convert(new Pose(markerPos, Quaternion.identity));
                var gX = earthManager.Convert(new Pose(_measureX, Quaternion.identity));
                GeoMath.EastNorthMetres(gX.Latitude, gX.Longitude, gMarker.Latitude, gMarker.Longitude, out east, out north);
            }

            var cam = CameraPose;
            bool low = !MeetsGate(settings.resolveMaxHorizontalAccuracy, settings.resolveMaxYawAccuracy);
            var m = new MeasurementInsert
            {
                anchor_id = _activeAnchor.id,
                session_id = _activeSessionId,
                platform = Application.platform.ToString(),
                device_model = SystemInfo.deviceModel,
                spot = Spots[_spotIndex],
                light = Lights[_lightIndex],
                is_placer = _activeIsPlacer || _activeAnchor.created_by == _db.UserId,
                horizontal_error_m = horizontal,
                direction_known = !double.IsNaN(east),
                east_error_m = double.IsNaN(east) ? 0 : east,
                north_error_m = double.IsNaN(north) ? 0 : north,
                vertical_error_m = vertical,
                yaw_error_deg = float.IsNaN(yaw) ? 0 : yaw,
                camera_distance_m = GeoMath.HorizontalDistance(ArCamera.transform.position, _measureX),
                h_acc = cam.HorizontalAccuracy,
                v_acc = cam.VerticalAccuracy,
                yaw_acc = cam.OrientationYawAccuracy,
                low_confidence = low,
                hours_since_placed = HoursSince(_activeAnchor.created_at),
            };

            var posColor = horizontal <= 0.3f ? Phase0Ui.Good : horizontal <= 1f ? Phase0Ui.Warn : Phase0Ui.Bad;
            var yawColor = Mathf.Abs(yaw) <= 5f ? Phase0Ui.Good : Mathf.Abs(yaw) <= 15f ? Phase0Ui.Warn : Phase0Ui.Bad;
            var worst = posColor == Phase0Ui.Bad || yawColor == Phase0Ui.Bad ? Phase0Ui.Bad
                      : posColor == Phase0Ui.Warn || yawColor == Phase0Ui.Warn ? Phase0Ui.Warn : Phase0Ui.Good;

            _mode = Mode.MeasureResult;
            _ui.SetMessage(
                $"Off by {horizontal * 100f:0} cm along the ground ({Compass(east, north)}), " +
                $"{vertical * 100f:+0;-0;0} cm vertically, rotated {yaw:+0.0;-0.0;0.0}°." +
                (low ? "\nLocalization was weak during this measurement — flagged." : "") +
                "\nUploading…", worst);
            BuildButtons();
            StartCoroutine(UploadMeasurement(m, worst));
        }

        IEnumerator UploadMeasurement(MeasurementInsert m, Color color)
        {
            string error = null;
            yield return _db.Insert("measurements", m, null, e => error = e);
            var dirText = m.direction_known ? Compass(m.east_error_m, m.north_error_m) : Compass(double.NaN, double.NaN);
            var baseText = $"Off by {m.horizontal_error_m * 100:0} cm ({dirText}), " +
                           $"{m.vertical_error_m * 100:+0;-0;0} cm vertically, rotated {m.yaw_error_deg:+0.0;-0.0;0.0}°.";
            _ui.SetMessage(baseText + (m.low_confidence ? "\nFlagged: weak localization." : "") +
                           (error == null ? "\nLogged ✓" : "\nNot uploaded: " + error),
                error == null ? color : Phase0Ui.Bad);
        }

        void EndMeasure()
        {
            ClearPins();
            if (_activeMarker != null) _activeMarker.SetActive(true);
            _mode = Mode.Viewing;
            _ui.SetMessage("Measurement cancelled.");
            BuildButtons();
        }

        void ClearPins()
        {
            foreach (var p in _pins) if (p != null) Destroy(p);
            _pins.Clear();
        }

        // ───────────────────────────── status text ─────────────────────────────

        string BuildStatus()
        {
            var sb = new StringBuilder();
            sb.Append("<b>AR GRAFFITI · PHASE 0</b>   account <b>").Append(_db != null ? _db.ShortUserId : "—").Append("</b>\n");
            sb.Append("<size=24>").Append(SystemInfo.deviceModel).Append(" · ").Append(Application.platform).Append("</size>\n");

            if (_fatal != null)
            {
                sb.Append(Col(_fatal, Phase0Ui.Bad));
                return sb.ToString();
            }

            if (!_geospatialEnabled)
            {
                sb.Append("AR session: ").Append(ARSession.state).Append("\nWaiting for Geospatial support check…");
                return sb.ToString();
            }

            var es = earthManager.EarthState;
            if (es != EarthState.Enabled)
            {
                sb.Append(Col("Earth: " + es, Phase0Ui.Bad)).Append('\n').Append(EarthStateHelp(es));
                return sb.ToString();
            }

            sb.Append("Earth: ").Append(earthManager.EarthTrackingState).Append("   VPS here: ").Append(_vpsAvailability).Append('\n');

            if (EarthTracking)
            {
                var p = earthManager.CameraGeospatialPose;
                sb.Append("Position ±").Append(Col($"{p.HorizontalAccuracy:0.00} m", Grade(p.HorizontalAccuracy, settings.placeMaxHorizontalAccuracy, settings.resolveMaxHorizontalAccuracy)))
                  .Append("   Height ±").Append($"{p.VerticalAccuracy:0.00} m")
                  .Append("   Heading ±").Append(Col($"{p.OrientationYawAccuracy:0.0}°", Grade(p.OrientationYawAccuracy, settings.placeMaxYawAccuracy, settings.resolveMaxYawAccuracy)))
                  .Append('\n');
            }
            else
            {
                sb.Append(Col("Not localized yet — look around at buildings and landmarks.", Phase0Ui.Warn)).Append('\n');
            }

            if (_firstLocalizedAt > 0f)
            {
                sb.Append("Localized well enough to place after ").Append($"{_firstLocalizedAt - _geospatialEnabledAt:0.0} s").Append('\n');
            }

            if (_mode == Mode.Loading)
            {
                sb.Append(Col(_loadPhase, Phase0Ui.Warn)).Append('\n');
            }
            else if ((_mode == Mode.Viewing || _mode == Mode.MeasureResult) && _activeMarker != null)
            {
                var camT = ArCamera.transform;
                var to = _activeMarker.transform.position - camT.position;
                var flat = GeoMath.Flatten(to);
                var fwd = GeoMath.Flatten(camT.forward);
                var turn = flat == Vector3.zero || fwd == Vector3.zero ? 0f : Vector3.SignedAngle(fwd, flat, Vector3.up);
                var dir = Mathf.Abs(turn) < 12f ? "ahead" : turn > 0 ? $"{turn:0}° right" : $"{-turn:0}° left";
                sb.Append("Marker: ").Append($"{GeoMath.HorizontalDistance(camT.position, _activeMarker.transform.position):0.0} m, {dir}").Append('\n');
            }

            sb.Append("<size=24>").Append(Spots[_spotIndex]).Append(" · ").Append(Lights[_lightIndex])
              .Append(_coldStart ? " · cold start" : "").Append("</size>");
            return sb.ToString();
        }

        static string EarthStateHelp(EarthState s)
        {
            switch (s)
            {
                case EarthState.ErrorNotAuthorized:
                    return "The Google Cloud API key / authentication isn't accepted. Check ARCore Extensions project settings and that the ARCore API is enabled.";
                case EarthState.ErrorResourcesExhausted:
                    return "Google Cloud quota exceeded for the ARCore API.";
                case EarthState.ErrorPackageTooOld:
                    return "Update Google Play Services for AR on this phone.";
                case EarthState.ErrorGeospatialModeDisabled:
                    return "Geospatial is off in the session config.";
                default:
                    return "Restart the app; if it persists, check the device log.";
            }
        }

        static Color Grade(double value, double good, double ok) =>
            value <= good ? Phase0Ui.Good : value <= ok ? Phase0Ui.Warn : Phase0Ui.Bad;

        static string Col(string text, Color c) => $"<color=#{ColorUtility.ToHtmlStringRGB(c)}>{text}</color>";

        string ShortSpot()
        {
            var s = Spots[_spotIndex];
            var slash = s.IndexOf(' ');
            return slash > 0 ? s.Substring(0, slash) : s;
        }

        static string Compass(double east, double north)
        {
            if (double.IsNaN(east) || double.IsNaN(north)) return "direction unknown";
            var d = Math.Sqrt(east * east + north * north);
            if (d < 0.02) return "dead on";
            var deg = (Math.Atan2(east, north) * 180.0 / Math.PI + 360.0) % 360.0;
            string[] names = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" };
            return "marker sits " + names[(int)Math.Round(deg / 45.0) % 8] + " of the X";
        }

        static double HoursSince(string isoTimestamp)
        {
            if (DateTimeOffset.TryParse(isoTimestamp, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var t))
            {
                return (DateTimeOffset.UtcNow - t).TotalHours;
            }
            return -1;
        }

        static string Ago(string isoTimestamp)
        {
            var h = HoursSince(isoTimestamp);
            if (h < 0) return "?";
            if (h < 1) return $"{Math.Max(1, (int)(h * 60))} min ago";
            if (h < 48) return $"{(int)h} h ago";
            return $"{(int)(h / 24)} days ago";
        }
    }
}
