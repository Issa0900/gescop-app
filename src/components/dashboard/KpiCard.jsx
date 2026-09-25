import React from "react";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

function Sparkline({ data: brut, color = "hsl(var(--primary))" }) {
  const data = (brut || []).filter((v) => Number.isFinite(v));
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 90 - 5;
    return { x, y, v };
  });
  const pts = points.map((p) => `${p.x},${p.y}`);
  const areaPts = `0,100 ${pts.join(" ")} 100,100`;
  const gid = `sl-${Math.random().toString(36).slice(2, 8)}`;
  const maxIdx = data.indexOf(max);
  const minIdx = data.indexOf(min);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-10 w-full">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#${gid})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => {
        const isExtreme = i === maxIdx || i === minIdx;
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isExtreme ? 2.2 : 1.4}
            fill={isExtreme ? color : "transparent"}
            stroke={isExtreme ? "white" : "transparent"}
            strokeWidth={isExtreme ? 0.8 : 0}
            vectorEffect="non-scaling-stroke"
            pointerEvents="all"
          >
            <title>{p.v.toLocaleString("fr-CA")}{isExtreme ? (i === maxIdx ? " (max)" : " (min)") : ""}</title>
          </circle>
        );
      })}
    </svg>
  );
}

const trendIcons = { up: TrendingUp, down: TrendingDown, stable: ArrowRight };

const tonTendance = (dir, lowerIsBetter) => {
  if (dir !== "up" && dir !== "down") return "text-muted-foreground";
  const bonne = (dir === "up") !== Boolean(lowerIsBetter);
  return bonne ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
};

const statusStyles = {
  good: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15",
  warning: "text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-500/15",
  critical: "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-500/15",
  neutral: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15",
  unmeasured: "text-muted-foreground bg-muted",
};

export default function KpiCard({ label, value, change, changeDir, sparkline, status, statusLabel, onClick, note, lowerIsBetter }) {
  const TIcon = trendIcons[changeDir] || ArrowRight;
  const tc = { color: tonTendance(changeDir, lowerIsBetter) };
  const hasValue = value !== null && value !== undefined && value !== "-" && value !== "—" && value !== "--";
  const hasChange = change !== null && change !== undefined && change !== "-" && change !== "—" && change !== "--";

  return (
    <div
      onClick={onClick}
      className={cn(
        "animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        {status && (
          <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", statusStyles[status] || statusStyles.neutral)}>
            {statusLabel || status}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        {hasValue ? (
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{value}</p>
        ) : (
          <span className="text-sm font-semibold text-muted-foreground/80 py-1">Non mesuré</span>
        )}
        {hasChange && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", tc.color)}>
            <TIcon className="h-3 w-3" />
            {change}
          </span>
        )}
      </div>
      {note && <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{note}</p>}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3">
          <Sparkline data={sparkline} />
        </div>
      )}
    </div>
  );
}