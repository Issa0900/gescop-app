import React, { useMemo } from "react";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import DataTable from "@/components/ui/DataTable";
import BadgeStatus from "@/components/ui/BadgeStatus";
import { formatCAD, formatPct } from "@/lib/utils";
import { useDonneesKpi } from "@/hooks/useDonneesKpi";
import { montantHT, commandeHorsCA } from "@/lib/core/kpiRecords";
import { Building, MapPin, DollarSign, TrendingUp } from "lucide-react";

const NON_ASSIGNE = "Non assigné";

// Revenus par succursale avec les MEMES regles que le CA du moteur (kpiRecords) :
// hors taxes, commandes annulees/retournees/hors devise exclues, devises
// converties (useDonneesKpi -> fetchOrders). La page additionnait `total`
// (TTC, commandes annulees comprises) : 506 474 $ ici pour 320 636 $ de CA
// commandes ailleurs. La somme des succursales retombe donc sur le « CA
// commandes » de la page KPI.
const montant = (x) => (x === null ? "Non mesuré" : formatCAD(x));

export default function Succursales() {
  const { data: donnees, isLoading } = useDonneesKpi();
  const { orders, employees, assets, executiveSummary: summaryRows } = donnees;

  const calcul = useMemo(() => {
    const locationsMap = {};

    const getLoc = (loc) => {
      if (!loc) return NON_ASSIGNE;
      const s = String(loc).trim();
      // Le fichier RH nomme parfois une succursale "Ville (Succursale)" (ex.
      // "Québec (Sainte-Foy)") alors que les ventes utilisent seulement
      // "Sainte-Foy" : on garde la partie entre parenthèses pour que les deux
      // rejoignent la même clé, sinon le coût employeur de cette succursale
      // atterrit dans un groupe que les revenus ne touchent jamais.
      const m = s.match(/\(([^)]+)\)\s*$/);
      return (m ? m[1].trim() : s) || NON_ASSIGNE;
    };

    const ensureLoc = (loc) => {
      const key = getLoc(loc);
      if (!locationsMap[key]) {
        locationsMap[key] = { name: key, revenue: 0, cogs: 0, employerCost: 0, depreciation: 0 };
      }
      return locationsMap[key];
    };

    const coutDe = (o) => {
      const c = o.total_cost ?? o.cost;
      return c === null || c === undefined || c === "" ? null : Number(c);
    };
    const ventes = (orders || []).filter((o) => !commandeHorsCA(o));
    // Sans aucun cout de vente importe, la marge brute n'est pas le CA :
    // elle est non mesuree (la page affichait 100 % de marge).
    let coutsConnus = ventes.some((o) => Number.isFinite(coutDe(o)));
    ventes.forEach((o) => {
      const loc = ensureLoc(o.location_id || o.succursale || o.store || o.location);
      const rev = montantHT(o);
      if (Number.isFinite(rev)) loc.revenue += rev;
      const cogs = coutDe(o);
      if (Number.isFinite(cogs)) loc.cogs += cogs;
    });

    if (ventes.length === 0 && (summaryRows || []).length > 0) {
      coutsConnus = summaryRows.some((s) => Number.isFinite(Number(s.total_cost ?? s.cost)));
      summaryRows.forEach((s) => {
        const loc = ensureLoc(s.location_id || s.succursale || s.store);
        loc.revenue += Number(s.total_revenue) || Number(s.total) || 0;
        loc.cogs += Number(s.total_cost) || Number(s.cost) || 0;
      });
    }

    (employees || []).forEach((e) => {
      // `branch` porte le vrai nom de succursale (celui que suivent les
      // ventes) ; `location` n'est souvent qu'une catégorie générique.
      // Le DEPARTEMENT (ventes, atelier, administration...) n'est jamais une
      // succursale : l'utiliser en repli creait une « succursale » par service.
      const loc = ensureLoc(e.branch || e.location || e.succursale);
      loc.employerCost += Number(e.total_employer_cost) || 0;
    });

    (assets || []).forEach((a) => {
      const loc = ensureLoc(a.location_id || a.succursale || a.location);
      loc.depreciation += (Number(a.net_book_value || 0) * (Number(a.dpa_rate || 0)));
    });

    const locations = Object.values(locationsMap).map((loc) => {
      const grossProfit = coutsConnus ? loc.revenue - loc.cogs : null;
      // EBITDA = marge brute - cout employeur (simplification P&L succursale)
      const ebitda = grossProfit === null ? null : grossProfit - loc.employerCost;
      const ebit = ebitda === null ? null : ebitda - loc.depreciation;
      const marginPct = ebit !== null && loc.revenue > 0 ? (ebit / loc.revenue) * 100 : null;
      return { ...loc, grossProfit, ebitda, ebit, marginPct };
    }).sort((a, b) => (b.ebit ?? b.revenue) - (a.ebit ?? a.revenue));

    const somme = (cle) => locations.some((l) => l[cle] === null) ? null : locations.reduce((s, l) => s + l[cle], 0);
    const totalRev = somme("revenue");
    const totalEbit = somme("ebit");
    return {
      locations,
      coutsConnus,
      nbSuccursales: locations.filter((l) => l.name !== NON_ASSIGNE).length,
      totalRev,
      totalGrossProfit: somme("grossProfit"),
      totalEmployerCost: somme("employerCost"),
      totalDepreciation: somme("depreciation"),
      totalEbitda: somme("ebitda"),
      totalEbit,
      // Marge nette consolidée pondérée par le CA de chaque succursale.
      weightedMarginPct: totalEbit !== null && totalRev > 0 ? (totalEbit / totalRev) * 100 : null,
    };
  }, [orders, employees, assets, summaryRows]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (!orders?.length && !employees?.length && !assets?.length && !summaryRows?.length) {
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
    { key: "revenue", header: "CA commandes (HT)", align: "right", sortValue: (l) => l.revenue, render: (l) => formatCAD(l.revenue), footer: () => montant(totalRev) },
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
