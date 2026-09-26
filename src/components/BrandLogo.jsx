import React, { useState } from "react";
import { cn } from "@/lib/utils";

export const GESCOP_LOGO_URL = "/gescop-logo.png";

export default function BrandLogo({ className, alt = "Logo GESCOP" }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-xs select-none",
        className
      )}
    >
      {!hasError ? (
        <img
          src={GESCOP_LOGO_URL}
          alt={alt}
          loading="eager"
          decoding="async"
          onError={() => setHasError(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        /* Repli SVG vectoriel haute fidélité aux couleurs officielles GESCOP */
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full p-0.5"
          aria-label={alt}
        >
          {/* Anneau bleu "G" */}
          <path
            d="M 68 28 A 36 36 0 1 0 68 72"
            stroke="#1E3A8A"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Disque central ambre/orange */}
          <circle cx="48" cy="50" r="10" fill="#F59E0B" />
          {/* Flèche d'impulsion stratégique émeraude */}
          <path
            d="M 46 50 H 80 M 68 38 L 82 50 L 68 62"
            stroke="#10B981"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}