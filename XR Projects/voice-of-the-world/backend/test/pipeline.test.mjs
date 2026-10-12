// End-to-end test of the pipeline against in-memory fakes of S3, DynamoDB, Transcribe, Translate, Comprehend, CloudFront.
// Run: node test/pipeline.test.mjs   (from backend/, after `npm install` in src/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3, DB, calls, fake } from './fakes.mjs';
import { handler as api } from '../src/handlers/api.mjs';
import { handler as ingest } from '../src/handlers/ingest.mjs';
import { handler as moderate } from '../src/handlers/moderate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------- helpers ----------
const consent = { ownVoice: true, agree: true, version: '2026-10-v1' };
let ipN = 0;
const post = (b, ip) => api({ routeKey: 'POST /submissions', body: JSON.stringify(b), requestContext: { http: { sourceIp: ip || `10.0.0.${++ipN}` } } });
const status = async (id) => JSON.parse((await api({ routeKey: 'GET /voices/{id}', pathParameters: { id } })).body);
async function submit(wavFile, opts = {}) {
  const r = await post({ consent });
  assert.equal(r.statusCode, 201, r.body);
  const { id, token, upload } = JSON.parse(r.body);
  assert.equal(upload.fields.key, `incoming/${id}.wav`);
  assert.ok(upload.fields.Policy && upload.url.includes('vow-voices-test'));
  S3.set(`incoming/${id}.wav`, fs.readFileSync(path.join(here, wavFile)));
  await ingest({ Records: [{ s3: { object: { key: `incoming/${id}.wav`, size: S3.get(`incoming/${id}.wav`).length } } }] });
  if (DB.get(id).status === 'moderating') {
    Object.assign(fake, { transcript: '', lang: 'en-US', tox: 0.02, pii: [], jobStatus: 'COMPLETED' }, opts);
    S3.set(`transcripts/${id}.json`, Buffer.from(JSON.stringify({ results: { transcripts: [{ transcript: fake.transcript }] } })));
    await moderate({ detail: { TranscriptionJobName: `vow-${id}`, TranscriptionJobStatus: fake.jobStatus } });
  }
  return { id, token, st: await status(id) };
}

// ---------- tests ----------
let n = 0; const ok = (m) => console.log(`  ✓ ${++n}. ${m}`);

assert.equal((await post({})).statusCode, 400); ok('no consent → 400');
assert.equal((await post({ consent: { ...consent, version: 'old' } })).statusCode, 400); ok('stale consent version → 400');

const a = await submit('voice.wav', { transcript: '' });
assert.equal(a.st.status, 'approved'); assert.ok(S3.has(`pool/${a.id}.wav`)); assert.ok(!S3.has(`incoming/${a.id}.wav`)); assert.ok(!S3.has(`transcripts/${a.id}.json`));
assert.deepEqual(fake.lastJob.LanguageOptions.length, 5); assert.equal(fake.lastJob.IdentifyLanguage, true);
assert.equal(a.st.url, `https://cdn.test/pool/${a.id}.wav`);
assert.ok(Math.abs(DB.get(a.id).analysis.medianMidi - 54) < 0.6, 'server pitch analysis matches');
ok(`sung clip with no words → approved, moved to pool, transcript deleted (median ${DB.get(a.id).analysis.medianMidi})`);

const b = await submit('voice.wav', { transcript: 'hello from College Park' });
assert.equal(b.st.status, 'approved'); ok('clean words → approved');

const c = await submit('voice.wav', { transcript: 'something nasty', tox: 0.91 });
assert.equal(c.st.status, 'rejected'); assert.match(c.st.reason, /content check/); assert.ok(!S3.has(`incoming/${c.id}.wav`) && !S3.has(`pool/${c.id}.wav`));
ok('toxic words → rejected and deleted');

const d = await submit('voice.wav', { transcript: 'call me on 555 0100', pii: [{ Type: 'PHONE', Score: 0.98 }] });
assert.equal(d.st.status, 'rejected'); assert.match(d.st.reason, /personal details/); ok('phone number → rejected');

const d2 = await submit('voice.wav', { transcript: "hi I'm Sam", pii: [{ Type: 'NAME', Score: 0.99 }] });
assert.equal(d2.st.status, 'approved'); ok('first name only → approved');

const e = await submit('voice.wav', { transcript: 'hola desde Madrid', lang: 'es-US' });
assert.equal(e.st.status, 'approved'); assert.equal(fake.translated.SourceLanguageCode, 'auto'); ok('Spanish → translated before checking');

const f = await submit('voice.wav', { jobStatus: 'FAILED' });
assert.equal(f.st.status, 'rejected'); assert.match(f.st.reason, /couldn't check/); ok('transcription failed → rejected (fails closed)');

const g = await submit('noise.wav');
assert.equal(g.st.status, 'rejected'); assert.match(g.st.reason, /voice/); assert.ok(!S3.has(`incoming/${g.id}.wav`)); ok('noise → rejected at quality gate, never transcribed');
const h = await submit('hot.wav');
assert.equal(h.st.status, 'rejected'); assert.match(h.st.reason, /distorted/); ok('clipped audio → rejected');

S3.set('incoming/garbage.wav', Buffer.from('x')); await ingest({ Records: [{ s3: { object: { key: 'incoming/garbage.wav', size: 1 } } }] });
assert.ok(!S3.has('incoming/garbage.wav')); ok('upload with unknown id → deleted');

const p = JSON.parse((await api({ routeKey: 'GET /pool', queryStringParameters: { n: '16' } })).body);
assert.equal(p.voices.length, 4); assert.ok(p.voices.every((v) => v.url.startsWith('https://cdn.test/pool/') && v.medianMidi)); ok(`pool lists the ${p.voices.length} approved voices only`);

assert.equal((await api({ routeKey: 'DELETE /voices/{id}', pathParameters: { id: a.id }, headers: { 'x-withdraw-token': 'wrong' } })).statusCode, 403); ok('withdraw with wrong token → 403');
assert.equal((await api({ routeKey: 'DELETE /voices/{id}', pathParameters: { id: a.id }, headers: { 'x-withdraw-token': a.token } })).statusCode, 204);
assert.ok(!S3.has(`pool/${a.id}.wav`) && !DB.has(a.id) && calls.includes(`Invalidate:/pool/${a.id}.wav`)); ok('withdraw → file, record and CDN cache removed');
assert.equal((await status(a.id)).error, 'not_found'); ok('withdrawn voice is gone');

// withdraw during moderation → moderation step cleans up instead of publishing
const r = JSON.parse((await post({ consent })).body);
S3.set(`incoming/${r.id}.wav`, fs.readFileSync(path.join(here, 'voice.wav')));
await ingest({ Records: [{ s3: { object: { key: `incoming/${r.id}.wav`, size: 1 } } }] });
await api({ routeKey: 'DELETE /voices/{id}', pathParameters: { id: r.id }, headers: { 'x-withdraw-token': r.token } });
S3.set(`incoming/${r.id}.wav`, Buffer.from('still here')); S3.set(`transcripts/${r.id}.json`, Buffer.from('{}'));
await moderate({ detail: { TranscriptionJobName: `vow-${r.id}`, TranscriptionJobStatus: 'COMPLETED' } });
assert.ok(!S3.has(`pool/${r.id}.wav`) && !S3.has(`incoming/${r.id}.wav`) && !S3.has(`transcripts/${r.id}.json`)); ok('withdrawn mid-moderation → never published');

const codes = []; for (let i = 0; i < 7; i++) codes.push((await post({ consent }, '9.9.9.9')).statusCode);
assert.deepEqual(codes, [201, 201, 201, 201, 201, 429, 429]); ok('6th submission from one IP in an hour → 429');

console.log(`\nAll ${n} checks passed.`);
