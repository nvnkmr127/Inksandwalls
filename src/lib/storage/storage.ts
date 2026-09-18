import "server-only";
import {
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getR2Client, getR2BucketName, getR2PublicDomain, isR2Configured } from "./r2";

export interface UploadObjectOptions {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  cacheControl?: string;
}

export interface StorageUploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

/**
  Uploads a buffer/binary object to Cloudflare R2 object storage.
 */
export async function uploadObject({
  key,
  body,
  contentType,
  cacheControl = "public, max-age=31536000, immutable",
}: UploadObjectOptions): Promise<StorageUploadResult> {
  const r2 = getR2Client();
  const bucketName = getR2BucketName();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  await r2.send(command);

  const url = getPublicUrl(key);

  return {
    key,
    url,
    size: body.byteLength,
    contentType,
  };
}

/**
  Deletes an object from R2 by its exact object key.
 */
export async function deleteObject(key: string): Promise<boolean> {
  if (!key || typeof key !== "string") {
    throw new Error("Invalid object key provided for deletion.");
  }

  const r2 = getR2Client();
  const bucketName = getR2BucketName();

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await r2.send(command);
  return true;
}

/**
  Checks if an object exists in R2 storage.
 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    const r2 = getR2Client();
    const bucketName = getR2BucketName();

    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await r2.send(command);
    return true;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error.name === "NotFound" || error.name === "NoSuchKey")
    ) {
      return false;
    }
    throw error;
  }
}

/**
  Generates public HTTP URL for an object key using R2_PUBLIC_DOMAIN.
 */
export function getPublicUrl(key: string): string {
  const domain = getR2PublicDomain();
  const cleanKey = key.startsWith("/") ? key.slice(1) : key;

  if (!domain) {
    return `/media/${cleanKey}`;
  }

  return `${domain}/${cleanKey}`;
}

export { isR2Configured };
