import React from "react";
import { cn } from "@/lib/utils";

export default function SliderControl({ label, value, onChange }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className={cn("text-sm font-bold", value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "text-muted-foreground")}>
          {value > 0 ? "+" : ""}{value}%
        </span>
      </div>
      <input
        type="range" min={-20} max={20} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>-20%</span><span>0%</span><span>+20%</span>
      </div>
    </div>
  );
}