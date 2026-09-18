"use client";

import React from "react";
import Image, { ImageProps } from "next/image";
import r2Loader from "@/lib/images/r2-loader";

export interface OptimizedImageProps extends Omit<ImageProps, "loader"> {
  src: string;
  alt: string;
  useR2Loader?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  useR2Loader = true,
  className = "",
  sizes = "(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw",
  ...props
}: OptimizedImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      loader={useR2Loader ? r2Loader : undefined}
      sizes={sizes}
      className={className}
      {...props}
    />
  );
}

export default OptimizedImage;
