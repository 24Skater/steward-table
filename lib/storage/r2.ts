import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_PRESIGN_EXPIRES = 300; // 5 minutes

function getEnv() {
  return {
    endpoint: process.env.R2_ENDPOINT ?? null,
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? null,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? null,
    bucketName: process.env.R2_BUCKET_NAME ?? null,
  };
}

function isConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.endpoint && env.accessKeyId && env.secretAccessKey && env.bucketName,
  );
}

let _client: S3Client | null = null;

export function getStorageClient(): S3Client | null {
  if (!isConfigured()) return null;

  if (!_client) {
    const env = getEnv();
    _client = new S3Client({
      endpoint: env.endpoint!,
      credentials: {
        accessKeyId: env.accessKeyId!,
        secretAccessKey: env.secretAccessKey!,
      },
      region: "auto",
      forcePathStyle: true,
    });
  }

  return _client;
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string | null> {
  const client = getStorageClient();
  if (!client) return null;

  const { bucketName, endpoint } = getEnv();
  if (!bucketName || !endpoint) return null;

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return `${endpoint}/${bucketName}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  const client = getStorageClient();
  if (!client) return;

  const { bucketName } = getEnv();
  if (!bucketName) return;

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = DEFAULT_PRESIGN_EXPIRES,
): Promise<string | null> {
  const client = getStorageClient();
  if (!client) return null;

  const { bucketName } = getEnv();
  if (!bucketName) return null;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/** Convenience key generator for item images */
export function itemImageKey(itemId: string, filename: string): string {
  return `items/${itemId}/${filename}`;
}
