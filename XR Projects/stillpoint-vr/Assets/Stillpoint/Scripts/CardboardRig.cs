using UnityEngine;
using UnityEngine.SpatialTracking;
using UnityEngine.XR.Management;
using Google.XR.Cardboard;

namespace Stillpoint
{
    /// <summary>
    /// Camera rig for Google Cardboard. Uses the Cardboard XR plugin on device,
    /// and right-mouse-drag look + click/space "trigger" in the Unity Editor.
    /// </summary>
    public class CardboardRig : MonoBehaviour
    {
        public Camera Cam { get; private set; }
        public Transform Head { get; private set; }

        /// <summary>Screen tap / Cardboard button pressed this frame.</summary>
        public bool TriggerDown { get; private set; }
        /// <summary>Cardboard "X" close button pressed this frame.</summary>
        public bool CloseDown { get; private set; }

        TrackedPoseDriver _tpd;
        Fader _fader;
        float _yaw, _pitch;
        bool _checkedParams;

        public Fader Fader => _fader;

        public static bool XRActive
        {
            get
            {
                var s = XRGeneralSettings.Instance;
                return s != null && s.Manager != null && s.Manager.activeLoader != null;
            }
        }

        void Awake()
        {
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Application.targetFrameRate = 60;

            // Remove a default scene camera if one exists.
            foreach (var c in FindAll<Camera>()) if (c.transform.root != transform) Destroy(c.gameObject);
            foreach (var l in FindAll<AudioListener>()) if (l.transform.root != transform) Destroy(l);

            transform.position = new Vector3(0, SP.EyeHeight, 0);
            transform.rotation = Quaternion.identity;

            var head = new GameObject("Head");
            head.tag = "MainCamera";
            Head = head.transform;
            Head.SetParent(transform, false);
            Cam = head.AddComponent<Camera>();
            Cam.nearClipPlane = 0.05f;
            Cam.farClipPlane = 1200f;
            Cam.clearFlags = CameraClearFlags.SolidColor;
            Cam.backgroundColor = Color.black;
            head.AddComponent<AudioListener>();

            _tpd = head.AddComponent<TrackedPoseDriver>();
            _tpd.SetPoseSource(TrackedPoseDriver.DeviceType.GenericXRDevice, TrackedPoseDriver.TrackedPose.Center);
            _tpd.trackingType = TrackedPoseDriver.TrackingType.RotationAndPosition;
            _tpd.updateType = TrackedPoseDriver.UpdateType.UpdateAndBeforeRender;

            _fader = head.AddComponent<Fader>();
        }

        static T[] FindAll<T>() where T : Object
        {
#if UNITY_2023_1_OR_NEWER
            return Object.FindObjectsByType<T>(FindObjectsSortMode.None);
#else
            return Object.FindObjectsOfType<T>();
#endif
        }

        void Update()
        {
            bool xr = XRActive;
            _tpd.enabled = xr;
            TriggerDown = false;
            CloseDown = false;

            if (xr)
            {
                if (!_checkedParams)
                {
                    _checkedParams = true;
                    if (!Api.HasDeviceParams()) Api.ScanDeviceParams();
                }
                if (Api.IsGearButtonPressed) Api.ScanDeviceParams();
                if (Api.IsCloseButtonPressed) CloseDown = true;
                if (Api.HasNewDeviceParams()) Api.ReloadDeviceParams();
                if (Api.IsTriggerPressed) TriggerDown = true;
                Api.UpdateScreenParams();
            }
            else
            {
                // Editor / desktop preview controls.
                if (Input.GetMouseButton(1))
                {
                    _yaw += Input.GetAxis("Mouse X") * 3f;
                    _pitch = Mathf.Clamp(_pitch - Input.GetAxis("Mouse Y") * 3f, -85f, 85f);
                }
                Head.localRotation = Quaternion.Euler(_pitch, _yaw, 0);
                Head.localPosition = Vector3.zero;
                if (Input.GetMouseButtonDown(0) || Input.GetKeyDown(KeyCode.Space)) TriggerDown = true;
                if (Input.GetKeyDown(KeyCode.Escape)) CloseDown = true;
                if (Input.GetKeyDown(KeyCode.R)) Recenter();
            }
        }

        public void Recenter()
        {
            if (XRActive) Api.Recenter();
            else { _yaw = 0; _pitch = 0; }
        }
    }

    /// <summary>Full-view fade to black, drawn on top of everything.</summary>
    public class Fader : MonoBehaviour
    {
        Material _mat;
        float _alpha = 1f, _target = 1f, _speed = 1f;
        GameObject _quad;

        public bool Busy => !Mathf.Approximately(_alpha, _target);
        public float Alpha => _alpha;

        void Awake()
        {
            _mat = SP.Soft(Texture2D.whiteTexture, Color.black, false, true);
            _mat.renderQueue = 5000;
            _quad = SP.Quad("Fade", transform, _mat, new Vector2(3, 3));
            _quad.transform.localPosition = new Vector3(0, 0, 0.2f);
            Apply();
        }

        public void FadeTo(float alpha, float seconds)
        {
            _target = Mathf.Clamp01(alpha);
            _speed = seconds <= 0 ? 1000f : Mathf.Abs(_target - _alpha) / seconds;
            if (_speed <= 0) _speed = 1000f;
        }

        void Update()
        {
            _alpha = Mathf.MoveTowards(_alpha, _target, _speed * Time.deltaTime);
            Apply();
        }

        void Apply()
        {
            _mat.SetColor("_Color", new Color(0, 0, 0, _alpha));
            _quad.SetActive(_alpha > 0.001f);
        }
    }
}
