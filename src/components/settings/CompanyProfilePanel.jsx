import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Building2, Sparkles, Trash2, Globe, Wand2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/lib/LanguageContext";

export default function CompanyProfilePanel({ form, setForm, onDelete }) {
  const { language } = useLanguage();
  const isEn = language === "en";
  const { toast } = useToast();
  const [enriching, setEnriching] = useState(false);

  const handleChange = (field, val) => {
    setForm((f) => ({ ...f, [field]: val }));
  };

  const handleEnrich = async () => {
    if (!form.website) {
      toast({ title: "Entrez d'abord l'URL du site web de l'entreprise", variant: "destructive" });
      return;
    }
    setEnriching(true);
    try {
      let url = String(form.website).trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      const res = await base44.functions.invoke("enrichFromWebsite", {
        website_url: url,
        company_name: form.name,
      });
      const data = res.data || res;
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        const info = data.company_info || {};
        const filled = [];
        setForm((f) => {
          const next = { ...f };
          const apply = (key, incoming) => {
            if (!next[key] && incoming) {
              next[key] = incoming;
              filled.push(key);
            }
          };
          apply("name", info.name);
          apply("sector", info.sector);
          apply("location", info.location);
          apply("business_model", info.business_model);
          apply("products", info.products);
          apply("services", info.services);
          apply("clientele", info.clientele);
          apply("description", info.services || info.products);
          return next;
        });
        toast({
          title: filled.length
            ? `✨ ${filled.length} champ(s) remplis automatiquement — vérifiez avant d'enregistrer`
            : "Aucun champ vide à remplir depuis ce site web",
        });
      }
    } catch (e) {
      toast({ title: "Erreur IA : " + (e.response?.data?.error || e.message), variant: "destructive" });
    } finally {
      setEnriching(false);
    }
  };

  if (!form) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {isEn ? "Company Reference Profile" : "Profil de référence de l'entreprise"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isEn
              ? "Fundamental business identity guiding GESCOP semantic intelligence, KPI benchmarks, and AI reasoning."
              : "Les informations fondamentales qui définissent votre entreprise et guident l'intelligence de GESCOP."}
          </p>
        </div>
        {onDelete && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="shrink-0 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/50 shadow-xs"
          >
            <Trash2 className="h-4 w-4" />
            {isEn ? "Delete Identity" : "Supprimer l'identité"}
          </Button>
        )}
      </div>

      {/* Carte synthétique : Ce que GESCOP connaît de votre entreprise */}
      <div className="rounded-2xl border border-indigo-150 bg-gradient-to-br from-indigo-50/70 to-slate-50 dark:from-indigo-950/20 dark:to-slate-900/30 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-300">
            {isEn ? "What GESCOP knows about your company" : "Ce que GESCOP connaît de votre entreprise"}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-indigo-100 dark:border-border">
            <span className="text-muted-foreground block">{isEn ? "Industry Sector" : "Secteur"}</span>
            <strong className="text-foreground font-semibold">{form.sector || (isEn ? "Not specified" : "Non spécifié")}</strong>
          </div>
          <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-indigo-100 dark:border-border">
            <span className="text-muted-foreground block">{isEn ? "Business Model" : "Modèle d'affaires"}</span>
            <strong className="text-foreground font-semibold">{form.business_model || (isEn ? "Mixed Commerce" : "Commerce mixte")}</strong>
          </div>
          <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-indigo-100 dark:border-border">
            <span className="text-muted-foreground block">{isEn ? "Territory" : "Territoire"}</span>
            <strong className="text-foreground font-semibold">{form.location || "Québec"}</strong>
          </div>
          <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-indigo-100 dark:border-border">
            <span className="text-muted-foreground block">{isEn ? "Reference Currency" : "Devise de référence"}</span>
            <strong className="text-foreground font-semibold">{form.currency || "CAD ($)"}</strong>
          </div>
        </div>
      </div>

      {/* Formulaire complet */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="comp-name">
              {isEn ? "Official Legal Name *" : "Nom officiel de l'entreprise *"}
            </Label>
            <Input
              id="comp-name"
              value={form.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Ex: Nordik Plein Air Inc."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="trade-name">
              {isEn ? "Trade Name / Brand" : "Nom commercial / Marque"}
            </Label>
            <Input
              id="trade-name"
              value={form.trade_name || ""}
              onChange={(e) => handleChange("trade_name", e.target.value)}
              placeholder="Ex: Nordik Plein Air"
              className="mt-1"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="comp-desc">
              {isEn ? "Activity & Mission Description" : "Description de l'activité"}
            </Label>
            <Textarea
              id="comp-desc"
              rows={3}
              value={form.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder={isEn ? "Describe your main offering, positioning and mission in a few sentences." : "Décrivez en quelques phrases votre offre principale, votre positionnement et votre mission."}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="comp-sector">
              {isEn ? "Industry Sector *" : "Secteur d'activité *"}
            </Label>
            <Input
              id="comp-sector"
              value={form.sector || ""}
              onChange={(e) => handleChange("sector", e.target.value)}
              placeholder={isEn ? "e.g., Retail, Restaurant, E-commerce, B2B Services..." : "Ex: Commerce de détail, Restauration, E-commerce, B2B..."}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="comp-subsector">
              {isEn ? "Specialized Subsector" : "Sous-secteur spécialisé"}
            </Label>
            <Input
              id="comp-subsector"
              value={form.subsector || ""}
              onChange={(e) => handleChange("subsector", e.target.value)}
              placeholder={isEn ? "e.g., Outdoor & Camping gear" : "Ex: Équipements de camping & plein air"}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="comp-location">
              {isEn ? "Location (Country / Province / City)" : "Territoire d'implantation (Pays / Province / Ville)"}
            </Label>
            <Input
              id="comp-location"
              value={form.location || ""}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="Ex: Québec, Canada"
              className="mt-1"
            />
          </div>

          {/* Site web + bouton Auto-remplir IA */}
          <div className="sm:col-span-2">
            <Label htmlFor="comp-website">{isEn ? "Official Website" : "Site web officiel"}</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="comp-website"
                  className="pl-9"
                  value={form.website || ""}
                  onChange={(e) => handleChange("website", e.target.value)}
                  placeholder="https://nordikpleinair.ca"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleEnrich}
                disabled={enriching}
                className="shrink-0 gap-2"
              >
                {enriching ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Analyse…</>
                ) : (
                  <><Wand2 className="h-4 w-4" /> Auto-remplir via IA</>
                )}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              L'IA analyse votre site et remplit automatiquement les champs vides. Vérifiez les valeurs avant d'enregistrer.
            </p>
          </div>

          <div>
            <Label htmlFor="comp-currency">
              {isEn ? "Accounting Currency" : "Devise comptable"}
            </Label>
            <Input
              id="comp-currency"
              value={form.currency || "CAD"}
              onChange={(e) => handleChange("currency", e.target.value)}
              placeholder="CAD ($), USD ($), EUR (€)..."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="comp-year">
              {isEn ? "Year Founded" : "Année de création"}
            </Label>
            <Input
              id="comp-year"
              type="number"
              value={form.creation_year || ""}
              onChange={(e) => handleChange("creation_year", Number(e.target.value))}
              placeholder="Ex: 2018"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Zone de Danger : Suppression de l'identité d'entreprise */}
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-xs dark:border-red-900/40 dark:bg-red-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-red-900 dark:text-red-400 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {isEn ? "Delete Company Identity" : "Supprimer l'identité de l'entreprise"}
            </h3>
            <p className="text-xs text-red-700/90 dark:text-red-400/80 max-w-xl">
              {isEn
                ? "Permanently deletes the current company identity (" + (form.name || "unnamed") + "), industry sector, and company context registered in GESCOP. Raw imported data (sales, customers, expenses) is preserved."
                : "Efface définitivement la fiche d'identité actuelle (" + (form.name || "sans nom") + "), son secteur d'activité et son contexte d'entreprise enregistré dans GESCOP. Vos données brutes importées (ventes, clients, dépenses) sont préservées."}
            </p>
          </div>
          {onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              className="shrink-0 gap-2 shadow-xs hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              {isEn ? "Delete Identity" : "Supprimer l'identité"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
