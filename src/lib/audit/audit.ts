import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logger } from "../logger";
import type { RecordAuditEventInput } from "./types";

const SENSITIVE_AUDIT_KEYS = new Set([
  "password",
  "pass",
  "otp",
  "otpcode",
  "otphash",
  "accesstoken",
  "refreshtoken",
  "clientsecret",
  "apikey",
  "authorization",
  "cookie",
  "secret",
  "credentials",
  "token",
  "auth",
  "creditcard",
  "cvv",
]);

/**
 * Recursively sanitize audit metadata to defensively block secret/credential leakage.
 */
export function sanitizeAuditMetadata(data: unknown): unknown {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditMetadata(item));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        SENSITIVE_AUDIT_KEYS.has(lowerKey) ||
        lowerKey.includes("secret") ||
        lowerKey.includes("otp") ||
        lowerKey.includes("token") ||
        lowerKey.includes("password") ||
        lowerKey.includes("cookie")
      ) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeAuditMetadata(value);
      }
    }
    return sanitized;
  }

  return String(data);
}

/**
 * Extract IP address and User-Agent context from HTTP Request or Headers.
 */
export function extractRequestContext(request?: Request | Headers | null): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  if (!request) {
    return { ipAddress: null, userAgent: null };
  }

  const headers = request instanceof Headers ? request : request.headers;

  const rawIp =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null;

  const rawUserAgent = headers.get("user-agent") || null;
  const userAgent = rawUserAgent ? rawUserAgent.slice(0, 512) : null;

  return { ipAddress: rawIp, userAgent };
}

export type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Record a centralized audit event to the database.
 * Server-only utility.
 */
export async function recordAuditEvent(
  params: RecordAuditEventInput,
  dbClient: DbClient = prisma
) {
  const { actorUserId, action, resourceType, resourceId, metadata, ipAddress, userAgent } = params;

  const sanitizedMetadata = metadata ? (sanitizeAuditMetadata(metadata) as Record<string, unknown>) : null;
  const boundedUserAgent = userAgent ? userAgent.slice(0, 512) : null;

  try {
    const record = await dbClient.auditLog.create({
      data: {
        actorUserId: actorUserId || null,
        action,
        resourceType,
        resourceId: resourceId || null,
        metadata: (sanitizedMetadata as Prisma.InputJsonObject) ?? undefined,
        ipAddress: ipAddress || null,
        userAgent: boundedUserAgent,
        createdAt: new Date(),
      },
    });
    return record;
  } catch (error) {
    logger.error("Failed to persist audit log record", {
      component: "AuditService",
      metadata: { action, resourceType, resourceId, actorUserId },
    }, error as Error);

    // If running within an active transaction, rethrow to trigger transaction rollback
    // and maintain transactional integrity.
    if ("$extends" in dbClient === false && "$transaction" in dbClient === false) {
      throw error;
    }

    return null;
  }
}
