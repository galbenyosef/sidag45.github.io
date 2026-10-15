// HTTP API (API Gateway HTTP API, payload v2)
//   POST   /submissions      consent → id, withdraw token, presigned S3 upload
//   GET    /voices/{id}      status of a submission
//   DELETE /voices/{id}      withdraw (header x-withdraw-token)
//   GET    /pool?n=16        a random set of approved voices for playback
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { DeleteTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { clients, cfg, REASONS } from '../lib/aws.mjs';

export const CONSENT_VERSION = '2026-10-v1';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const json = (statusCode, body, headers = {}) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }, body: JSON.stringify(body) });
const ID = /^[0-9a-f-]{36}$/;

export async function handler(event) {
  const route = event.routeKey, C = cfg();
  try {
    if (route === 'POST /submissions') return await createSubmission(event, C);
    if (route === 'GET /voices/{id}') return await getStatus(event, C);
    if (route === 'DELETE /voices/{id}') return await withdraw(event, C);
    if (route === 'GET /pool') return await pool(event, C);
    return json(404, { error: 'not_found' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'server_error' });
  }
}

async function createSubmission(event, C) {
  let body = {};
  try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}'); } catch { return json(400, { error: 'bad_json' }); }
  const c = body.consent || {};
  if (c.ownVoice !== true || c.agree !== true || c.version !== CONSENT_VERSION) return json(400, { error: 'consent_required' });

  // simple per-IP rate limit (hashed IP, hourly bucket, expires on its own)
  const ip = event.requestContext?.http?.sourceIp || 'unknown';
  const hour = Math.floor(Date.now() / 3.6e6);
  const rateKey = `rate#${sha(C.salt + ip)}#${hour}`;
  const r = await clients.ddb.send(new UpdateCommand({
    TableName: C.table, Key: { id: rateKey },
    UpdateExpression: 'ADD hits :one SET expiresAt = :exp',
    ExpressionAttributeValues: { ':one': 1, ':exp': (hour + 2) * 3600 },
    ReturnValues: 'UPDATED_NEW',
  }));
  if ((r.Attributes?.hits ?? 1) > C.maxPerHour) return json(429, { error: 'rate_limited' });

  const id = randomUUID(), token = randomBytes(24).toString('base64url'), now = Date.now();
  await clients.ddb.send(new PutCommand({
    TableName: C.table,
    Item: {
      id, status: 'awaiting_upload', createdAt: now, tokenHash: sha(token),
      consent: { ownVoice: true, agree: true, version: CONSENT_VERSION, at: new Date(now).toISOString() },
      expiresAt: Math.floor(now / 1000) + 86400, // unfinished submissions disappear after a day
    },
    ConditionExpression: 'attribute_not_exists(id)',
  }));
  const upload = await createPresignedPost(clients.s3, {
    Bucket: C.bucket, Key: `incoming/${id}.wav`,
    Conditions: [['content-length-range', 1000, 1100000], ['eq', '$Content-Type', 'audio/wav']],
    Fields: { 'Content-Type': 'audio/wav' },
    Expires: 300,
  });
  return json(201, { id, token, upload, consentVersion: CONSENT_VERSION });
}

async function getStatus(event, C) {
  const id = event.pathParameters?.id;
  if (!ID.test(id || '')) return json(400, { error: 'bad_id' });
  const { Item } = await clients.ddb.send(new GetCommand({ TableName: C.table, Key: { id } }));
  if (!Item) return json(404, { error: 'not_found' });
  const out = { id, status: Item.status };
  if (Item.status === 'rejected') out.reason = REASONS[Item.reason] || REASONS.check_failed;
  if (Item.status === 'approved' && C.cdn) out.url = `${C.cdn}/pool/${id}.wav`;
  return json(200, out);
}

async function withdraw(event, C) {
  const id = event.pathParameters?.id, token = event.headers?.['x-withdraw-token'] || '';
  if (!ID.test(id || '')) return json(400, { error: 'bad_id' });
  const { Item } = await clients.ddb.send(new GetCommand({ TableName: C.table, Key: { id } }));
  if (!Item) return json(204, {});
  const a = Buffer.from(sha(token)), b = Buffer.from(Item.tokenHash || '');
  if (!token || a.length !== b.length || !timingSafeEqual(a, b)) return json(403, { error: 'forbidden' });
  await clients.ddb.send(new DeleteCommand({ TableName: C.table, Key: { id } }));
  await Promise.allSettled([
    clients.s3.send(new DeleteObjectCommand({ Bucket: C.bucket, Key: `pool/${id}.wav` })),
    clients.s3.send(new DeleteObjectCommand({ Bucket: C.bucket, Key: `incoming/${id}.wav` })),
    clients.s3.send(new DeleteObjectCommand({ Bucket: C.bucket, Key: `transcripts/${id}.json` })),
    clients.transcribe.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: `vow-${id}` })),
  ]);
  if (Item.status === 'approved' && C.distributionId) {
    await clients.cloudfront.send(new CreateInvalidationCommand({
      DistributionId: C.distributionId,
      InvalidationBatch: { CallerReference: `${id}-${Date.now()}`, Paths: { Quantity: 1, Items: [`/pool/${id}.wav`] } },
    })).catch((e) => console.warn('invalidation failed', e.name));
  }
  return { statusCode: 204, headers: { 'cache-control': 'no-store' }, body: '' };
}

async function pool(event, C) {
  const n = Math.max(1, Math.min(32, Number(event.queryStringParameters?.n) || 16));
  const cutoff = C.retentionDays > 0 ? Date.now() - C.retentionDays * 864e5 : 0;
  const res = await clients.ddb.send(new QueryCommand({
    TableName: C.table, IndexName: 'byStatus',
    KeyConditionExpression: '#s = :a AND createdAt > :cut',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':a': 'approved', ':cut': cutoff },
    ScanIndexForward: false, Limit: 400,
  }));
  const items = res.Items || [];
  // random selection from the 400 most recent approved voices
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  const voices = items.slice(0, n).map((it) => ({
    id: it.id, url: `${C.cdn}/pool/${it.id}.wav`,
    medianMidi: it.analysis?.medianMidi, duration: it.analysis?.duration, timbre: it.analysis?.timbre,
  }));
  return json(200, { total: items.length, voices }, { 'cache-control': 'public, max-age=20' });
}
