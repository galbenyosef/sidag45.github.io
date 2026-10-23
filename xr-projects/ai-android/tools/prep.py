"""Precompute cutout, depth map and facial feature data for the Three.js android head."""
import json, sys
import numpy as np, cv2
import mediapipe as mp
from scipy.ndimage import distance_transform_edt, gaussian_filter
from scipy.interpolate import griddata

src, outdir = sys.argv[1], sys.argv[2]
img = cv2.imread(src)                      # BGR 1024x1024
H, W = img.shape[:2]
rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

# ---------- landmarks ----------
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True, max_num_faces=1) as fm:
    res = fm.process(rgb)
lm = np.array([[p.x * W, p.y * H, p.z * W] for p in res.multi_face_landmarks[0].landmark])

# ---------- segmentation ----------
with mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0) as ss:
    seg = ss.process(rgb).segmentation_mask
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
whiteish = ((hsv[..., 2] > 238) & (hsv[..., 1] < 18)).astype(np.float32)
# connected white background from the borders only
ff = (whiteish * 255).astype(np.uint8)
mask_bg = np.zeros((H + 2, W + 2), np.uint8)
bg = np.zeros((H, W), np.uint8)
for seed in [(0, 0), (W - 1, 0), (0, H // 3), (W - 1, H // 3), (W // 2, 0)]:
    if ff[seed[1], seed[0]]:
        tmp = ff.copy(); m2 = np.zeros((H + 2, W + 2), np.uint8)
        cv2.floodFill(tmp, m2, seed, 128)
        bg |= (tmp == 128).astype(np.uint8)
alpha = np.clip(seg * 1.15, 0, 1)
alpha = np.where(bg > 0, np.minimum(alpha, 0.0), np.maximum(alpha, 0.0))
alpha = np.where(bg == 0, np.maximum(alpha, (seg > 0.2).astype(np.float32)), alpha)
alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, np.ones((3, 3)))
alpha = cv2.GaussianBlur(alpha, (5, 5), 0)
alpha = np.clip((alpha - 0.15) / 0.7, 0, 1)

# refine edge alpha against the white backdrop + colour decontamination
f = img.astype(np.float32)
solid = (alpha > 0.5).astype(np.uint8)
core = cv2.erode(solid, np.ones((31, 31))) > 0
near = cv2.dilate(solid, np.ones((41, 41))) > 0
band = near & ~core
aw = np.clip((255 - f.min(axis=2) - 22) / 85.0, 0, 1)
alpha = np.where(core, alpha, np.where(near, aw, 0.0))
alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
a3 = np.clip(alpha, 0.05, 1)[..., None]
dec = np.clip((f - (1 - a3) * 255) / a3, 0, 255)
img_out = np.where(band[..., None], dec, f).astype(np.uint8)
rgba = np.dstack([img_out, (alpha * 255).astype(np.uint8)])
cv2.imwrite(f"{outdir}/mira-color.png", rgba)

# ---------- depth ----------
S = 512; sc = S / W
a_s = cv2.resize(alpha, (S, S), interpolation=cv2.INTER_AREA)
m = (a_s > 0.5)
d = distance_transform_edt(m)
R = 70.0
base = np.where(d < R, np.sqrt(np.clip(1 - (1 - d / R) ** 2, 0, 1)), 1.0) * 0.18

yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
P = lm[:, :2] * sc
fz = -lm[:, 2] * sc                        # bigger = closer to camera
face_cx, face_cy = P[:, 0].mean(), P[:, 1].mean()
face_w = P[:, 0].max() - P[:, 0].min()
face_h = P[:, 1].max() - P[:, 1].min()

# head ellipsoid (in units of image px at 512)
hx, hy = face_w * 0.98, face_h * 0.92
hcx, hcy = face_cx, face_cy - face_h * 0.06
e = 1 - ((xx - hcx) / hx) ** 2 - ((yy - hcy) / hy) ** 2
head = np.power(np.clip(e, 0, 1), 0.65) * face_w * 0.55   # softer than a sphere: no vertical walls

# neck/torso cylinders
neck = np.sqrt(np.clip(1 - ((xx - face_cx) / (face_w * 0.42)) ** 2, 0, 1)) * face_w * 0.30
neck *= ((yy > face_cy) & (yy < face_cy + face_h * 1.1))
torso = np.sqrt(np.clip(1 - ((xx - face_cx) / (S * 0.52)) ** 2, 0, 1)) * face_w * 0.32
torso *= np.clip((yy - (face_cy + face_h * 0.75)) / 30, 0, 1)

# face detail from landmarks, aligned to the ellipsoid
hull = cv2.convexHull(P.astype(np.float32)).reshape(-1, 2)
fmask = np.zeros((S, S), np.uint8)
cv2.fillConvexPoly(fmask, hull.astype(np.int32), 1)
F = griddata(P, fz, (xx, yy), method="cubic")
Fn = griddata(P, fz, (xx, yy), method="nearest")
F = np.where(np.isnan(F), Fn, F)
detail = gaussian_filter(F - gaussian_filter(F, 18), 2.2)
hull_idx = cv2.convexHull(P.astype(np.float32), returnPoints=False).reshape(-1)
bd = P[hull_idx].astype(int)
off = np.mean(head[bd[:, 1].clip(0, S - 1), bd[:, 0].clip(0, S - 1)] - fz[hull_idx])
F = F + off
din = distance_transform_edt(fmask)
wface = np.clip(din / 26.0, 0, 1); wface = wface * wface * (3 - 2 * wface)
headface = head + detail * 1.25 * wface

z = np.maximum.reduce([headface, neck, torso])
z = z / (face_w * 0.55)                    # normalise ~ 0..1.3
z = z * 0.82 + base
z = gaussian_filter(z, 5.0) * m + 0.0
# soften the silhouette
z *= np.clip(d / 6.0, 0, 1)
z = gaussian_filter(z, 0.8)
zmax = z.max()
z16 = (z / zmax * 65535).astype(np.uint16)
cv2.imwrite(f"{outdir}/mira-depth16.png", z16)
z8 = (z / zmax * 255).astype(np.uint8)
cv2.imwrite(f"{outdir}/mira-depth.png", z8)

# ---------- features (normalised uv, y down) ----------
def uv(i): return [float(lm[i, 0] / W), float(lm[i, 1] / H)]
def eye(up, lo, a, b, iris):
    cx = (lm[a, 0] + lm[b, 0]) / 2 / W
    cy = (lm[up, 1] + lm[lo, 1]) / 2 / H
    return {"c": [float(cx), float(cy)],
            "hx": float(abs(lm[a, 0] - lm[b, 0]) / 2 / W),
            "hy": float(abs(lm[lo, 1] - lm[up, 1]) / 2 / H),
            "iris": uv(iris)}

# LED: brightest cyan blob
b, g, r = [img[..., i].astype(np.float32) for i in range(3)]
cyan = (g + b) / 2 - r
cyan[alpha < 0.5] = 0
cyan = np.clip(cyan, 0, None)
cy_, cx_ = np.unravel_index(np.argmax(gaussian_filter(cyan, 6)), cyan.shape)
ys, xs = np.where((cyan > 40) & (np.hypot(np.arange(W)[None, :] - cx_, np.arange(H)[:, None] - cy_) < 40))
cx_, cy_ = (float(xs.mean()), float(ys.mean())) if len(xs) else (cx_, cy_)
led_r = float(np.percentile(np.hypot(xs - cx_, ys - cy_), 90)) if len(xs) else 9.0

# remove the painted ring so the shader can draw a live one
ledmask = np.zeros((H, W), np.uint8)
cv2.ellipse(ledmask, (int(cx_), int(cy_)), (18, 25), 0, 0, 360, 255, -1)
ring = ((cyan > 8) & (ledmask > 0)).astype(np.uint8) * 255
ring = cv2.dilate(ring, np.ones((9, 9)))
clean = cv2.inpaint(rgba[..., :3], ring, 6, cv2.INPAINT_TELEA)
rgba[..., :3] = clean
cv2.imwrite(f"{outdir}/mira-color.png", rgba)

feat = {
    "size": [W, H],
    "eyeR": eye(159, 145, 33, 133, 468),   # subject right = image left
    "eyeL": eye(386, 374, 362, 263, 473),
    "mouth": {"c": [float((lm[78, 0] + lm[308, 0]) / 2 / W), float((lm[13, 1] + lm[14, 1]) / 2 / H)],
              "hw": float(abs(lm[61, 0] - lm[291, 0]) / 2 / W),
              "chin": uv(152), "lowerLip": uv(17),
              "cornerY": float((lm[78, 1] + lm[308, 1]) / 2 / H)},
    "led": {"c": [float(cx_ / W), float(cy_ / H)], "rx": 8.5 / W, "ry": 14.0 / H},
    "face": {"c": [float(face_cx / S), float(face_cy / S)], "w": float(face_w / S), "h": float(face_h / S)},
    "depthMax": float(zmax),
}
json.dump(feat, open(f"{outdir}/mira-features.json", "w"), indent=1)
print(json.dumps(feat, indent=1))
