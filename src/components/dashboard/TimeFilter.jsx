import React from "react";
import { cn } from "@/lib/utils";

// Fenetres de mois COMPLETS (kpiPeriodes) : une periode glissante en jours
// melangeait un mois partiel avec des paies et des depenses mensuelles.
const periods = [
  { key: "month", label: "Dernier mois" },
  { key: "quarter", label: "3 mois" },
  { key: "year", label: "12 mois" },
];

export default function TimeFilter({ period, onChange }) {
  return (
    <div className="inline-flex items-center rounded-xl bg-card/70 p-1 shadow-sm backdrop-blur">
      {periods.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            period === p.key
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}