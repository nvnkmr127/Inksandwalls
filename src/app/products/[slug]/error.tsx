"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductDetailError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error("Error occurred on Product Detail Page", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="container max-w-2xl px-4 py-16 text-center space-y-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Unable to Load Product Details
        </h1>
        <p className="text-sm text-muted-foreground">
          We encountered an unexpected error while retrieving this product. Please try refreshing the page or explore our catalogue.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
        <Button onClick={() => reset()} variant="default" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>Try Again</span>
        </Button>

        <Link href="/products" passHref>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Catalogue</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
