// S3 ObjectCreated on incoming/*.wav → quality checks + analysis → start transcription for moderation.
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { clients, cfg } from '../lib/aws.mjs';
import { readWav } from '../lib/wav.mjs';
import { analyse, qualityGate } from '../lib/analysis.mjs';

export async function handler(event) {
  const C = cfg();
  for (const rec of event.Records || []) {
    const key = decodeURIComponent(rec.s3.object.key.replace(/\+/g, ' '));
    const m = /^incoming\/([0-9a-f-]{36})\.wav$/.exec(key);
    if (!m) { await del(C, key); continue; }
    await ingestOne(C, m[1], key, rec.s3.object.size);
  }
}

const del = (C, key) => clients.s3.send(new DeleteObjectCommand({ Bucket: C.bucket, Key: key })).catch(() => {});

async function reject(C, id, key, reason) {
  await del(C, key);
  await clients.ddb.send(new UpdateCommand({
    TableName: C.table, Key: { id },
    UpdateExpression: 'SET #s = :r, reason = :why, expiresAt = :exp',
    ConditionExpression: 'attribute_exists(id)',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':r': 'rejected', ':why': reason, ':exp': Math.floor(Date.now() / 1000) + 86400 },
  })).catch(() => {});
  console.log(JSON.stringify({ id, result: 'rejected', reason }));
}

export async function ingestOne(C, id, key, size) {
  const { Item } = await clients.ddb.send(new GetCommand({ TableName: C.table, Key: { id } }));
  if (!Item || Item.status !== 'awaiting_upload') { await del(C, key); return; } // unknown, withdrawn or duplicate upload
  if (size > 1100000) return reject(C, id, key, 'too_long');

  const obj = await clients.s3.send(new GetObjectCommand({ Bucket: C.bucket, Key: key }));
  const bytes = Buffer.from(await obj.Body.transformToByteArray());
  let wav;
  try { wav = readWav(bytes); } catch { return reject(C, id, key, 'bad_audio'); }
  const A = analyse(wav.samples, wav.sampleRate);
  const fail = qualityGate(A);
  if (fail) return reject(C, id, key, fail);

  const analysis = {
    duration: +A.duration.toFixed(2), medianMidi: +A.medianMidi.toFixed(2), lowMidi: +A.lowMidi.toFixed(2),
    highMidi: +A.highMidi.toFixed(2), timbre: A.timbre, voicedRatio: +A.voicedRatio.toFixed(2),
  };
  await clients.ddb.send(new UpdateCommand({
    TableName: C.table, Key: { id },
    UpdateExpression: 'SET #s = :m, analysis = :a',
    ConditionExpression: 'attribute_exists(id)',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':m': 'moderating', ':a': analysis },
  }));
  try {
    await clients.transcribe.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: `vow-${id}`,
      Media: { MediaFileUri: `s3://${C.bucket}/${key}` },
      MediaFormat: 'wav',
      IdentifyLanguage: true,
      LanguageOptions: C.languageOptions,
      OutputBucketName: C.bucket,
      OutputKey: `transcripts/${id}.json`,
    }));
  } catch (err) {
    console.error('transcribe start failed', err);
    return reject(C, id, key, 'check_failed');
  }
  console.log(JSON.stringify({ id, result: 'moderating', analysis }));
}
