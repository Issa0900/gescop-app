import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, Check } from "lucide-react";

export default function StockThresholdSettings({ company, settings, alertCount, onSaved }) {
  const [threshold, setThreshold] = useState(String(settings.threshold));
  const [useReorder, setUseReorder] = useState(settings.useReorderPoint);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = Number(threshold) !== settings.threshold || useReorder !== settings.useReorderPoint;

  const save = async () => {
    if (!company) return;
    setSaving(true);
    await base44.entities.Company.update(company.id, {
      stock_alert_threshold: Math.max(0, Number(threshold) || 0),
      stock_alert_use_reorder_point: useReorder,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Seuil d'alerte stock</h2>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <Label htmlFor="stock-threshold" className="text-xs text-muted-foreground">Alerter à partir de (unités)</Label>
            <Input
              id="stock-threshold"
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="mt-1.5 w-28"
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="use-reorder" checked={useReorder} onCheckedChange={setUseReorder} />
            <Label htmlFor="use-reorder" className="text-sm font-normal">Utiliser aussi le seuil de réappro. de chaque produit</Label>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{alertCount}</span> produit{alertCount === 1 ? "" : "s"} en alerte
          </span>
          <Button size="sm" onClick={save} disabled={!dirty || saving || !company}>
            {saved ? <><Check className="mr-1.5 h-4 w-4" /> Enregistré</> : saving ? "…" : "Appliquer"}
          </Button>
        </div>
      </div>
    </div>
  );
}