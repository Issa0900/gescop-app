// Donnees du moteur KPI, lues au meme endroit pour tous les ecrans.
//
// Chaque page choisissait ses entites : les alertes, la vue d'ensemble et les
// previsions ne lisaient pas la paie, la page Finance si. La meme « marge
// nette » valait donc -95 % ici et -391 % la. Toute page qui calcule un KPI,
// une serie ou une alerte passe par ce hook, qui lit EXACTEMENT les entites de
// ENTITES_KPI (kpiDataset.js) : ajouter une source au moteur l'ajoute partout.
//
// Cache partage (phase 4) : chaque ecran relisait les 14 sources a chaque
// ouverture (staleTime 0) - la vue d'ensemble mettait une minute a s'afficher
// en production. Les donnees restent fraiches 5 minutes entre les ecrans ;
// l'import, la suppression et la resolution de doublons vident le cache
// (queryClient.invalidateQueries()), donc un chiffre ne survit jamais a un
// changement de donnees.

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { fetchAllAvecEtat } from "@/lib/fetchAll";
import { fetchOrdersAvecEtat } from "@/lib/fetchOrders";
import { ENTITES_KPI } from "@/lib/core/kpiDataset";

// Tri de lecture : le plus recent d'abord (fetchAll plafonne la lecture).
const TRI = { Transaction: "-date", Cashflow: "-date", Expense: "-date", Payroll: "-period", CampaignDaily: "-date", Inventory: "-date", ExecutiveSummary: "-date", Customer: "-created_date" };

export const LIBELLES_SOURCES = {
  transactions: "transactions", cashflow: "trésorerie", orders: "commandes", expenses: "dépenses",
  employees: "employés", payrolls: "paie", customers: "clients", products: "produits",
  campaignDaily: "campagnes (quotidien)", campaigns: "campagnes", inventory: "inventaire",
  suppliers: "fournisseurs", assets: "immobilisations", executiveSummary: "synthèse",
};

export const cleDonneesKpi = (cle) => ["donnees-kpi", cle];
export const FRAICHEUR_DONNEES_MS = 5 * 60 * 1000;

const VIDE = { rows: [], tronque: false, plafond: 0 };

export function useDonneesKpi({ enabled = true } = {}) {
  const resultats = useQueries({
    queries: ENTITES_KPI.map(([cle, entite]) => ({
      queryKey: cleDonneesKpi(cle),
      queryFn: async () => {
        if (entite === "Order") return (await fetchOrdersAvecEtat()) || VIDE;
        const e = base44.entities[entite];
        if (!e?.list) return VIDE;
        return (await fetchAllAvecEtat(e, TRI[entite] || "-created_date")) || VIDE;
      },
      staleTime: FRAICHEUR_DONNEES_MS,
      gcTime: 30 * 60 * 1000,
      enabled,
    })),
  });
  // Meme objet tant que les lectures ne changent pas : les calculs du moteur
  // (useMemo sur `data`) ne se relancent pas a chaque rendu.
  const lectures = resultats.map((r) => r.data);
  const { data, tronques } = useMemo(() => {
    const d = {};
    const t = [];
    ENTITES_KPI.forEach(([cle, entite], i) => {
      const l = lectures[i] || VIDE;
      d[cle] = l.rows || [];
      if (l.tronque) t.push({ cle, entite, libelle: LIBELLES_SOURCES[cle] || cle, plafond: l.plafond });
    });
    return { data: d, tronques: t };
  }, lectures);
  return {
    data,
    // Sources dont seule une partie (les lignes les plus recentes) a ete lue.
    tronques,
    isLoading: resultats.some((r) => r.isLoading),
    pret: resultats.every((r) => r.isSuccess),
    isError: resultats.some((r) => r.isError),
    refetch: () => Promise.all(resultats.map((r) => r.refetch())),
  };
}
