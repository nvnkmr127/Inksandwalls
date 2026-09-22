"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Storefront catalog route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="container max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <ErrorState
        title="Unable to load catalogue"
        description="We encountered an issue retrieving products. Please try refreshing or clearing your filters."
        onRetry={() => reset()}
        retryText="Try Again"
        secondaryAction={
          <Link href="/products" passHref>
            <Button variant="outline" size="sm">
              Reset Catalogue
            </Button>
          </Link>
        }
      />
    </div>
  );
}
