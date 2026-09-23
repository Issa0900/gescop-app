import React from "react";
import { AlertTriangle } from "lucide-react";
import { useDonneesKpi } from "@/hooks/useDonneesKpi";

// La lecture des donnees s'arrete a un plafond (fetchAll : 10 000 lignes par
// source, les plus recentes). Au-dela, les totaux « sur toute la periode »
// ne couvrent qu'une partie de l'historique : c'est dit ici, sur chaque ecran,
// au lieu d'afficher un chiffre partiel comme complet.
export default function BandeauTroncature() {
  const { tronques } = useDonneesKpi();
  if (!tronques.length) return null;
  const plafond = tronques[0].plafond.toLocaleString("fr-CA");
  const sources = tronques.map((t) => t.libelle).join(", ");
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">Données partielles : </span>
        {sources} {tronques.length > 1 ? "dépassent" : "dépasse"} {plafond} lignes. Seules les {plafond} lignes les plus récentes
        sont prises en compte : les tendances des derniers mois sont justes, mais les totaux sur toute la période sont sous-estimés.
      </p>
    </div>
  );
}
