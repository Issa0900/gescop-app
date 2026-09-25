import React from "react";
import { cn } from "@/lib/utils";

export const GESCOP_LOGO_URL = "/gescop-logo.png";

export default function BrandLogo({ className, alt = "Logo GESCOP" }) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-xs", className)}>
      <img
        src={GESCOP_LOGO_URL}
        alt={alt}
        className="h-full w-full object-contain"
      />
    </div>
  );
}