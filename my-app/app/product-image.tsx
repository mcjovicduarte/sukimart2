"use client";

import { useState } from "react";
import { FALLBACK_PRODUCT_IMAGE } from "@/utils/product-images";

type ProductImageProps = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Plain <img> (not next/image) so admins can paste any image URL without
 * touching next.config.ts. Broken links fall back to the Sukimart placeholder.
 */
export default function ProductImage({
  src,
  alt,
  className,
}: ProductImageProps) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const resolved = brokenSrc === src ? FALLBACK_PRODUCT_IMAGE : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setBrokenSrc(src)}
    />
  );
}
