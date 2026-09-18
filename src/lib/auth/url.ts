/**
 * Validates and sanitizes a return/callback URL to prevent open redirects.
 * Only relative paths starting with a single '/' are allowed.
 * Protocol-relative URLs ('//'), URLs with schemes ('http:', 'https:'), or backslashes are rejected.
 */
export function getSafeCallbackUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "/";
  }

  const trimmed = rawUrl.trim();

  // Reject URLs that don't start with '/' or start with '//' or '/\'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return "/";
  }

  // Reject attempts to embed protocol schemes like '/https://evil.com'
  if (trimmed.includes(":") || trimmed.includes("javascript:")) {
    return "/";
  }

  return trimmed;
}
