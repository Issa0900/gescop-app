import React, { useMemo, useState, useEffect } from "react";
import { noteBaseCA, notePeriodeCommune } from "@/lib/core/kpiRecords";
import EmptyState from "@/components/EmptyState";
import KpiCard from "@/components/kpis/KpiCard";
import KpiTrendChart from "@/components/kpis/KpiTrendChart";
import DomainScoreList from "@/components/kpis/DomainScoreList";
import DomainScoreLegend from "@/components/kpis/DomainScoreLegend";
import KpiCustomizePanel from "@/components/kpis/KpiCustomizePanel";
import { BarChart3, Download, SlidersHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/exportUtils";
import { computeDomainScores } from "@/lib/domainScores";
import { useDonneesKpi } from "@/hooks/useDonneesKpi";
import { usePeriodFilter } from "@/hooks/usePeriodFilter";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { FENETRE_MOIS, moisLisible } from "@/lib/graphiques";
import { preparerPeriodes, kpisParFenetre, serieMensuelle, decalerMois } from "@/lib/core/kpiPeriodes";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/lib/AuthContext";
import { useObservations } from "@/hooks/useObservations";
import { loadKpiPreferences, saveKpiPreferences, orderKpisByPreference, isKpiHidden } from "@/lib/kpiPreferences";
import { ADDABLE_KPIS, ADDABLE_KPI_IDS } from "@/lib/addableKpis";
import { getKpiDefinition } from "@/lib/core/kpiRegistry";
import { useKpiEngine } from "@/lib/useKpiEngine";
import { getStockAlertSettings, computeStockAlerts } from "@/lib/stockAlerts";
import { financialMonthlySeries } from "@/lib/financialData";
import {
  monthlyAggComplete,
  lastVal,
  prevVal,
  trendDir,
} from "@/lib/periods";
import {
  consommationTresorerie,
  runwayMonths,
  latestCashBalance,
  churnStats,
  customerValue,
  roasWindow,
  previousRoasWindow,
  anyColumnPresent,
  isRefundedOrder,
  productMarginPct,
} from "@/lib/metrics";

const IDS_FENETRES = ["total_revenue", "total_charges", "net_margin_pct", "order_revenue", "order_count", "aov"];
const KPI_MOTEUR = ["customer_sentiment_score", "gross_margin_pct", ...ADDABLE_KPI_IDS];

const domainLabels = {
  finance: "Finance",
  tresorerie: "Trésorerie",
  ventes: "Ventes",
  marketing: "Marketing",
  operations: "Opérations",
  clients: "Clients",
  rh: "RH",
};

// Palette catégorielle validée CVD (ordre fixe) — voir la skill dataviz.
const domainColors = {
  finance: "#2a78d6",
  tresorerie: "#eb6834",
  ventes: "#1baf7a",
  marketing: "#eda100",
  operations: "#e87ba4",
  clients: "#008300",
  rh: "#4a3aa7",
};

export default function Kpis() {
  // The stock threshold is a company setting, so these KPIs follow it like the
  // Produits page does instead of hard-coding their own shortage rule.
  const { company } = useCompany();
  const stockSettings = getStockAlertSettings(company);
  const { user } = useAuth();
  const userId = user?.id || user?.email || null;

  // Which cards are shown/hidden and in what order, per logged-in user.
  // Stored client-side (localStorage): a view preference, not business data.
  const [editMode, setEditMode] = useState(false);
  const [prefs, setPrefs] = useState(() => loadKpiPreferences(userId));
  useEffect(() => {
    setPrefs(loadKpiPreferences(userId));
  }, [userId]);
  const updatePrefs = (next) => {
    setPrefs(next);
    saveKpiPreferences(userId, next);
  };
  
  const { data: observations } = useObservations();

  // Memes donnees que tous les ecrans (useDonneesKpi), paie comprise.
  const { data: donnees, isLoading } = useDonneesKpi();
  const { transactions, orders, customers, campaigns, products, inventory, cashflow, campaignDaily, executiveSummary } = donnees;

  // Filtre temporel universel : règle stricte Flux (P&L) vs Soldes (Bilan)
  const periodFilter = usePeriodFilter(donnees);

  // Finance et ventes : le MOTEUR sur des fenetres de mois (kpiPeriodes). La
  // « marge nette (3 mois) » est la marge nette du moteur sur 3 mois, pas une
  // formule propre a cette page (qui oubliait la paie et le cout des ventes).
  const periodes = useMemo(() => {
    const prep = periodFilter.prep || preparerPeriodes(donnees);
    return { prep, fen: kpisParFenetre(prep, IDS_FENETRES), serie: financialMonthlySeries(donnees) };
  }, [donnees, periodFilter.prep]);

  const filteredKpis = useMemo(() => {
    return periodFilter.computeKpis(IDS_FENETRES);
  }, [periodFilter]);

  const donneesMoteur = useMemo(() => ({ ...donnees, observations: observations || [] }), [donnees, observations]);
  const { kpis: engineKpis } = useKpiEngine(donneesMoteur, KPI_MOTEUR);

  // "+ Ajouter un indicateur" catalog: computed live regardless of whether
  // the user has opted in, so the picker can show which ones actually have
  // enough data right now instead of listing them blind.
  const addableCatalog = useMemo(() => {
    return ADDABLE_KPIS.map(({ id, domain }) => {
      const def = getKpiDefinition(id);
      const result = engineKpis.get(id);
      const value = result?.value;
      const available = value !== undefined && value !== null && Number.isFinite(value);
      const unit = ["bfr_days", "dso", "dpo"].includes(id)
        ? " jours"
        : id === "ltv_cac_ratio" ? "x"
        : def?.dataType === "currency" ? "$"
        : def?.dataType === "percentage" ? "%"
        : "";
      // Statut du moteur : un KPI calcule avec une partie seulement de ses
      // sources (UNKNOWN) est affiche, mais signale comme partiel.
      const note = [
        result?.status === "UNKNOWN" ? "Partiel : une partie des données nécessaires n'est pas importée" : null,
        notePeriodeCommune(result),
      ].filter(Boolean).join(" · ") || null;
      return {
        id,
        domain,
        name: def?.name?.fr || id,
        value: available ? Math.round(value * 10) / 10 : null,
        unit,
        available,
        note,
      };
    });
  }, [engineKpis]);

  const computedKpis = useMemo(() => {
    const result = [];
    // Computed in the FINANCE block below and reused by CLIENTS to turn revenue
    // per customer into an actual LTV. Null when there is no margin to apply.

    const sentiment = engineKpis.get("customer_sentiment_score")?.value;
    if (sentiment !== undefined && sentiment !== null) {
      result.push({ name: "Sentiment client", domain: "clients", value: sentiment.toFixed(1), previous: null, trend: "stable", unit: "/10" });
    }

    // === FINANCE === (if transactions, orders or executiveSummary exist)
    const { fen, serie } = periodes;
    const currBatch = filteredKpis?.current || fen.mois;
    const prevBatch = filteredKpis?.previous || fen.moisPrec;
    const periodLabel = periodFilter.filter.label;

    const V = (fenetre, id) => { const x = fenetre?.get(id)?.value; return Number.isFinite(x) ? x : null; };
    const pousser = (name, domain, value, previous, unit, extra = {}) => {
      // Non mesure = pas de carte, jamais une carte a 0.
      if (value === null) return;
      const arrondi = (x) => (x === null ? null : unit === "%" ? Math.round(x * 10) / 10 : Math.round(x));
      result.push({ name, domain, value: arrondi(value), previous: arrondi(previous), trend: previous === null ? "stable" : trendDir(value, previous), unit, ...extra });
    };
    // Statut du moteur pour la fenetre affichee : « partiel » quand une partie
    // des sources manque (badge sur la carte, jamais un chiffre presente complet).
    const statut = (fenetre, id, noteBase) => {
      const r = fenetre?.get(id);
      const note = [noteBase, notePeriodeCommune(r)].filter(Boolean).join(" · ");
      return { ...(r?.status === "UNKNOWN" ? { statut: "partiel" } : {}), ...(note ? { note } : {}) };
    };
    const hasFinance = (transactions || []).length > 0 || (orders || []).length > 0 || (executiveSummary || []).length > 0;
    if (hasFinance) {
      pousser(`Chiffre d'affaires (${periodLabel})`, "finance", V(currBatch, "total_revenue"), V(prevBatch, "total_revenue"), "$", { id: "total_revenue", ...statut(currBatch, "total_revenue") });
      pousser(`Charges totales (${periodLabel})`, "finance", V(currBatch, "total_charges"), V(prevBatch, "total_charges"), "$",
        { id: "total_charges", lowerIsBetter: true, ...statut(currBatch, "total_charges", "Coût des ventes + dépenses + masse salariale (+ amortissement des immobilisations)") });
      pousser(`Marge nette (${periodLabel})`, "finance", V(currBatch, "net_margin_pct"), V(prevBatch, "net_margin_pct"), "%", { id: "net_margin_pct", ...statut(currBatch, "net_margin_pct") });
      if (fen.trim && periodFilter.filter.preset === "CLOSED_MONTH") {
        pousser("Marge nette (3 mois)", "finance", V(fen.trim, "net_margin_pct"), V(fen.trimPrec, "net_margin_pct"), "%", { id: "net_margin_pct_3m", ...statut(fen.trim, "net_margin_pct") });
      }

      // Trésorerie : snapshot strict à date d'arrêt (<= filter.endDate) vs comparatif (<= filter.compareEndDate)
      const cfCurrent = (cashflow || []).filter((c) => !c.date || c.date <= periodFilter.filter.endDate).sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1));
      const cfPrev = (cashflow || []).filter((c) => !c.date || c.date <= periodFilter.filter.compareEndDate).sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1));

      const latestCash = cfCurrent.length > 0 && cfCurrent[0].closing_cash != null
        ? Number(cfCurrent[0].closing_cash)
        : latestCashBalance(cashflow);
      const prevCash = cfPrev.length > 0 && cfPrev[0].closing_cash != null
        ? Number(cfPrev[0].closing_cash)
        : null;

      if (latestCash !== null) {
        const cashDateNote = cfCurrent[0]?.date ? `Solde au ${cfCurrent[0].date}` : null;
        result.push({
          id: "closing_cash",
          name: `Trésorerie de clôture (${periodLabel})`,
          domain: "finance",
          value: Math.round(latestCash),
          previous: prevCash !== null ? Math.round(prevCash) : null,
          trend: prevCash !== null ? trendDir(latestCash, prevCash, 1) : "stable",
          unit: "$",
          note: cashDateNote,
        });

        // Autonomie : solde du relevé / consommation mesurée sur la même base
        const { burn, base } = consommationTresorerie({
          cashflow: cfCurrent,
          revSeries: serie.map((p) => ({ month: p.month, val: p.income })),
          expSeries: serie.map((p) => ({ month: p.month, val: p.expense })),
        }, 3);
        const runway = runwayMonths(latestCash, burn);
        const noteBase = base === "resultat" ? "Estimée sur le résultat (aucun flux de trésorerie importé)" : null;
        if (runway === Infinity) {
          result.push({ id: "cash_runway", name: "Autonomie de trésorerie", domain: "finance", value: "Autofinancée", previous: null, trend: "stable", unit: "", note: noteBase });
        } else if (runway !== null && Number.isFinite(runway)) {
          result.push({ id: "cash_runway", name: "Autonomie de trésorerie", domain: "finance", value: Math.round(runway * 10) / 10, previous: null, trend: "stable", unit: " mois", note: noteBase });
        }
      }
    }

    // Les indicateurs Ventes proviennent des commandes (entite Order), tandis
    // que les indicateurs Finance proviennent des transactions encaissees
    // (entite Transaction). Les deux ne se reconcilient pas : une PME peut
    // encaisser sans commande saisie, et inversement. Les libelles nomment
    // donc explicitement la source pour qu'un ecart ne passe pas pour une erreur.
    // === VENTES === (only if orders exist)
    if ((orders || []).length > 0) {
      const noteCA = noteBaseCA(orders);
      const ordersInPeriod = (orders || []).filter((o) => {
        const d = (o.date || "").slice(0, 10);
        return !d || (d >= periodFilter.filter.startDate && d <= periodFilter.filter.endDate);
      });
      const returns = ordersInPeriod.filter(isRefundedOrder);
      const hasReturnSignal = anyColumnPresent(ordersInPeriod, ["return_status", "payment_status", "fulfillment_status"]);
      const returnRate = ordersInPeriod.length > 0 ? (returns.length / ordersInPeriod.length) * 100 : 0;

      pousser(`Panier moyen (${periodLabel})`, "ventes", V(currBatch, "aov"), V(prevBatch, "aov"), "$", { id: "aov", note: noteCA, ...statut(currBatch, "aov") });
      pousser(`Commandes (${periodLabel})`, "ventes", V(currBatch, "order_count"), V(prevBatch, "order_count"), "", { id: "order_count", ...statut(currBatch, "order_count") });
      if (hasReturnSignal) {
        result.push({ id: "return_rate", name: "Taux de retour (en nombre de commandes)", domain: "ventes", value: Math.round(returnRate * 10) / 10, previous: null, trend: "stable", unit: "%", lowerIsBetter: true });
      }
      pousser(`CA commandes (${periodLabel})`, "ventes", V(currBatch, "order_revenue"), V(prevBatch, "order_revenue"), "$", { id: "order_revenue", note: noteCA, ...statut(currBatch, "order_revenue") });
      pousser("CA commandes (total)", "ventes", V(fen.total, "order_revenue"), null, "$", { id: "order_revenue_total", note: noteCA, ...statut(fen.total, "order_revenue") });
    }

    // === MARKETING === (only if campaigns exist)
    if ((campaigns || []).length > 0) {
      const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0);
      const totalNewCust = campaigns.reduce((s, c) => s + (Number(c.new_customers) || 0), 0);
      const totalConv = campaigns.reduce((s, c) => s + (Number(c.conversions) || 0), 0);
      const totalCampRev = campaigns.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
      const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0);
      const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0);
      // Same fallback as the Marketing page: an absent "new_customers" column
      // must not turn into a CAC of 0 € next to a large spend. Conversions are
      // the standard proxy; when neither exists the KPI is simply not shown.
      const cacBasis = totalNewCust > 0 ? "clients" : totalConv > 0 ? "conversions" : null;
      const cac = cacBasis === "clients" ? totalSpend / totalNewCust
        : cacBasis === "conversions" ? totalSpend / totalConv
          : null;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const convRate = totalClicks > 0 ? (totalConv / totalClicks) * 100 : 0;

      // ROAS on a recent window with a real computed trend, from dated daily
      // rows when available; campaign totals are all-time and have no trend.
      const spendM = monthlyAggComplete(campaignDaily || [], "date", "spend");
      const cRevM = monthlyAggComplete(campaignDaily || [], "date", "revenue");
      const windowRoas = roasWindow(spendM, cRevM, 3);
      const roasPrev = previousRoasWindow(spendM, cRevM, 3);
      const roas = windowRoas !== null ? windowRoas : totalSpend > 0 ? totalCampRev / totalSpend : null;

      if (roas !== null) {
        result.push({
          name: windowRoas !== null ? "ROAS (3 mois)" : "ROAS (cumul)",
          domain: "marketing",
          value: Math.round(roas * 10) / 10,
          previous: roasPrev !== null ? Math.round(roasPrev * 10) / 10 : null,
          trend: trendDir(roas, roasPrev),
          unit: "x",
        });
      }
      // These three are all-time cumulative figures: campaign rows carry no date,
      // so they cannot be windowed and must not pretend to have a trend.
      if (cac !== null) {
        result.push({
          name: cacBasis === "conversions" ? "Coût par conversion" : "CAC moyen",
          domain: "marketing",
          value: Math.round(cac),
          previous: null,
          trend: "stable",
          unit: "$",
        });
      }
      result.push({ name: "Taux de clic (CTR)", domain: "marketing", value: Math.round(ctr * 100) / 100, previous: null, trend: "stable", unit: "%" });
      result.push({ name: "Taux de conversion", domain: "marketing", value: Math.round(convRate * 10) / 10, previous: null, trend: "stable", unit: "%" });
    }

    // === OPÉRATIONS === (only if products or inventory exist)
    if ((products || []).length > 0 || (inventory || []).length > 0) {
      // Same shortage definition as the Produits page and the alert centre -
      // the company threshold included. Pass periodFilter.filter.endDate to neutralise
      // false dormancy on historical datasets.
      const stock = computeStockAlerts(products, inventory, stockSettings, orders, periodFilter.filter.endDate);
      const prods = (products && products.length > 0) ? products : (inventory || []);
      const margins = prods
        .map((p) => productMarginPct(p))
        .filter((m) => m !== null && Number.isFinite(m));
      const avgMargin = margins.length > 0
        ? margins.reduce((s, m) => s + m, 0) / margins.length
        : 0;

      result.push({ id: "product_margin_pct", name: "Marge produit moyenne", domain: "operations", value: Math.round(avgMargin * 10) / 10, previous: null, trend: "stable", unit: "%" });
      result.push({ id: "dormant_stock_count", name: `Stock dormant (${stock.dormantMonths} mois)`, domain: "operations", value: stock.dormantCount, previous: null, trend: "stable", unit: "" });
      result.push({ id: "reorder_stock_count", name: "Stock à réapprovisionner", domain: "operations", value: stock.alertCount, previous: null, trend: "stable", unit: "" });
      result.push({ id: "out_of_stock_count", name: "Produits en rupture", domain: "operations", value: stock.outOfStockCount, previous: null, trend: "stable", unit: "" });
    }

    // === CLIENTS === (only if customers exist)
    if ((customers || []).length > 0) {
      // One shared churn definition (status only - "a_risque" is not churn).
      const churn = churnStats(customers, orders);
      const custMonthly = monthlyAggComplete(customers, "acquisition_date", "customer_id", "count");
      const lastEntry = custMonthly.length > 0 ? custMonthly[custMonthly.length - 1] : null;
      const moisCible = periodFilter.filter.anchorMonth || fen.dernierMois || lastEntry?.month;
      let newCustomers = 0;
      let prevNewCustomers = 0;
      if (moisCible) {
        const entry = custMonthly.find((e) => e.month === moisCible);
        newCustomers = entry ? entry.val : 0;
        const precMois = decalerMois(moisCible, -1);
        const prevEntry = custMonthly.find((e) => e.month === precMois);
        prevNewCustomers = prevEntry ? prevEntry.val : 0;
      } else {
        newCustomers = lastVal(custMonthly);
        prevNewCustomers = prevVal(custMonthly);
      }
      const moisNom = moisCible ? moisLisible(moisCible) : "mois";
      // Revenue per customer: the numerator covers every buyer, so the
      // denominator must too. Dividing all-customer revenue by ACTIVE customers
      // only was inflating this by 1/(share of active) - 2x at 50% churn.
      // LTV sur la MARGE BRUTE du moteur (valeur apportee par le client avant
      // frais fixes), pas sur une marge maison.
      const margeBrute = engineKpis.get("gross_margin_pct")?.value;
      const value = customerValue(orders, customers, Number.isFinite(margeBrute) ? margeBrute : null);

      // "Clients actifs" / "Clients perdus" both read off the customer status
      // field. When no row has ever carried "actif", "inactif" or "perdu" that
      // field is unfilled, not a perfect 0 % churn - showing "0" here would
      // claim a clean base instead of "we don't know".
      if (churn.statusMeasured) {
        result.push({ id: "active_customers", name: "Clients actifs", domain: "clients", value: churn.active, previous: null, trend: "stable", unit: "" });
        // Cumulative share of the base ever lost - named as such, because it is
        // not a rate over a period and can never go down.
        result.push({ id: "churned_customers_cumul", name: "Clients perdus (cumul)", domain: "clients", value: Math.round(churn.rate * 10) / 10, previous: null, trend: "stable", unit: "%" });
      }
      // The actionable one: attrition measured on real purchase behaviour.
      if (churn.behaviourRate !== null) {
        result.push({ id: "inactive_customers", name: `Inactifs depuis ${churn.inactiveMonths} mois`, domain: "clients", value: Math.round(churn.behaviourRate * 10) / 10, previous: null, trend: "stable", unit: "%" });
      }
      if (churn.atRisk > 0) {
        result.push({ id: "at_risk_customers", name: "Clients actifs à risque", domain: "clients", value: churn.atRisk, previous: null, trend: "stable", unit: "" });
      }
      result.push({ id: "new_customers", name: `Nouveaux clients (${moisNom})`, domain: "clients", value: newCustomers, previous: prevNewCustomers, trend: trendDir(newCustomers, prevNewCustomers), unit: "" });
      if (value.avgRevenue !== null) {
        result.push({ id: "arpu", name: "Revenu moyen par client", domain: "clients", value: Math.round(value.avgRevenue), previous: null, trend: "stable", unit: "$" });
      }
      // A real LTV is value, not turnover - only shown when a margin is known.
      if (value.ltv !== null) {
        result.push({ id: "clv", name: "LTV client (marge brute)", domain: "clients", value: Math.round(value.ltv), previous: null, trend: "stable", unit: "$" });
      }
    }

    return result;
  }, [donnees, periodes, periodFilter, filteredKpis, stockSettings.threshold, stockSettings.useReorderPoint, stockSettings.dormantMonths, engineKpis]);

  // Les KPI viennent du moteur uniquement. Les cartes ecrites par l'IA
  // (entite Kpi) affichaient des valeurs qu'elle avait calculees elle-meme, a
  // cote - et parfois en contradiction - des chiffres du moteur.
  const allKpis = useMemo(() => {
    // Indicators the user opted into via "+ Ajouter un indicateur" - only
    // rendered while they actually have enough data (`available`), so an
    // added card disappears on its own if the data it needs runs out later,
    // instead of showing a stale or fake value.
    const addedExtras = addableCatalog.filter(
      (k) => (prefs.added || []).includes(k.id) && k.available
    ).map((k) => ({ name: k.name, domain: k.domain, value: k.value, previous: null, trend: "stable", unit: k.unit, note: k.note, statut: k.note ? "partiel" : undefined }));
    return [...computedKpis, ...addedExtras];
  }, [computedKpis, addableCatalog, prefs.added]);

  const byDomain = useMemo(() => {
    const groups = {};
    allKpis.forEach((k) => {
      if (!groups[k.domain]) groups[k.domain] = [];
      groups[k.domain].push(k);
    });
    return groups;
  }, [allKpis]);

  const orderedByDomain = useMemo(() => orderKpisByPreference(byDomain, prefs), [byDomain, prefs]);

  const rtScores = useMemo(() => computeDomainScores({ ...donnees, company }), [donnees, company]);

  // Trend chart data: revenue, AOV, margin % by month.
  // The in-progress month is excluded - a partial month renders as a false cliff.
  const trendData = useMemo(() => {
    // Meme serie que Finance et la vue d'ensemble (moteur, mois par mois) :
    // CA, marge NETTE (charges totales) et panier moyen du moteur.
    const paniers = new Map(serieMensuelle(periodes.prep, ["aov"]).map((p) => [p.month, p.aov]));
    return periodes.serie.slice(-FENETRE_MOIS).map((p) => ({
      month: p.month,
      revenue: Math.round(p.income),
      aov: paniers.get(p.month) != null ? Math.round(paniers.get(p.month)) : null,
      margin: p.income > 0 && p.chargesMesurees ? Math.round((p.margin / p.income) * 100) : null,
    }));
  }, [periodes]);

  const exportKpis = () => {
    const rows = allKpis.map((k) => ({
      Domaine: domainLabels[k.domain] || k.domain,
      Indicateur: k.name,
      Valeur: k.value,
      Unite: k.unit || "",
      Precedent: k.previous ?? "",
      Tendance: k.trend || "",
    }));
    downloadCSV(`GESCOP_KPIs_${new Date().toISOString().slice(0, 10)}`, rows, {
      Domaine: "Domaine",
      Indicateur: "Indicateur",
      Valeur: "Valeur",
      Unite: "Unité",
      Precedent: "Précédent",
      Tendance: "Tendance",
    });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (allKpis.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Aucun indicateur disponible"
        description="Importez vos données pour calculer vos indicateurs de gestion."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vos indicateurs de gestion</h1>
          <p className="mt-1 text-muted-foreground">Suivez les indicateurs qui comptent, calculés directement à partir de vos données.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode((v) => !v)} disabled={allKpis.length === 0}>
            {editMode ? <Check className="mr-1.5 h-4 w-4" /> : <SlidersHorizontal className="mr-1.5 h-4 w-4" />}
            {editMode ? "Valider" : "Personnaliser l'affichage"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportKpis} disabled={allKpis.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Exporter (CSV)
          </Button>
        </div>
      </div>

      <PeriodSelector periodFilter={periodFilter} />

      {trendData.length > 0 && <KpiTrendChart data={trendData} />}

      <div>
        <h2 className="mb-1 text-lg font-semibold">Score de santé par domaine</h2>
        <p className="mb-4 text-sm text-muted-foreground">Évaluation de 0 à 100, du domaine le plus sous tension au plus solide.</p>
        <DomainScoreList
          domains={Object.entries(domainLabels)
            .filter(([key]) => rtScores[key])
            .map(([key, label]) => ({
              key,
              label,
              score: rtScores[key].score,
              measured: rtScores[key].measured !== false,
              trend: rtScores[key].trend,
              explanation: rtScores[key].explanation,
            }))}
        />
        <DomainScoreLegend />
      </div>

      {editMode ? (
        <KpiCustomizePanel byDomain={byDomain} domainLabels={domainLabels} prefs={prefs} onChange={updatePrefs} addableCatalog={addableCatalog} />
      ) : (
        Object.entries(domainLabels).map(([domain, label]) => {
          const items = orderedByDomain[domain]?.filter((k) => !isKpiHidden(k, prefs));
          if (!items || items.length === 0) return null;
          return (
            <div key={domain}>
              <h2 className="mb-4 text-lg font-semibold">{label}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((k, idx) => (
                  <KpiCard key={`${k.name}-${idx}`} kpi={k} domainColor={domainColors[domain]} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}