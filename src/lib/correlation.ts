/**
 * Request Correlation ID Utility
 * INKs & Walls - Micro Phase 01.05
 * Connects HTTP requests, application logs, and Sentry events.
 */

export function generateCorrelationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function getCorrelationId(request?: Request | Headers): string {
  if (!request) {
    return generateCorrelationId();
  }

  const headers = request instanceof Headers ? request : request.headers;
  const existingId = headers.get("x-request-id") || headers.get("x-correlation-id");
  if (existingId && existingId.trim() !== "") {
    return existingId.trim();
  }

  return generateCorrelationId();
}
