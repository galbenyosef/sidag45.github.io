// In-memory fakes of the AWS services the backend uses.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { setClients } from '../src/lib/aws.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const { S3Client } = createRequire(path.join(here, '../src/package.json'))('@aws-sdk/client-s3');
Object.assign(process.env, { BUCKET: 'vow-voices-test', TABLE: 't', CDN_URL: 'https://cdn.test', DISTRIBUTION_ID: 'D1', RETENTION_DAYS: '365', MAX_SUBMISSIONS_PER_IP_PER_HOUR: '5', AWS_REGION: process.env.AWS_REGION || 'us-east-1' });
// ---------- fakes ----------
export const S3 = new Map(), DB = new Map(), calls = [];
export const fake = { transcript: '', lang: 'en-US', tox: 0.02, pii: [], jobStatus: 'COMPLETED' };
const body = (buf) => ({ transformToByteArray: async () => new Uint8Array(buf), transformToString: async () => buf.toString() });

function update(item, cmd) {
  const ex = cmd.input.UpdateExpression, v = cmd.input.ExpressionAttributeValues || {}, n = cmd.input.ExpressionAttributeNames || {};
  const name = (k) => n[k] || k;
  const [setPart, removePart] = ex.split(' REMOVE ');
  if (setPart.startsWith('ADD ')) {
    const [addPart, rest] = setPart.slice(4).split(' SET ');
    const [k, val] = addPart.trim().split(/\s+/); item[name(k)] = (item[name(k)] || 0) + v[val];
    if (rest) for (const a of rest.split(',')) { const [k2, v2] = a.split('=').map((s) => s.trim()); item[name(k2)] = v[v2]; }
  } else {
    for (const a of setPart.replace(/^SET /, '').split(',')) { const [k, val] = a.split('=').map((s) => s.trim()); item[name(k)] = v[val]; }
  }
  if (removePart) for (const k of removePart.split(',')) delete item[k.trim()];
}
const ddb = { send: async (cmd) => {
  const c = cmd.constructor.name, i = cmd.input; calls.push(c);
  if (c === 'GetCommand') return { Item: DB.get(i.Key.id) && structuredClone(DB.get(i.Key.id)) };
  if (c === 'PutCommand') { if (DB.has(i.Item.id)) throw new Error('ConditionalCheckFailed'); DB.set(i.Item.id, structuredClone(i.Item)); return {}; }
  if (c === 'DeleteCommand') { DB.delete(i.Key.id); return {}; }
  if (c === 'UpdateCommand') {
    let it = DB.get(i.Key.id);
    if (!it) { if (i.ConditionExpression?.includes('attribute_exists')) { const e = new Error('cond'); e.name = 'ConditionalCheckFailedException'; throw e; } it = { id: i.Key.id }; DB.set(i.Key.id, it); }
    update(it, cmd); return { Attributes: { hits: it.hits } };
  }
  if (c === 'QueryCommand') {
    const want = i.ExpressionAttributeValues[':a'], cut = i.ExpressionAttributeValues[':cut'];
    return { Items: [...DB.values()].filter((x) => x.status === want && x.createdAt > cut).sort((a, b) => b.createdAt - a.createdAt) };
  }
  throw new Error('unhandled ddb ' + c);
} };
const s3 = new S3Client({ region: 'us-east-1', credentials: { accessKeyId: 'AKIAFAKE', secretAccessKey: 'fake' } });
s3.send = async (cmd) => {
  const c = cmd.constructor.name, i = cmd.input; calls.push(c);
  if (c === 'GetObjectCommand') { if (!S3.has(i.Key)) throw new Error('NoSuchKey ' + i.Key); return { Body: body(S3.get(i.Key)) }; }
  if (c === 'DeleteObjectCommand') { S3.delete(i.Key); return {}; }
  if (c === 'CopyObjectCommand') { const src = i.CopySource.split('/').slice(1).join('/'); S3.set(i.Key, S3.get(src)); return {}; }
  throw new Error('unhandled s3 ' + c);
};
const transcribe = { send: async (cmd) => {
  const c = cmd.constructor.name, i = cmd.input; calls.push(c);
  if (c === 'StartTranscriptionJobCommand') { fake.lastJob = i; return {}; }
  if (c === 'GetTranscriptionJobCommand') return { TranscriptionJob: { LanguageCode: fake.lang } };
  if (c === 'DeleteTranscriptionJobCommand') return {};
  throw new Error('unhandled transcribe ' + c);
} };
const translate = { send: async (cmd) => { calls.push('Translate'); fake.translated = cmd.input; return { TranslatedText: 'translated: ' + cmd.input.Text }; } };
const comprehend = { send: async (cmd) => {
  const c = cmd.constructor.name; calls.push(c);
  if (c === 'DetectToxicContentCommand') return { ResultList: cmd.input.TextSegments.map(() => ({ Toxicity: fake.tox, Labels: [{ Name: 'PROFANITY', Score: fake.tox }] })) };
  if (c === 'DetectPiiEntitiesCommand') return { Entities: fake.pii };
  throw new Error('unhandled comprehend ' + c);
} };
const cloudfront = { send: async (cmd) => { calls.push('Invalidate:' + cmd.input.InvalidationBatch.Paths.Items[0]); return {}; } };
setClients({ s3, ddb, transcribe, translate, comprehend, cloudfront });


