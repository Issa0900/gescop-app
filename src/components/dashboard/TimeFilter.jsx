import React from "react";
import { cn } from "@/lib/utils";

const periods = [
  { key: "month", label: "Mois" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Année" },
];

export default function TimeFilter({ period, onChange }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-1">
      {periods.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            period === p.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}