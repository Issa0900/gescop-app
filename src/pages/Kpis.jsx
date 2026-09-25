import React, { useMemo, useState, useEffect } from "react";
import { noteBaseCA } from "@/lib/core/kpiRecords";
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
import { FENETRE_MOIS } from "@/lib/graphiques";
import { preparerPeriodes, kpisParFenetre, serieMensuelle } from "@/lib/core/kpiPeriodes";
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

  // Finance et ventes : le MOTEUR sur des fenetres de mois (kpiPeriodes). La
  // « marge nette (3 mois) » est la marge nette du moteur sur 3 mois, pas une
  // formule propre a cette page (qui oubliait la paie et le cout des ventes).
  const periodes = useMemo(() => {
    const prep = preparerPeriodes(donnees);
    return { prep, fen: kpisParFenetre(prep, IDS_FENETRES), serie: financialMonthlySeries(donnees) };
  }, [donnees]);

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
      const note = result?.status === "UNKNOWN" ? "Partiel : une partie des données nécessaires n'est pas importée" : null;
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
    const V = (fenetre, id) => { const x = fenetre?.get(id)?.value; return Number.isFinite(x) ? x : null; };
    const pousser = (name, domain, value, previous, unit, extra = {}) => {
      // Non mesure = pas de carte, jamais une carte a 0.
      if (value === null) return;
      const arrondi = (x) => (x === null ? null : unit === "%" ? Math.round(x * 10) / 10 : Math.round(x));
      result.push({ name, domain, value: arrondi(value), previous: arrondi(previous), trend: previous === null ? "stable" : trendDir(value, previous), unit, ...extra });
    };
    // Statut du moteur pour la fenetre affichee : « partiel » quand une partie
    // des sources manque (badge sur la carte, jamais un chiffre presente complet).
    const statut = (fenetre, id) => (fenetre?.get(id)?.status === "UNKNOWN" ? { statut: "partiel" } : {});
    const hasFinance = (transactions || []).length > 0 || (orders || []).length > 0 || (executiveSummary || []).length > 0;
    if (hasFinance) {
      pousser("Chiffre d'affaires (mois)", "finance", V(fen.mois, "total_revenue"), V(fen.moisPrec, "total_revenue"), "$", statut(fen.mois, "total_revenue"));
      pousser("Charges totales (mois)", "finance", V(fen.mois, "total_charges"), V(fen.moisPrec, "total_charges"), "$",
        { note: "Coût des ventes + dépenses + masse salariale", lowerIsBetter: true, ...statut(fen.mois, "total_charges") });
      pousser("Marge nette (mois)", "finance", V(fen.mois, "net_margin_pct"), V(fen.moisPrec, "net_margin_pct"), "%", statut(fen.mois, "net_margin_pct"));
      if (fen.trim) pousser("Marge nette (3 mois)", "finance", V(fen.trim, "net_margin_pct"), V(fen.trimPrec, "net_margin_pct"), "%", statut(fen.trim, "net_margin_pct"));
      else pousser("Marge nette (période importée)", "finance", V(fen.total, "net_margin_pct"), null, "%", statut(fen.total, "net_margin_pct"));

      // Cash: latest balance, compared on a 7-day average to avoid daily noise.
      const cfSorted = (cashflow || []).slice().sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1));
      const avgCash = (arr) =>
        arr.length > 0 ? arr.reduce((s, c) => s + (Number(c.closing_cash) || 0), 0) / arr.length : 0;
      const latestCash = latestCashBalance(cashflow);
      const cash7 = avgCash(cfSorted.slice(0, 7));
      // Only compare against a full prior week, never against 2 stray rows.
      const cashPrev7 = cfSorted.length >= 14 ? avgCash(cfSorted.slice(7, 14)) : null;

      if (latestCash !== null) {
        result.push({ name: "Trésorerie actuelle", domain: "finance", value: Math.round(latestCash), previous: cashPrev7 !== null ? Math.round(cashPrev7) : null, trend: trendDir(cash7, cashPrev7, 1), unit: "$" });
        // Autonomie : solde du releve / consommation mesuree sur le MEME releve
        // (consommationTresorerie, regle commune a toutes les pages).
        const { burn, base } = consommationTresorerie({
          cashflow,
          revSeries: serie.map((p) => ({ month: p.month, val: p.income })),
          expSeries: serie.map((p) => ({ month: p.month, val: p.expense })),
        }, 3);
        const runway = runwayMonths(latestCash, burn);
        const noteBase = base === "resultat" ? "Estimée sur le résultat (aucun flux de trésorerie importé)" : null;
        if (runway === Infinity) {
          result.push({ name: "Autonomie de trésorerie", domain: "finance", value: "Autofinancée", previous: null, trend: "stable", unit: "", note: noteBase });
        } else if (runway !== null && Number.isFinite(runway)) {
          // No previous window is computed for runway, so no arrow is shown.
          result.push({ name: "Autonomie de trésorerie", domain: "finance", value: Math.round(runway * 10) / 10, previous: null, trend: "stable", unit: " mois", note: noteBase });
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
      // Return rate is measured on EVERY order (refunded or not - that's the
      // point). Revenue figures below use only the orders whose money stayed
      // with the business: a refunded order's total was already reversed and
      // must not be counted as revenue.
      // Montants HORS TAXES, une ligne par commande (kpiRecords) : le total
      // est TTC des qu'un fichier fournit les taxes, et un fichier d'une ligne
      // par article comptait chaque article comme une commande.
      const noteCA = noteBaseCA(orders);
      const returns = orders.filter(isRefundedOrder);
      // Taux de retour EN NOMBRE de commandes, lu sur les statuts : different
      // du taux « en valeur » du moteur (lignes d'avoir), d'ou un nom distinct.
      // 0 % only means "no returns" when at least one column could have
      // reported one; otherwise the KPI is withheld rather than shown as zero.
      const hasReturnSignal = anyColumnPresent(orders, ["return_status", "payment_status", "fulfillment_status"]);
      const returnRate = orders.length > 0 ? (returns.length / orders.length) * 100 : 0;

      pousser("Panier moyen (mois)", "ventes", V(fen.mois, "aov"), V(fen.moisPrec, "aov"), "$", { note: noteCA, ...statut(fen.mois, "aov") });
      pousser("Commandes (mois)", "ventes", V(fen.mois, "order_count"), V(fen.moisPrec, "order_count"), "", statut(fen.mois, "order_count"));
      if (hasReturnSignal) {
        result.push({ name: "Taux de retour (en nombre de commandes)", domain: "ventes", value: Math.round(returnRate * 10) / 10, previous: null, trend: "stable", unit: "%", lowerIsBetter: true });
      }
      if (fen.trim) pousser("CA commandes (3 mois)", "ventes", V(fen.trim, "order_revenue"), V(fen.trimPrec, "order_revenue"), "$", { note: noteCA, ...statut(fen.trim, "order_revenue") });
      pousser("CA commandes (total)", "ventes", V(fen.total, "order_revenue"), null, "$", { note: noteCA, ...statut(fen.total, "order_revenue") });
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
      // the company threshold included. "Alertes rupture" used to read the
      // imported stock_status alone and never moved when the user changed their
      // threshold, so the two screens disagreed on the same rows.
      const stock = computeStockAlerts(products, inventory, stockSettings, orders);
      const avgMargin = (products || []).length > 0
        ? (products || []).reduce((s, p) => s + (Number(p.gross_margin) || 0), 0) / (products || []).length
        : 0;

      result.push({ name: "Marge produit moyenne", domain: "operations", value: Math.round(avgMargin * 10) / 10, previous: null, trend: "stable", unit: "%" });
      // Counts, not trends: there is no previous snapshot to compare against.
      // Les deux compteurs ci-dessous mesurent des choses differentes et
      // s'affichent cote a cote : alertCount = produits AU OU SOUS leur seuil de
      // reapprovisionnement, outOfStockCount = produits a stock nul. Nommer les
      // deux "rupture" faisait lire "24 ruptures" a cote de "0 rupture".
      result.push({ name: `Stock dormant (${stock.dormantMonths} mois)`, domain: "operations", value: stock.dormantCount, previous: null, trend: "stable", unit: "" });
      result.push({ name: "Stock à réapprovisionner", domain: "operations", value: stock.alertCount, previous: null, trend: "stable", unit: "" });
      result.push({ name: "Produits en rupture", domain: "operations", value: stock.outOfStockCount, previous: null, trend: "stable", unit: "" });
    }

    // === CLIENTS === (only if customers exist)
    if ((customers || []).length > 0) {
      // One shared churn definition (status only - "a_risque" is not churn).
      const churn = churnStats(customers, orders);
      const custMonthly = monthlyAggComplete(customers, "acquisition_date", "customer_id", "count");
      const newCustomers = lastVal(custMonthly);
      const prevNewCustomers = prevVal(custMonthly);
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
        result.push({ name: "Clients actifs", domain: "clients", value: churn.active, previous: null, trend: "stable", unit: "" });
        // Cumulative share of the base ever lost - named as such, because it is
        // not a rate over a period and can never go down.
        result.push({ name: "Clients perdus (cumul)", domain: "clients", value: Math.round(churn.rate * 10) / 10, previous: null, trend: "stable", unit: "%" });
      }
      // The actionable one: attrition measured on real purchase behaviour.
      if (churn.behaviourRate !== null) {
        result.push({ name: `Inactifs depuis ${churn.inactiveMonths} mois`, domain: "clients", value: Math.round(churn.behaviourRate * 10) / 10, previous: null, trend: "stable", unit: "%" });
      }
      if (churn.atRisk > 0) {
        result.push({ name: "Clients actifs à risque", domain: "clients", value: churn.atRisk, previous: null, trend: "stable", unit: "" });
      }
      result.push({ name: "Nouveaux clients (mois)", domain: "clients", value: newCustomers, previous: prevNewCustomers, trend: trendDir(newCustomers, prevNewCustomers), unit: "" });
      if (value.avgRevenue !== null) {
        result.push({ name: "Revenu moyen par client", domain: "clients", value: Math.round(value.avgRevenue), previous: null, trend: "stable", unit: "$" });
      }
      // A real LTV is value, not turnover - only shown when a margin is known.
      if (value.ltv !== null) {
        result.push({ name: "LTV client (marge brute)", domain: "clients", value: Math.round(value.ltv), previous: null, trend: "stable", unit: "$" });
      }
    }

    return result;
  }, [donnees, periodes, stockSettings.threshold, stockSettings.useReorderPoint, engineKpis]);

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