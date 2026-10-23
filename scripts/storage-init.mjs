// One-off for the self-hosted stack (docker/docker-compose.yml): lets browsers
// use the bundled storage container the way they use R2.
//
// Item images go straight from the browser to storage on a presigned PUT, then
// show up through a plain <img> on the object's URL. That needs two things a
// fresh bucket does not have: a CORS rule admitting the app's origin for the
// PUT, and anonymous read on objects (not on the listing) for the <img>.
//
// Idempotent; it rewrites both settings each run.

import { PutBucketCorsCommand, PutBucketPolicyCommand, S3Client } from "@aws-sdk/client-s3";

const env = {
  endpoint: process.env.STORAGE_INTERNAL_ENDPOINT,
  accessKeyId: process.env.STORAGE_ACCESS_KEY,
  secretAccessKey: process.env.STORAGE_SECRET_KEY,
  bucket: process.env.STORAGE_BUCKET,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
};

const missing = Object.entries(env)
  .filter(([, value]) => !value)
  .map(([name]) => name);
if (missing.length > 0) {
  console.error(`storage-init: missing ${missing.join(", ")}`);
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: env.endpoint,
  region: "auto",
  forcePathStyle: true,
  credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
});

const origin = new URL(env.appUrl).origin;

await s3.send(
  new PutBucketCorsCommand({
    Bucket: env.bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [origin],
          AllowedMethods: ["PUT"],
          AllowedHeaders: ["content-type"],
          MaxAgeSeconds: 3000,
        },
      ],
    },
  }),
);

await s3.send(
  new PutBucketPolicyCommand({
    Bucket: env.bucket,
    Policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${env.bucket}/*`],
        },
      ],
    }),
  }),
);

console.log(
  `storage-init: ${env.bucket} accepts uploads from ${origin}; objects are publicly readable`,
);
