// Shared AWS clients and settings. Tests replace clients through setClients().
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { TranslateClient } from '@aws-sdk/client-translate';
import { ComprehendClient } from '@aws-sdk/client-comprehend';
import { CloudFrontClient } from '@aws-sdk/client-cloudfront';

export const clients = {
  s3: new S3Client({}),
  ddb: DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } }),
  transcribe: new TranscribeClient({}),
  translate: new TranslateClient({}),
  comprehend: new ComprehendClient({}),
  cloudfront: new CloudFrontClient({}),
};
export const setClients = (c) => Object.assign(clients, c);

export const env = (k, d) => process.env[k] ?? d;
export const cfg = () => ({
  bucket: env('BUCKET'),
  table: env('TABLE'),
  cdn: env('CDN_URL', ''),
  distributionId: env('DISTRIBUTION_ID', ''),
  languageOptions: env('LANGUAGE_OPTIONS', 'en-US,es-US,hi-IN,fr-FR,zh-CN').split(',').map((s) => s.trim()).filter(Boolean),
  toxicity: Number(env('TOXICITY_THRESHOLD', '0.5')),
  retentionDays: Number(env('RETENTION_DAYS', '365')),
  maxPerHour: Number(env('MAX_SUBMISSIONS_PER_IP_PER_HOUR', '5')),
  salt: env('HASH_SALT', 'vow'),
});

// Reason codes are shown to the submitter; keep them friendly and non-specific.
export const REASONS = {
  silent: "We couldn't hear anything in the clip.",
  distorted: 'The clip was too loud and distorted.',
  too_short: 'The clip was too short.',
  too_long: 'The clip was longer than 10 seconds.',
  not_voice: "We couldn't find a voice in the clip.",
  bad_audio: "The file couldn't be read as audio.",
  content: "Your clip didn't pass the automatic content check, so it wasn't added.",
  personal_info: 'Your clip seemed to include personal details like a phone number or address, so it was not added. Try again without them.',
  check_failed: "We couldn't check the clip automatically, so it wasn't added. Please try again.",
};
