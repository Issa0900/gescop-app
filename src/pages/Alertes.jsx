import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import EmptyState from "@/components/EmptyState";
import PriorityBadge from "@/components/PriorityBadge";
import { Bell, Check } from "lucide-react";

const levelOrder = { critique: 0, important: 1, modere: 2, info: 3, faible: 4 };

export default function Alertes() {
  const qc = useQueryClient();
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts-all"],
    queryFn: async () => {
      const list = await base44.entities.Alert.list("-created_date", 50);
      return (list || []).sort((a, b) => (levelOrder[a.level] || 5) - (levelOrder[b.level] || 5));
    },
  });

  const markRead = async (id) => {
    await base44.entities.Alert.update(id, { status: "lue" });
    qc.invalidateQueries(["alerts-all"]);
    qc.invalidateQueries(["alerts-unread"]);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (!alerts || alerts.length === 0) {
    return (
      <EmptyState icon={Bell} title="Aucune alerte" description="Les alertes critiques apparaîtront ici après l'analyse." />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Centre d'alertes</h1>
        <p className="mt-1 text-muted-foreground">Notifications classées par niveau d'urgence.</p>
      </div>

      <div className="space-y-2">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              a.status === "non_lue" ? "border-border bg-card" : "border-border bg-muted/20"
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <PriorityBadge level={a.level} />
                {a.category && <span className="text-xs text-muted-foreground">{a.category}</span>}
                {a.status === "non_lue" && <span className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <p className="mt-2 font-medium">{a.title}</p>
              {a.message && <p className="text-sm text-muted-foreground">{a.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(a.created_date).toLocaleString("fr-CA")}
              </p>
            </div>
            {a.status === "non_lue" && (
              <button
                onClick={() => markRead(a.id)}
                className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}