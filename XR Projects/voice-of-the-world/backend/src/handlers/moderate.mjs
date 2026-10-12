// EventBridge "Transcribe Job State Change" → content moderation → publish to the pool or delete.
// Fails closed: anything that can't be checked is rejected and deleted. No transcript is kept.
import { GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GetTranscriptionJobCommand, DeleteTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { TranslateTextCommand } from '@aws-sdk/client-translate';
import { DetectToxicContentCommand, DetectPiiEntitiesCommand } from '@aws-sdk/client-comprehend';
import { clients, cfg } from '../lib/aws.mjs';

// personal details that should never be broadcast (names are fine: "hi, I'm Sam")
const PII_BLOCK = new Set(['ADDRESS', 'PHONE', 'EMAIL', 'SSN', 'CREDIT_DEBIT_NUMBER', 'CREDIT_DEBIT_CVV', 'BANK_ACCOUNT_NUMBER', 'BANK_ROUTING', 'PASSPORT_NUMBER', 'DRIVER_ID', 'PIN', 'PASSWORD', 'USERNAME', 'IP_ADDRESS', 'URL']);

export async function handler(event) {
  const C = cfg();
  const name = event.detail?.TranscriptionJobName || '';
  const m = /^vow-([0-9a-f-]{36})$/.exec(name);
  if (!m) return;
  return moderateOne(C, m[1], event.detail.TranscriptionJobStatus);
}

async function cleanup(C, id, keepIncoming = false) {
  const jobs = [
    clients.s3.send(new DeleteObjectCommand({ Bucket: C.bucket, Key: `transcripts/${id}.json` })),
    clients.transcribe.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: `vow-${id}` })),
  ];
  if (!keepIncoming) jobs.push(clients.s3.send(new DeleteObjectCommand({ Bucket: C.bucket, Key: `incoming/${id}.wav` })));
  await Promise.allSettled(jobs);
}

async function setStatus(C, id, status, extra = {}) {
  const names = { '#s': 'status' }, values = { ':s': status }, sets = ['#s = :s'], removes = [];
  for (const [k, v] of Object.entries(extra)) {
    if (v === null) removes.push(k); else { sets.push(`${k} = :${k}`); values[`:${k}`] = v; }
  }
  await clients.ddb.send(new UpdateCommand({
    TableName: C.table, Key: { id },
    UpdateExpression: `SET ${sets.join(', ')}${removes.length ? ' REMOVE ' + removes.join(', ') : ''}`,
    ConditionExpression: 'attribute_exists(id)',
    ExpressionAttributeNames: names, ExpressionAttributeValues: values,
  }));
}

async function reject(C, id, reason) {
  await cleanup(C, id);
  await setStatus(C, id, 'rejected', { reason, expiresAt: Math.floor(Date.now() / 1000) + 86400 }).catch(() => {});
  console.log(JSON.stringify({ id, result: 'rejected', reason }));
}

// Split text into ≤10 segments of ≤900 bytes for DetectToxicContent.
function segments(text) {
  const words = text.split(/\s+/), out = [];
  let cur = '';
  for (const w of words) {
    if (Buffer.byteLength(cur + ' ' + w) > 900) { if (cur) out.push(cur); cur = w.slice(0, 300); } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  return out.slice(0, 10).map((Text) => ({ Text }));
}

export async function moderateOne(C, id, status) {
  const { Item } = await clients.ddb.send(new GetCommand({ TableName: C.table, Key: { id } }));
  if (!Item || Item.status !== 'moderating') { await cleanup(C, id); return; } // withdrawn meanwhile
  if (status !== 'COMPLETED') return reject(C, id, 'check_failed');

  let text = '', lang = 'en-US';
  try {
    const job = await clients.transcribe.send(new GetTranscriptionJobCommand({ TranscriptionJobName: `vow-${id}` }));
    lang = job.TranscriptionJob?.LanguageCode || lang;
    const obj = await clients.s3.send(new GetObjectCommand({ Bucket: C.bucket, Key: `transcripts/${id}.json` }));
    const t = JSON.parse(await obj.Body.transformToString());
    text = (t.results?.transcripts || []).map((x) => x.transcript).join(' ').trim();
  } catch (err) {
    console.error('transcript read failed', err);
    return reject(C, id, 'check_failed');
  }

  let maxTox = 0;
  if (text) {
    try {
      let en = text;
      if (!lang.startsWith('en')) {
        const tr = await clients.translate.send(new TranslateTextCommand({ Text: text.slice(0, 4000), SourceLanguageCode: 'auto', TargetLanguageCode: 'en' }));
        en = tr.TranslatedText || text;
      }
      const tox = await clients.comprehend.send(new DetectToxicContentCommand({ LanguageCode: 'en', TextSegments: segments(en) }));
      for (const r of tox.ResultList || []) {
        maxTox = Math.max(maxTox, r.Toxicity || 0, ...(r.Labels || []).map((l) => l.Score || 0));
      }
      if (maxTox >= C.toxicity) return reject(C, id, 'content');
      const pii = await clients.comprehend.send(new DetectPiiEntitiesCommand({ LanguageCode: 'en', Text: en.slice(0, 4000) }));
      if ((pii.Entities || []).some((e) => PII_BLOCK.has(e.Type) && (e.Score || 0) >= 0.6)) return reject(C, id, 'personal_info');
    } catch (err) {
      console.error('moderation failed', err);
      return reject(C, id, 'check_failed');
    }
  }

  // approved: move into the public pool, forget the transcript
  await clients.s3.send(new CopyObjectCommand({
    Bucket: C.bucket, CopySource: `${C.bucket}/incoming/${id}.wav`, Key: `pool/${id}.wav`,
    ContentType: 'audio/wav', CacheControl: 'public, max-age=31536000, immutable', MetadataDirective: 'REPLACE',
  }));
  await cleanup(C, id);
  const expires = C.retentionDays > 0 ? Math.floor(Date.now() / 1000) + C.retentionDays * 86400 : null;
  await setStatus(C, id, 'approved', { approvedAt: Date.now(), maxToxicity: +maxTox.toFixed(3), hadWords: !!text, expiresAt: expires });
  console.log(JSON.stringify({ id, result: 'approved', hadWords: !!text, maxTox }));
}
