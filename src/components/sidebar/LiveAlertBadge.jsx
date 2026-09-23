import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { computeLiveAlerts } from "@/lib/liveAlerts";
import { useDonneesKpi } from "@/hooks/useDonneesKpi";
import { useCompany } from "@/hooks/useCompany";

// Counts only what needs attention now: unread stored alerts plus live
// critical/important ones computed from current data.
export default function LiveAlertBadge({ compact }) {
  // Stock alerts follow the company threshold, like every other screen.
  const { company } = useCompany();
  const { data: stored } = useQuery({
    queryKey: ["alerts-badge"],
    queryFn: async () => (await base44.entities.Alert.list("-created_date", 100)) || [],
  });
  // Memes donnees que tous les ecrans (useDonneesKpi) : l'alerte de marge ou
  // d'autonomie compte ici exactement ce que la page KPI affiche, paie comprise.
  const { data } = useDonneesKpi();
  const live = useMemo(() => computeLiveAlerts({ ...data, company }), [data, company]);
  const liveCount = live.filter((a) => a.level === "critique" || a.level === "important").length;
  const unreadStored = (stored || []).filter((a) => a.status !== "lue").length;
  const count = liveCount + unreadStored;

  if (!count) return null;

  if (compact) {
    return <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-red-500" />;
  }
  return (
    <span className="ml-auto rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count}
    </span>
  );
}