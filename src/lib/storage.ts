import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
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
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: params.contentType,
  });
  return getSignedUrl(client, command, { expiresIn: params.expiresIn ?? 900 });
}

export async function presignGet(params: PresignParams): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });
  return getSignedUrl(client, command, { expiresIn: params.expiresIn ?? 900 });
}

export async function createMultipartUpload(
  bucket: string,
  key: string,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  const command = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const res = await client.send(command);
  if (!res.UploadId) throw new Error("Failed to create multipart upload: missing UploadId");
  return res.UploadId;
}

export async function presignUploadPart(params: {
  bucket: string;
  key: string;
  uploadId: string;
  partNumber: number;
  expiresIn?: number;
}): Promise<string> {
  const client = getS3Client();
  const command = new UploadPartCommand({
    Bucket: params.bucket,
    Key: params.key,
    UploadId: params.uploadId,
    PartNumber: params.partNumber,
  });
  return getSignedUrl(client, command, { expiresIn: params.expiresIn ?? 900 });
}

export async function completeMultipartUpload(params: {
  bucket: string;
  key: string;
  uploadId: string;
  parts: CompletedPart[];
}): Promise<void> {
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
}

export async function abortMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string
): Promise<void> {
  const client = getS3Client();
  const command = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
  });
  await client.send(command);
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<void> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await client.send(command);
}

export async function headObject(
  bucket: string,
  key: string
): Promise<{ exists: boolean; contentLength?: number; contentType?: string }> {
  const client = getS3Client();
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const res = await client.send(command);
    return {
      exists: true,
      contentLength: res.ContentLength,
      contentType: res.ContentType,
    };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "NotFound") {
      return { exists: false };
    }
    return { exists: false };
  }
}
