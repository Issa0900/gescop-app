import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, CheckCircle2, ShieldCheck, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useCompany } from "@/hooks/useCompany";
import { resumerComprehension } from "@/lib/comprehension";

const nombre = (n) => Number(n || 0).toLocaleString("fr-CA");

export default function UnderstandingPanel() {
  const [showDetailedUnderstanding, setShowDetailedUnderstanding] = useState(false);
  const { company } = useCompany();
  // Lu seulement quand l'utilisateur ouvre le détail : ce qui est affiché vient
  // des vraies données (src/lib/comprehension.js), plus d'un texte en dur.
  const { data: resume, isLoading } = useQuery({
    queryKey: ["comprehension", company?.id],
    enabled: showDetailedUnderstanding,
    queryFn: async () => {
      const [imports, orders, employees] = await Promise.all([
        base44.entities.Import.list("-created_date", 200),
        base44.entities.Order.list("-date", 1000),
        base44.entities.Employee.list("-created_date", 500),
      ]);
      return resumerComprehension({ imports, company, orders, employees });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Intelligence GESCOP & Mécanismes Internes
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Transparence totale sur la façon dont GESCOP comprend vos données, valide les règles mathématiques et produit ses analyses.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Pilier 1 : Compréhension des données */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
            <Sparkles className="h-4 w-4" /> Compréhension des Données
          </div>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Reconnaissance sémantique multilingue</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Détection automatique du grain de ligne</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Distinction Flux vs Soldes d'inventaire</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Détection et élimination des totaux consolidés</span>
            </li>
          </ul>
        </div>

        {/* Pilier 2 : Fiabilité mathématique */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
            <ShieldCheck className="h-4 w-4" /> Fiabilité & Rigueur
          </div>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Protection absolue contre la division par zéro</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Contrôle de plausibilité & anomalies de marge</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Audit de calcul et traçabilité de formule</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Mise en quarantaine sans perte de données</span>
            </li>
          </ul>
        </div>

        {/* Pilier 3 : IA & Décision */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Brain className="h-4 w-4" /> IA & Décision
          </div>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Distinction stricte [Fait] vs [Inférence]</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Diagnostics de cause racine pour KPIs manquants</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Simulateur prévisionnel anti-crash</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Assistant décisionnel en langage naturel</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Audit de compréhension en temps réel</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Consultez les hypothèses et les liens sémantiques actuellement actifs pour votre entreprise.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowDetailedUnderstanding(!showDetailedUnderstanding)}
          variant="outline"
          className="bg-white shrink-0"
        >
          <Eye className="h-4 w-4 mr-2" />
          {showDetailedUnderstanding ? "Masquer les détails" : "Voir ce que GESCOP a compris"}
        </Button>
      </div>

      {showDetailedUnderstanding && (
        <div className="rounded-2xl border border-indigo-150 bg-white p-5 shadow-xs space-y-3 text-xs">
          <h4 className="font-bold text-indigo-950 uppercase tracking-wider text-[11px]">Interprétation actuelle du modèle</h4>
          {isLoading || !resume ? (
            <p className="text-slate-500">Lecture de vos données…</p>
          ) : !resume.aDesImports ? (
            <p className="text-slate-700">Aucune donnée importée pour l'instant : GESCOP n'a encore rien interprété. Importez un fichier depuis la page Importer.</p>
          ) : (
            <div className="space-y-2 text-slate-700">
              <p>• <strong>Données reconnues :</strong>{" "}
                {resume.types.length > 0
                  ? resume.types.map((t) => `${t.libelle} (${nombre(t.lignes)} ligne${t.lignes > 1 ? "s" : ""})`).join(", ")
                  : "aucun type de données reconnu dans vos imports"}.
              </p>
              <p>• <strong>Succursales :</strong>{" "}
                {resume.succursales.length > 0
                  ? `${resume.succursales.slice(0, 8).join(", ")}${resume.succursales.length > 8 ? ` et ${resume.succursales.length - 8} autre(s)` : ""}`
                    + ` — ${resume.succursalesSource.saisies} saisie(s) dans Organisation, ${resume.succursalesSource.vues} vue(s) dans vos données`
                  : "aucune succursale connue (ni saisie dans Organisation, ni présente dans vos ventes ou employés)"}.
              </p>
              <p>• <strong>Règles de protection :</strong> pourcentages et taux jamais additionnés ; chiffre d'affaires calculé hors taxes ; commandes annulées exclues du chiffre d'affaires ; une donnée absente reste « non mesurée », jamais 0.</p>
              <p>• <strong>Lignes importées :</strong>{" "}
                {resume.tauxImport == null
                  ? "non mesuré (vos imports ne précisent pas le nombre de lignes lues)"
                  : `${resume.tauxImport.toLocaleString("fr-CA")} % (${nombre(resume.lignesImportees)} sur ${nombre(resume.lignesLues)} lignes lues ; les autres sont conservées au registre de l'import)`}.
              </p>
              {resume.colonnesNonReconnues.length > 0 && (
                <p>• <strong>Colonnes non reconnues :</strong> {resume.colonnesNonReconnues.slice(0, 10).join(", ")}{resume.colonnesNonReconnues.length > 10 ? "…" : ""} — ajoutez-les au Dictionnaire pour qu'elles soient comprises.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

