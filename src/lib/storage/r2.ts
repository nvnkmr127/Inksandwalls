import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicDomain = process.env.R2_PUBLIC_DOMAIN || process.env.R2_PUBLIC_URL;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicDomain,
  };
}

export function isR2Configured(): boolean {
  const { accountId, accessKeyId, secretAccessKey, bucketName } = getR2Config();
  return Boolean(accountId && accessKeyId && secretAccessKey && bucketName);
}

let r2ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (r2ClientInstance) {
    return r2ClientInstance;
  }

  const { accountId, accessKeyId, secretAccessKey } = getR2Config();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 is not configured properly. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY."
    );
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  r2ClientInstance = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2ClientInstance;
}

export function getR2BucketName(): string {
  const { bucketName } = getR2Config();
  if (!bucketName) {
    throw new Error("Cloudflare R2 bucket name is not configured. Missing R2_BUCKET_NAME.");
  }
  return bucketName;
}

export function getR2PublicDomain(): string {
  const { publicDomain } = getR2Config();
  if (!publicDomain) {
    return "";
  }
  // Trim trailing slashes
  return publicDomain.replace(/\/+$/, "");
}
