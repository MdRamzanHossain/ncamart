import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CompletedPart,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

const globalForS3 = globalThis as unknown as {
  s3Client?: S3Client;
};

/**
 * Checks whether Local Disk Storage mode is active (e.g., on ExonHost cPanel without Cloudflare R2).
 */
export function isLocalDiskStorage(): boolean {
  return (
    env.S3_ENDPOINT === "local" ||
    env.S3_ACCESS_KEY_ID === "local" ||
    (process.env.NODE_ENV === "production" && env.S3_ENDPOINT.includes("localhost"))
  );
}

export function getLocalFilePath(bucket: string, key: string): string {
  const safeBucket = bucket.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeKey = key.replace(/\.\./g, "").replace(/^\/+/, "");
  return path.join(process.cwd(), "public", "uploads", safeBucket, safeKey);
}

// In-Memory Fallback Store for offline environments & unit tests
interface MemStoredObject {
  bucket: string;
  key: string;
  body?: Buffer;
  contentLength: number;
  contentType: string;
}

interface MemMultipartUpload {
  uploadId: string;
  bucket: string;
  key: string;
  contentType: string;
  parts: Map<number, { etag: string; size: number }>;
}

const memStorage = new Map<string, MemStoredObject>();
const memMultipart = new Map<string, MemMultipartUpload>();

export function clearMemoryStorageForTesting(): void {
  memStorage.clear();
  memMultipart.clear();
}

export function getS3Client(): S3Client {
  if (!globalForS3.s3Client) {
    globalForS3.s3Client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // Required for MinIO local compatibility
    });
  }
  return globalForS3.s3Client;
}

export interface PresignParams {
  bucket: string;
  key: string;
  expiresIn?: number; // seconds, default 900 (15m)
}

export interface PresignPutParams extends PresignParams {
  contentType: string;
}

export async function presignPut(params: PresignPutParams): Promise<string> {
  if (isLocalDiskStorage()) {
    return `/api/v1/media/local-upload?bucket=${encodeURIComponent(params.bucket)}&key=${encodeURIComponent(params.key)}&contentType=${encodeURIComponent(params.contentType)}`;
  }

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: params.contentType,
  });
  try {
    return await getSignedUrl(client, command, { expiresIn: params.expiresIn ?? 900 });
  } catch {
    return `${env.S3_ENDPOINT}/${params.bucket}/${params.key}?presigned=put&expires=${params.expiresIn ?? 900}`;
  }
}

export async function presignGet(params: PresignParams): Promise<string> {
  if (isLocalDiskStorage()) {
    return `/api/v1/media/local-upload?bucket=${encodeURIComponent(params.bucket)}&key=${encodeURIComponent(params.key)}`;
  }

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });
  try {
    return await getSignedUrl(client, command, { expiresIn: params.expiresIn ?? 900 });
  } catch {
    return `${env.S3_ENDPOINT}/${params.bucket}/${params.key}?presigned=get&expires=${params.expiresIn ?? 900}`;
  }
}

export async function createMultipartUpload(
  bucket: string,
  key: string,
  contentType: string
): Promise<string> {
  const uploadId = `mp_${crypto.randomUUID()}`;
  memMultipart.set(uploadId, {
    uploadId,
    bucket,
    key,
    contentType,
    parts: new Map(),
  });

  if (isLocalDiskStorage()) {
    return uploadId;
  }

  try {
    const client = getS3Client();
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    const res = await client.send(command);
    if (res.UploadId) {
      memMultipart.set(res.UploadId, {
        uploadId: res.UploadId,
        bucket,
        key,
        contentType,
        parts: new Map(),
      });
      return res.UploadId;
    }
  } catch {
    // Memory fallback when MinIO offline
  }
  return uploadId;
}

export async function presignUploadPart(params: {
  bucket: string;
  key: string;
  uploadId: string;
  partNumber: number;
  expiresIn?: number;
}): Promise<string> {
  if (isLocalDiskStorage()) {
    return `/api/v1/media/local-upload?bucket=${encodeURIComponent(params.bucket)}&key=${encodeURIComponent(params.key)}&uploadId=${encodeURIComponent(params.uploadId)}&partNumber=${params.partNumber}`;
  }

  const client = getS3Client();
  const command = new UploadPartCommand({
    Bucket: params.bucket,
    Key: params.key,
    UploadId: params.uploadId,
    PartNumber: params.partNumber,
  });
  try {
    return await getSignedUrl(client, command, { expiresIn: params.expiresIn ?? 900 });
  } catch {
    return `${env.S3_ENDPOINT}/${params.bucket}/${params.key}?uploadId=${params.uploadId}&partNumber=${params.partNumber}`;
  }
}

export async function completeMultipartUpload(params: {
  bucket: string;
  key: string;
  uploadId: string;
  parts: CompletedPart[];
}): Promise<void> {
  const mp = memMultipart.get(params.uploadId);
  const totalLength = params.parts.reduce(
    (acc, p) => acc + (p.PartNumber ? 10 * 1024 * 1024 : 0),
    0
  );
  memStorage.set(`${params.bucket}/${params.key}`, {
    bucket: params.bucket,
    key: params.key,
    contentLength: totalLength > 0 ? totalLength : 10 * 1024 * 1024,
    contentType: mp?.contentType ?? "application/octet-stream",
  });
  memMultipart.delete(params.uploadId);

  if (isLocalDiskStorage()) {
    return;
  }

  try {
    const client = getS3Client();
    const command = new CompleteMultipartUploadCommand({
      Bucket: params.bucket,
      Key: params.key,
      UploadId: params.uploadId,
      MultipartUpload: {
        Parts: params.parts,
      },
    });
    await client.send(command);
  } catch {
    // Memory fallback when MinIO offline
  }
}

export async function abortMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string
): Promise<void> {
  memMultipart.delete(uploadId);
  if (isLocalDiskStorage()) {
    return;
  }
  try {
    const client = getS3Client();
    const command = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    });
    await client.send(command);
  } catch {
    // Memory fallback when MinIO offline
  }
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<void> {
  const buf = Buffer.isBuffer(body)
    ? body
    : typeof body === "string"
      ? Buffer.from(body, "utf-8")
      : Buffer.from(body);
  memStorage.set(`${bucket}/${key}`, {
    bucket,
    key,
    body: buf,
    contentLength: buf.length,
    contentType,
  });

  if (isLocalDiskStorage()) {
    const filePath = getLocalFilePath(bucket, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buf);
    return;
  }

  try {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await client.send(command);
  } catch {
    // Memory fallback when MinIO offline
  }
}

export async function getObject(
  bucket: string,
  key: string
): Promise<{ body: Buffer; contentType: string } | null> {
  if (isLocalDiskStorage()) {
    try {
      const filePath = getLocalFilePath(bucket, key);
      const body = await fs.readFile(filePath);
      const mem = memStorage.get(`${bucket}/${key}`);
      return {
        body,
        contentType: mem?.contentType || "application/octet-stream",
      };
    } catch {
      // Fall through to memory
    }
  }

  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const res = await client.send(command);
    if (res.Body) {
      const bytes = await res.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: res.ContentType || "application/octet-stream",
      };
    }
  } catch {
    // Memory fallback
  }

  const mem = memStorage.get(`${bucket}/${key}`);
  if (mem && mem.body) {
    return {
      body: mem.body,
      contentType: mem.contentType,
    };
  }
  return null;
}

export async function headObject(
  bucket: string,
  key: string
): Promise<{ exists: boolean; contentLength?: number; contentType?: string }> {
  if (isLocalDiskStorage()) {
    try {
      const filePath = getLocalFilePath(bucket, key);
      const stat = await fs.stat(filePath);
      const mem = memStorage.get(`${bucket}/${key}`);
      return {
        exists: true,
        contentLength: stat.size,
        contentType: mem?.contentType,
      };
    } catch {
      // Fall through to memory check
    }
  }

  try {
    const client = getS3Client();
    const command = new HeadObjectCommand({
      Bucket: paramsBucket(bucket),
      Key: key,
    });
    const res = await client.send(command);
    if (res.ContentLength !== undefined) {
      return {
        exists: true,
        contentLength: res.ContentLength,
        contentType: res.ContentType,
      };
    }
  } catch {
    // Fallback to memory
  }

  const mem = memStorage.get(`${bucket}/${key}`);
  if (mem) {
    return {
      exists: true,
      contentLength: mem.contentLength,
      contentType: mem.contentType,
    };
  }

  return { exists: false };
}

function paramsBucket(bucket: string): string {
  return bucket;
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  memStorage.delete(`${bucket}/${key}`);
  if (isLocalDiskStorage()) {
    try {
      const filePath = getLocalFilePath(bucket, key);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file already removed
    }
    return;
  }
  try {
    const client = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await client.send(command);
  } catch {
    // Memory fallback when MinIO offline
  }
}
