using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif

namespace ARGraffiti.Phase0
{
    /// <summary>
    /// The whole Phase 0 interface, built in code: a status panel at the top, a crosshair in the middle,
    /// a message line and rows of buttons at the bottom. No prefabs or TextMeshPro setup needed.
    /// </summary>
    public class Phase0Ui
    {
        public struct ButtonSpec
        {
            public string Label;
            public Action OnClick;
            public bool Interactable;
            public bool Primary;

            public ButtonSpec(string label, Action onClick, bool interactable = true, bool primary = false)
            {
                Label = label;
                OnClick = onClick;
                Interactable = interactable;
                Primary = primary;
            }
        }

        static readonly Color PanelColor = new Color(0.05f, 0.05f, 0.07f, 0.72f);
        static readonly Color ButtonColor = new Color(0.16f, 0.16f, 0.2f, 0.92f);
        static readonly Color PrimaryColor = new Color(1f, 0.36f, 0.14f, 0.95f);
        public static readonly Color Good = new Color(0.25f, 0.85f, 0.45f);
        public static readonly Color Warn = new Color(1f, 0.75f, 0.2f);
        public static readonly Color Bad = new Color(1f, 0.32f, 0.32f);
        public static readonly Color Neutral = new Color(0.92f, 0.92f, 0.92f);

        readonly Font _font;
        RectTransform _safe;
        Text _status;
        Text _message;
        RectTransform _rows;
        GameObject _crosshair;

        public Phase0Ui()
        {
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        }

        public void Build()
        {
            if (UnityEngine.Object.FindFirstObjectByType<EventSystem>() == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem));
#if ENABLE_INPUT_SYSTEM
                es.AddComponent<InputSystemUIInputModule>();
#else
                es.AddComponent<StandaloneInputModule>();
#endif
            }

            var canvasGo = new GameObject("Phase0 UI", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight = 0f;

            _safe = NewRect("SafeArea", canvasGo.transform);
            Stretch(_safe);
            ApplySafeArea();

            // Top status panel.
            var top = NewRect("Status", _safe);
            top.anchorMin = new Vector2(0, 1);
            top.anchorMax = new Vector2(1, 1);
            top.pivot = new Vector2(0.5f, 1);
            top.offsetMin = new Vector2(24, -520);
            top.offsetMax = new Vector2(-24, -24);
            top.gameObject.AddComponent<Image>().color = PanelColor;
            _status = NewText(top, 30, TextAnchor.UpperLeft);
            Inset(_status.rectTransform, 28, 22);

            // Crosshair.
            _crosshair = NewRect("Crosshair", _safe).gameObject;
            var ch = (RectTransform)_crosshair.transform;
            ch.anchorMin = ch.anchorMax = new Vector2(0.5f, 0.5f);
            ch.sizeDelta = new Vector2(64, 64);
            var h = NewRect("h", ch); h.sizeDelta = new Vector2(64, 4); h.gameObject.AddComponent<Image>().color = Color.white;
            var v = NewRect("v", ch); v.sizeDelta = new Vector2(4, 64); v.gameObject.AddComponent<Image>().color = Color.white;
            _crosshair.SetActive(false);

            // Bottom area: message + button rows.
            var bottom = NewRect("Bottom", _safe);
            bottom.anchorMin = new Vector2(0, 0);
            bottom.anchorMax = new Vector2(1, 0);
            bottom.pivot = new Vector2(0.5f, 0);
            bottom.offsetMin = new Vector2(24, 24);
            bottom.offsetMax = new Vector2(-24, 24);
            var bottomLayout = bottom.gameObject.AddComponent<VerticalLayoutGroup>();
            bottomLayout.spacing = 16;
            bottomLayout.childControlHeight = true;
            bottomLayout.childControlWidth = true;
            bottomLayout.childForceExpandHeight = false;
            bottomLayout.childForceExpandWidth = true;
            bottom.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            var msgPanel = NewRect("Message", bottom);
            msgPanel.gameObject.AddComponent<Image>().color = PanelColor;
            var msgLayout = msgPanel.gameObject.AddComponent<VerticalLayoutGroup>();
            msgLayout.padding = new RectOffset(28, 28, 20, 20);
            msgLayout.childControlHeight = true;
            msgLayout.childControlWidth = true;
            _message = NewText(msgPanel, 34, TextAnchor.MiddleLeft);

            _rows = NewRect("Rows", bottom);
            var rowsLayout = _rows.gameObject.AddComponent<VerticalLayoutGroup>();
            rowsLayout.spacing = 14;
            rowsLayout.childControlHeight = true;
            rowsLayout.childControlWidth = true;
            rowsLayout.childForceExpandHeight = false;
            rowsLayout.childForceExpandWidth = true;
        }

        public void ApplySafeArea()
        {
            if (_safe == null) return;
            var sa = Screen.safeArea;
            var w = Mathf.Max(1, Screen.width);
            var hgt = Mathf.Max(1, Screen.height);
            _safe.anchorMin = new Vector2(sa.xMin / w, sa.yMin / hgt);
            _safe.anchorMax = new Vector2(sa.xMax / w, sa.yMax / hgt);
            _safe.offsetMin = _safe.offsetMax = Vector2.zero;
        }

        public void SetStatus(string richText) => _status.text = richText;

        public void SetMessage(string text, Color? color = null)
        {
            _message.text = text;
            _message.color = color ?? Neutral;
        }

        public void ShowCrosshair(bool show) => _crosshair.SetActive(show);

        /// <summary>Replace all buttons. Each inner list is one row.</summary>
        public void SetRows(List<List<ButtonSpec>> rows)
        {
            for (int i = _rows.childCount - 1; i >= 0; i--)
            {
                UnityEngine.Object.Destroy(_rows.GetChild(i).gameObject);
            }

            foreach (var row in rows)
            {
                var rowRt = NewRect("Row", _rows);
                var hl = rowRt.gameObject.AddComponent<HorizontalLayoutGroup>();
                hl.spacing = 14;
                hl.childControlHeight = true;
                hl.childControlWidth = true;
                hl.childForceExpandWidth = true;
                hl.childForceExpandHeight = true;
                var le = rowRt.gameObject.AddComponent<LayoutElement>();
                le.minHeight = le.preferredHeight = 124;

                foreach (var spec in row)
                {
                    var b = NewRect("Button", rowRt);
                    var img = b.gameObject.AddComponent<Image>();
                    img.color = spec.Primary ? PrimaryColor : ButtonColor;
                    var button = b.gameObject.AddComponent<Button>();
                    button.interactable = spec.Interactable;
                    var colors = button.colors;
                    colors.disabledColor = new Color(1f, 1f, 1f, 0.35f);
                    button.colors = colors;
                    var action = spec.OnClick;
                    if (action != null) button.onClick.AddListener(() => action());
                    var t = NewText(b, 32, TextAnchor.MiddleCenter);
                    t.text = spec.Label;
                    t.fontStyle = FontStyle.Bold;
                    Inset(t.rectTransform, 10, 6);
                }
            }
        }

        RectTransform NewRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        Text NewText(Transform parent, int size, TextAnchor anchor)
        {
            var rt = NewRect("Text", parent);
            Stretch(rt);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = _font;
            t.fontSize = size;
            t.alignment = anchor;
            t.color = Neutral;
            t.supportRichText = true;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }

        static void Inset(RectTransform rt, float x, float y)
        {
            rt.offsetMin = new Vector2(x, y);
            rt.offsetMax = new Vector2(-x, -y);
        }
    }
}
