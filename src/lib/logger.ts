/**
 * Centralized Application Logger
 * INKs & Walls - Micro Phase 01.05
 * Writes structured JSON logs to stdout/stderr for Railway compatibility.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  environment: string;
  correlationId?: string;
  component?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "otp",
  "token",
  "auth",
  "authorization",
  "cookie",
  "secret",
  "creditcard",
  "cvv",
  "r2_secret_access_key",
  "r2_access_key_id",
  "database_url",
  "direct_url",
  "razorpay_key_secret",
  "razorpay_webhook_secret",
  "resend_api_key",
  "brevo_api_key",
  "waba_api_key",
]);

/**
 * Recursively sanitize metadata object to prevent secret leakage
 */
export function sanitizeMetadata(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("secret") || lowerKey.includes("token") || lowerKey.includes("password")) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeMetadata(value);
      }
    }
    return sanitized;
  }

  return String(data);
}

function parseErrorObject(err: unknown): LogPayload["error"] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name || "Error",
      message: err.message || "Unknown error",
      stack: err.stack,
    };
  }
  if (typeof err === "string") {
    return {
      name: "Error",
      message: err,
    };
  }
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    return {
      name: String(obj.name || "Error"),
      message: String(obj.message || JSON.stringify(obj)),
      stack: typeof obj.stack === "string" ? obj.stack : undefined,
    };
  }
  return {
    name: "Error",
    message: String(err),
  };
}

function shouldLog(level: LogLevel): boolean {
  const env = process.env.NODE_ENV || "development";
  const configuredLevel = process.env.LOG_LEVEL?.toLowerCase();

  if (configuredLevel === "debug") return true;
  if (configuredLevel === "info") return level !== "debug";
  if (configuredLevel === "warn") return level === "warn" || level === "error";
  if (configuredLevel === "error") return level === "error";

  if (env === "production" && level === "debug") {
    return false;
  }
  return true;
}

function formatAndEmit(level: LogLevel, message: string, meta?: Record<string, unknown>, err?: unknown) {
  if (!shouldLog(level)) return;

  const environment = process.env.NODE_ENV || "development";
  const correlationId = typeof meta?.correlationId === "string" ? (meta.correlationId as string) : undefined;
  const component = typeof meta?.component === "string" ? (meta.component as string) : undefined;

  let cleanedMeta: Record<string, unknown> | undefined;
  if (meta) {
    const metaCopy = { ...meta };
    delete metaCopy.correlationId;
    delete metaCopy.component;
    if (Object.keys(metaCopy).length > 0) {
      cleanedMeta = sanitizeMetadata(metaCopy) as Record<string, unknown>;
    }
  }

  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment,
    correlationId,
    component,
    error: parseErrorObject(err),
    metadata: cleanedMeta,
  };

  const output = JSON.stringify(payload);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else if (level === "info") {
    console.info(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    formatAndEmit("debug", message, meta);
  },
  info(message: string, meta?: Record<string, unknown>) {
    formatAndEmit("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>, err?: unknown) {
    formatAndEmit("warn", message, meta, err);
  },
  error(message: string, meta?: Record<string, unknown>, err?: unknown) {
    formatAndEmit("error", message, meta, err);
  },
};
