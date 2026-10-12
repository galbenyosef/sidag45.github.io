// Minimal, strict WAV reader. Accepts PCM 16-bit or 32-bit float, mono or stereo.
// Returns mono Float32 samples. Throws on anything else.
export function readWav(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length < 44 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not_wav');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4), body = off + 8;
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(body), channels: b.readUInt16LE(body + 2), sampleRate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    else if (id === 'data') { data = b.subarray(body, Math.min(b.length, body + size)); break; }
    off = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('bad_wav');
  const { format, channels, sampleRate, bits } = fmt;
  const pcm16 = format === 1 && bits === 16, f32 = format === 3 && bits === 32;
  if (!(pcm16 || f32) || channels < 1 || channels > 2 || sampleRate < 8000 || sampleRate > 48000) throw new Error('unsupported_wav');
  const bytes = bits / 8, frames = Math.floor(data.length / (bytes * channels)), out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) {
      const p = (i * channels + c) * bytes;
      s += pcm16 ? data.readInt16LE(p) / 32768 : data.readFloatLE(p);
    }
    out[i] = s / channels;
  }
  return { sampleRate, samples: out, duration: frames / sampleRate };
}
