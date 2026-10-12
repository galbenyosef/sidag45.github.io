// Server-side copy of the page's analysis and quality checks (same algorithm, same thresholds).
// YIN pitch tracking at 12 kHz, level, clipping, voiced ratio, steady-vowel search, rough timbre.

const ASR = 12000, AW = 600, AH = 192;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hz2midi = (f) => 69 + 12 * Math.log2(f / 440);

function resampleTo12k(x, sr) {
  if (sr === ASR) return x;
  // windowed-sinc low-pass at 5 kHz, then linear interpolation
  const fc = 5000 / sr, taps = 63, h = new Float32Array(taps), mid = (taps - 1) / 2;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const n = i - mid, w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (taps - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (taps - 1));
    h[i] = (n === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * n) / (Math.PI * n)) * w; sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let s = 0;
    for (let k = 0; k < taps; k++) { const j = i + k - mid; if (j >= 0 && j < x.length) s += x[j] * h[k]; }
    y[i] = s;
  }
  const n = Math.max(1, Math.floor(x.length * ASR / sr)), out = new Float32Array(n), r = sr / ASR;
  for (let i = 0; i < n; i++) { const p = i * r, a = Math.floor(p), f = p - a; out[i] = (y[a] || 0) * (1 - f) + (y[a + 1] || 0) * f; }
  return out;
}

export function analyse(samples, sampleRate) {
  const x = resampleTo12k(samples, sampleRate);
  const tMin = Math.floor(ASR / 1000), tMax = Math.ceil(ASR / 65);
  const nF = Math.max(1, Math.floor((x.length - AW - tMax) / AH) + 1);
  const rms = new Float32Array(nF), f0 = new Float32Array(nF), d = new Float32Array(tMax + 1);
  let maxR = 0;
  for (let f = 0; f < nF; f++) {
    const o = f * AH; let e = 0;
    for (let j = 0; j < AW; j++) { const v = x[o + j] || 0; e += v * v; }
    rms[f] = Math.sqrt(e / AW); if (rms[f] > maxR) maxR = rms[f];
  }
  const gate = Math.max(maxR * 0.1, 0.003);
  for (let f = 0; f < nF; f++) {
    if (rms[f] < gate) continue;
    const o = f * AH;
    for (let tau = 1; tau <= tMax; tau++) {
      let s = 0;
      for (let j = 0; j < AW; j++) { const q = (x[o + j] || 0) - (x[o + j + tau] || 0); s += q * q; }
      d[tau] = s;
    }
    let run = 0, best = -1;
    for (let tau = 1; tau <= tMax; tau++) { run += d[tau]; d[tau] = run > 0 ? d[tau] * tau / run : 1; }
    for (let tau = tMin; tau <= tMax; tau++) {
      if (d[tau] < 0.15) { while (tau + 1 <= tMax && d[tau + 1] < d[tau]) tau++; best = tau; break; }
    }
    if (best > 0) {
      const a = d[best - 1], b = d[best], c = d[Math.min(tMax, best + 1)];
      const den = a - 2 * b + c, sh = den ? 0.5 * (a - c) / den : 0;
      f0[f] = ASR / (best + clamp(sh, -1, 1));
    }
  }
  const raw = Array.from(f0, (v) => (v > 0 ? hz2midi(v) : NaN));
  const vm = raw.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  const med = vm.length ? vm[vm.length >> 1] : 60;
  for (let i = 0; i < nF; i++) {
    let m = raw[i]; if (Number.isNaN(m)) continue;
    if (m - med > 8) m -= 12; else if (med - m > 8) m += 12;
    raw[i] = Math.abs(m - med) > 12 ? NaN : m;
  }
  for (let i = 1; i < nF - 1; i++) if (Number.isNaN(raw[i - 1]) && Number.isNaN(raw[i + 1])) raw[i] = NaN;
  const hop = AH / ASR;
  let active = 0, voiced = 0;
  const vs = [];
  for (let i = 0; i < nF; i++) { if (rms[i] >= gate) active++; if (!Number.isNaN(raw[i])) { voiced++; vs.push(raw[i]); } }
  vs.sort((a, b) => a - b);
  const q = (p) => (vs.length ? vs[Math.min(vs.length - 1, Math.floor(p * vs.length))] : 60);
  let pk = 0, clip = 0, ex = 0, ed = 0, prev = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i], av = Math.abs(v); if (av > pk) pk = av; if (av >= 0.985) clip++;
    ex += v * v; const dv = v - prev; ed += dv * dv; prev = v;
  }
  const centroid = sampleRate / (2 * Math.PI) * Math.sqrt(ed / (ex || 1));
  // sound length = span between first and last frame above the gate
  let first = -1, last = -1;
  for (let i = 0; i < nF; i++) if (rms[i] >= gate) { if (first < 0) first = i; last = i; }
  const soundSec = first < 0 ? 0 : (last - first + 1) * hop;
  return {
    duration: samples.length / sampleRate, soundSec, peak: pk, clipFrac: clip / (samples.length || 1),
    voicedRatio: active ? voiced / active : 0, voicedSec: voiced * hop,
    medianMidi: q(0.5), lowMidi: q(0.1), highMidi: q(0.9), centroid,
    timbre: centroid < 680 ? 'warm' : centroid < 800 ? 'balanced' : 'bright',
  };
}

// The automated quality gate. Returns null when the clip passes, otherwise a reason code.
export function qualityGate(A) {
  if (A.duration > 10.6) return 'too_long';
  if (A.peak <= 0.015) return 'silent';
  if (A.clipFrac >= 0.003) return 'distorted';
  if (A.soundSec < 1.2) return 'too_short';
  if (A.voicedRatio < 0.3 || A.voicedSec < 0.5) return 'not_voice';
  return null;
}
