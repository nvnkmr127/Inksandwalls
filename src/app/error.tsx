"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4 py-16 text-center">
      <div className="w-16 h-16 mb-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-2">
        Something went wrong
      </h1>
      
      <p className="text-muted-foreground max-w-md mb-8">
        We encountered an unexpected error while loading this page. Our team has been notified.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-input bg-background font-medium hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-xs text-muted-foreground/60 font-mono">
          Error Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
