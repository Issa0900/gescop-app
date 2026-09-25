import React, { useMemo } from "react";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import DataTable from "@/components/ui/DataTable";
import BadgeStatus from "@/components/ui/BadgeStatus";
import { formatCAD, formatPct } from "@/lib/utils";
import { useDonneesKpi } from "@/hooks/useDonneesKpi";
import { calculerSuccursales, NON_ASSIGNE } from "@/lib/succursales";
import { Building, MapPin, DollarSign, TrendingUp } from "lucide-react";

// Revenus par succursale avec les MEMES regles que le CA du moteur (kpiRecords) :
// hors taxes, commandes annulees/retournees/hors devise exclues, devises
// converties (useDonneesKpi -> fetchOrders). La page additionnait `total`
// (TTC, commandes annulees comprises) : 506 474 $ ici pour 320 636 $ de CA
// commandes ailleurs. La somme des succursales retombe donc sur le « CA
// commandes » de la page KPI.
const montant = (x) => (x === null ? "Non mesuré" : formatCAD(x));

export default function Succursales() {
  const { data: donnees, isLoading } = useDonneesKpi();
  const { orders, transactions, employees, assets, executiveSummary: summaryRows } = donnees;

  // Calcul partage et teste : src/lib/succursales.js (transactions comprises,
  // libelles equivalents fusionnes, « Toutes succursales » a part).
  const calcul = useMemo(
    () => calculerSuccursales({ orders, transactions, employees, assets, summaryRows }),
    [orders, transactions, employees, assets, summaryRows],
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (!orders?.length && !transactions?.length && !employees?.length && !assets?.length && !summaryRows?.length) {
    return (
      <EmptyState
        icon={Building}
        title="Aucune donnée de succursale"
        description="Importez vos ventes, employés et immobilisations pour suivre le P&L par succursale."
      />
    );
  }

  const { locations, coutsConnus, nbSuccursales, totalRev, totalGrossProfit, totalEmployerCost, totalDepreciation, totalEbitda, totalEbit, weightedMarginPct } = calcul;
  const badgeMarge = (x) => (x === null
    ? <BadgeStatus status="neutral">Non mesuré</BadgeStatus>
    : <BadgeStatus status={x >= 10 ? "good" : x >= 0 ? "warning" : "critical"}>{formatPct(x, 1)}</BadgeStatus>);
  const couleurResultat = (x) => (x === null ? "text-muted-foreground" : x >= 0 ? "text-emerald-600" : "text-red-600");

  const locationColumns = [
    { key: "name", header: "Succursale", render: (l) => l.name },
    { key: "revenue", header: "Chiffre d'affaires", align: "right", sortValue: (l) => l.revenue, render: (l) => formatCAD(l.revenue), footer: () => montant(totalRev) },
    { key: "grossProfit", header: "Marge brute (ventes)", align: "right", sortValue: (l) => l.grossProfit ?? -Infinity, render: (l) => montant(l.grossProfit), footer: () => montant(totalGrossProfit) },
    { key: "employerCost", header: "Coût employeur (RH)", align: "right", sortValue: (l) => l.employerCost, render: (l) => <span className="text-red-600/80">{formatCAD(l.employerCost)}</span>, footer: () => <span className="text-red-600/80">{montant(totalEmployerCost)}</span> },
    { key: "ebitda", header: "EBITDA", align: "right", sortValue: (l) => l.ebitda ?? -Infinity, render: (l) => <span className="font-semibold">{montant(l.ebitda)}</span>, footer: () => montant(totalEbitda) },
    { key: "depreciation", header: "Amortissement (actifs)", align: "right", sortValue: (l) => l.depreciation, render: (l) => <span className="text-red-600/80">{formatCAD(l.depreciation)}</span>, footer: () => <span className="text-red-600/80">{montant(totalDepreciation)}</span> },
    {
      key: "ebit",
      header: "EBIT (résultat)",
      align: "right",
      sortValue: (l) => l.ebit ?? -Infinity,
      render: (l) => <span className={`font-bold ${couleurResultat(l.ebit)}`}>{montant(l.ebit)}</span>,
      footer: () => <span className={`font-bold ${couleurResultat(totalEbit)}`}>{montant(totalEbit)}</span>,
    },
    {
      key: "marginPct",
      header: "Marge nette %",
      align: "right",
      sortValue: (l) => l.marginPct ?? -Infinity,
      render: (l) => badgeMarge(l.marginPct),
      footer: () => badgeMarge(weightedMarginPct),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance par Succursale</h1>
        <p className="mt-1 text-muted-foreground">P&L détaillé croisant Ventes, RH et Immobilisations.</p>
        {!coutsConnus && (
          <p className="mt-2 text-sm text-muted-foreground">Aucun coût de vente importé : la marge brute, l'EBITDA et l'EBIT ne sont pas mesurables.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Succursales" value={nbSuccursales.toLocaleString("fr-CA")} icon={MapPin} sublabel={locations.some((l) => l.name === NON_ASSIGNE) ? "hors lignes sans succursale" : undefined} />
        <StatCard label="CA commandes (HT)" value={montant(totalRev)} icon={DollarSign} />
        <StatCard label="EBITDA total" value={montant(totalEbitda)} icon={TrendingUp} />
        <StatCard label="EBIT total (après amort.)" value={montant(totalEbit)} icon={TrendingUp} accent={totalEbit === null ? undefined : totalEbit > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"} />
      </div>

      <DataTable
        columns={locationColumns}
        data={locations}
        rowKey={(l) => l.name}
        searchPlaceholder="Rechercher une succursale…"
        footer
        emptyIcon={Building}
        emptyTitle="Aucune succursale"
      />
    </div>
  );
}
