import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const objectives = [
  "Augmenter les ventes",
  "Améliorer la rentabilité",
  "Réduire les coûts",
  "Améliorer la trésorerie",
  "Automatiser",
  "Développer un marché",
  "Réduire les risques",
  "Améliorer la productivité",
  "Préparer une croissance",
];

const sectors = [
  "Commerce de détail",
  "Services professionnels",
  "Restauration",
  "Construction",
  "Manufacturier",
  "Technologie",
  "Santé",
  "Autre",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { refetch } = useCompany();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sector: "",
    location: "Québec, Canada",
    employee_count: 1,
    business_model: "",
    products: "",
    services: "",
    clientele: "",
    revenue: "",
    tools: "",
    objectives: [],
  });

  const toggleObjective = (obj) => {
    setForm((f) => ({
      ...f,
      objectives: f.objectives.includes(obj)
        ? f.objectives.filter((o) => o !== obj)
        : [...f.objectives, obj],
    }));
  };

  const handleSubmit = async () => {
    if (!form.name) {
      toast({ title: "Le nom de l'entreprise est requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Company.create({
        ...form,
        revenue: form.revenue ? Number(form.revenue) : 0,
        employee_count: Number(form.employee_count) || 1,
        onboarded: true,
        health_score: 0,
      });
      await refetch();
      toast({ title: "Entreprise configurée avec succès" });
      navigate("/");
    } catch (e) {
      toast({ title: "Erreur: " + e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">GESCOP</h1>
            <p className="text-sm text-muted-foreground">Configurez votre entreprise</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {/* Steps indicator */}
          <div className="mb-8 flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-10 bg-primary" : i < step ? "w-6 bg-primary/40" : "w-6 bg-muted"
                )}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Identité de l'entreprise</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Nom de l'entreprise *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex. Boulangerie du Quartier"
                  />
                </div>
                <div>
                  <Label>Secteur</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  >
                    <option value="">Sélectionner…</option>
                    {sectors.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Localisation</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nombre d'employés</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.employee_count}
                    onChange={(e) => setForm({ ...form, employee_count: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Chiffre d'affaires annuel ($)</Label>
                  <Input
                    type="number"
                    value={form.revenue}
                    onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                    placeholder="Ex. 250000"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(1)}>
                  Continuer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Activité & clientèle</h2>
              <div>
                <Label>Modèle d'affaires</Label>
                <Input
                  value={form.business_model}
                  onChange={(e) => setForm({ ...form, business_model: e.target.value })}
                  placeholder="Ex. Vente au détail, B2B, Abonnement…"
                />
              </div>
              <div>
                <Label>Produits</Label>
                <Textarea
                  value={form.products}
                  onChange={(e) => setForm({ ...form, products: e.target.value })}
                  placeholder="Décrivez vos principaux produits…"
                  rows={2}
                />
              </div>
              <div>
                <Label>Services</Label>
                <Textarea
                  value={form.services}
                  onChange={(e) => setForm({ ...form, services: e.target.value })}
                  placeholder="Décrivez vos principaux services…"
                  rows={2}
                />
              </div>
              <div>
                <Label>Clientèle</Label>
                <Textarea
                  value={form.clientele}
                  onChange={(e) => setForm({ ...form, clientele: e.target.value })}
                  placeholder="Qui sont vos clients? …"
                  rows={2}
                />
              </div>
              <div>
                <Label>Outils déjà utilisés</Label>
                <Input
                  value={form.tools}
                  onChange={(e) => setForm({ ...form, tools: e.target.value })}
                  placeholder="Ex. Excel, QuickBooks, Shopify…"
                />
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(0)}>Retour</Button>
                <Button onClick={() => setStep(2)}>
                  Continuer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Vos objectifs</h2>
              <p className="text-sm text-muted-foreground">
                Ces objectifs orientent les recommandations produites par le système.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {objectives.map((obj) => (
                  <button
                    key={obj}
                    onClick={() => toggleObjective(obj)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all",
                      form.objectives.includes(obj)
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border",
                        form.objectives.includes(obj)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {form.objectives.includes(obj) && <Check className="h-3 w-3" />}
                    </div>
                    {obj}
                  </button>
                ))}
              </div>
              <div className="flex justify-between pt-6">
                <Button variant="ghost" onClick={() => setStep(1)}>Retour</Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? "Configuration…" : "Terminer"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}