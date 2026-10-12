// Browser + backend together: the page talks to the real Lambda handler code (with in-memory AWS fakes).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { S3, DB, fake } from './fakes.mjs';
import { handler as api } from '../src/handlers/api.mjs';
import { handler as ingest } from '../src/handlers/ingest.mjs';
import { handler as moderate } from '../src/handlers/moderate.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright'); // npm i -D playwright
process.env.MAX_SUBMISSIONS_PER_IP_PER_HOUR = '50';
process.env.AWS_ACCESS_KEY_ID = 'AKIAFAKE'; process.env.AWS_SECRET_ACCESS_KEY = 'fake';

// three approved voices already in the pool
for (let i = 0; i < 3; i++) {
  const id = `00000000-0000-4000-8000-00000000000${i}`;
  S3.set(`pool/${id}.wav`, fs.readFileSync(`pool${i}.wav`));
  DB.set(id, { id, status: 'approved', createdAt: Date.now() - i * 1000, analysis: { medianMidi: 50 + i * 6 } });
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-withdraw-token', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS' };
const log = [];
async function apiRoute(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  let routeKey = `${m} ${u.pathname}`, pathParameters;
  const vm = /^\/voices\/(.+)$/.exec(u.pathname); if (vm) { routeKey = `${m} /voices/{id}`; pathParameters = { id: vm[1] }; }
  const res = await api({ routeKey, pathParameters, body: req.postData(), headers: req.headers(), queryStringParameters: Object.fromEntries(u.searchParams), requestContext: { http: { sourceIp: '1.2.3.4' } } });
  log.push(`${routeKey} → ${res.statusCode}`);
  return route.fulfill({ status: res.statusCode, headers: { ...CORS, ...res.headers }, body: res.body });
}
async function s3Route(route) {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS });
  const ct = req.headers()['content-type'], boundary = '--' + /boundary=(.+)$/.exec(ct)[1];
  const raw = req.postDataBuffer().toString('latin1'), parts = raw.split(boundary).slice(1, -1), fields = {};
  let file;
  for (const p of parts) {
    const [h, ...rest] = p.split('\r\n\r\n'), body = rest.join('\r\n\r\n').replace(/\r\n$/, ''), name = /name="([^"]+)"/.exec(h)[1];
    if (name === 'file') file = Buffer.from(body, 'latin1'); else fields[name] = body;
  }
  assert.equal(fields['Content-Type'], 'audio/wav'); assert.ok(fields.Policy && fields['X-Amz-Signature']);
  S3.set(fields.key, file); log.push(`S3 upload ${fields.key} ${file.length}B`);
  // the real pipeline runs asynchronously after the upload
  setTimeout(async () => {
    await ingest({ Records: [{ s3: { object: { key: fields.key, size: file.length } } }] });
    const id = fields.key.slice(9, 45);
    if (DB.get(id)?.status === 'moderating') {
      S3.set(`transcripts/${id}.json`, Buffer.from(JSON.stringify({ results: { transcripts: [{ transcript: fake.transcript }] } })));
      setTimeout(() => moderate({ detail: { TranscriptionJobName: `vow-${id}`, TranscriptionJobStatus: 'COMPLETED' } }), 800);
    }
  }, 300);
  return route.fulfill({ status: 204, headers: CORS });
}
async function cdnRoute(route) {
  const key = new URL(route.request().url()).pathname.slice(1);
  if (!S3.has(key)) return route.fulfill({ status: 403, headers: CORS });
  return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'audio/wav' }, body: S3.get(key) });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=' + process.cwd() + '/mic.wav'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
await ctx.route('https://api.test/**', apiRoute);
await ctx.route(/https:\/\/vow-voices-test\.s3\.[^/]+\.amazonaws\.com\//, (r) => s3Route(r).catch((e) => { console.log('s3Route error', e); return r.fulfill({ status: 500, headers: CORS }); }));
await ctx.route('https://cdn.test/**', cdnRoute);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('requestfailed', (r) => console.log('FAILED', r.method(), r.url(), r.failure()?.errorText)); page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('CONSOLE', m.text()); });
const URL_ = `${process.env.SITE || 'http://localhost:8765'}/index.html?api=https://api.test`; // serve the project folder, e.g. python3 -m http.server 8765
let n = 0; const ok = (m) => console.log(`  ✓ ${++n}. ${m}`);

await page.goto(URL_);
await page.waitForFunction(() => window.__vow.ready && window.__vow.voices.length >= 8, null, { timeout: 30000 });
const names = await page.evaluate(() => window.__vow.voices.map((v) => v.name));
assert.equal(names.filter((x) => x === 'A voice from the world').length, 3); assert.equal(names.length, 8);
ok('page loads 3 shared voices from the pool and tops up with 5 seed voices');

async function addVoice() {
  await page.click('#addBtn'); await page.check('#c1'); await page.check('#c2');
  assert.match(await page.textContent('#privacyNote'), /No person listens/);
  await page.click('#toRecord'); await page.click('#recBtn'); await page.waitForTimeout(4200); await page.click('#recBtn');
  await page.waitForSelector('#toCheck:not([hidden])'); await page.click('#toCheck');
  await page.waitForSelector('#join', { timeout: 15000 }); await page.waitForTimeout(1700); await page.click('#join');
}
await page.click('#playBtn');
fake.transcript = 'hello from College Park'; fake.tox = 0.03; fake.lang = 'en-US';
await addVoice();
await page.waitForFunction(() => document.querySelector('#yourList small')?.textContent === 'Being checked', null, { timeout: 10000 }).catch(async (e) => { console.log('chip:', await page.textContent('#yours').catch(()=>''), 'toast:', await page.textContent('#toast'), log, errs); throw e; });
ok('after joining, the chip shows "Being checked" while it uploads and runs through the pipeline');
await page.waitForFunction(() => document.querySelector('#yourList small')?.textContent === 'In the world choir', null, { timeout: 20000 });
const mine = await page.evaluate(() => JSON.parse(localStorage.getItem('vow.mine')));
assert.equal(mine.length, 1); assert.ok(S3.has(`pool/${mine[0].id}.wav`));
assert.match(await page.textContent('#toast'), /passed the checks/);
await page.screenshot({ path: 'e2e-approved.png' });
ok('voice passed moderation, landed in pool/, and the page says so');

await page.reload();
await page.waitForFunction(() => window.__vow.voices.filter((v) => v.poolId).length >= 4, null, { timeout: 30000 });
const own = await page.evaluate(() => window.__vow.voices.filter((v) => v.own).map((v) => [v.name, v.remote && v.remote.state]));
assert.deepEqual(own, [['Your voice', 'approved']]); assert.equal(await page.isHidden('#yours'), false);
ok('after a reload the shared pool includes your voice, recognised as yours with a Withdraw button');

await page.click('#yourList button');
await page.waitForFunction(() => document.getElementById('yours').hidden, null, { timeout: 10000 });
assert.ok(!S3.has(`pool/${mine[0].id}.wav`)); assert.ok(!DB.has(mine[0].id));
assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('vow.mine')).length), 0);
ok('Withdraw deletes it from storage and the database');

await page.click('#playBtn').catch(() => {});
fake.transcript = 'something abusive'; fake.tox = 0.93;
await addVoice();
await page.waitForFunction(() => /content check/.test(document.getElementById('toast').textContent), null, { timeout: 20000 });
await page.waitForTimeout(1500);
assert.equal(await page.evaluate(() => window.__vow.voices.filter((v) => v.own).length), 0);
assert.equal([...S3.keys()].filter((k) => k.startsWith('pool/')).length, 3);
ok('a clip that fails moderation is removed from the page and never reaches the pool');

console.log('\n' + log.join('\n'));
console.log('page errors:', errs);
await browser.close();
console.log(`\nAll ${n} browser checks passed.`);
