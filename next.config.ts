import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const r2Domain = process.env.R2_PUBLIC_DOMAIN || process.env.R2_PUBLIC_URL || "";
let r2Hostname = "";
if (r2Domain) {
  try {
    r2Hostname = new URL(r2Domain).hostname;
  } catch {
    // invalid URL format, ignore
  }
}

const remotePatterns: NextConfig["images"] = {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "*.r2.cloudflarestorage.com",
    },
    ...(r2Hostname
      ? [
          {
            protocol: "https" as const,
            hostname: r2Hostname,
          },
        ]
      : [
          {
            protocol: "https" as const,
            hostname: "media.inksandwalls.com",
          },
        ]),
  ],
};

const nextConfig: NextConfig = {
  images: remotePatterns,
};

export default withSentryConfig(nextConfig, {
  // Sentry SDK options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress warning logs when SENTRY_AUTH_TOKEN is not configured
  silent: true,

  // Upload wide set of client source maps
  widenClientFileUpload: true,

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
