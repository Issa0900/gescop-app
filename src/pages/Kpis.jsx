import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import EmptyState from "@/components/EmptyState";
import KpiCard from "@/components/kpis/KpiCard";
import KpiTrendChart from "@/components/kpis/KpiTrendChart";
import DomainScoreList from "@/components/kpis/DomainScoreList";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/exportUtils";
import { computeDomainScores } from "@/lib/domainScores";
import {
  monthlyAgg,
  monthlyAggComplete,
  lastVal,
  prevVal,
  trendDir,
  sumLast,
  sumPrev,
  latestByKey,
} from "@/lib/periods";

const domainLabels = {
  finance: "Finance",
  ventes: "Ventes",
  marketing: "Marketing",
  operations: "Opérations",
  clients: "Clients",
};

const domainColors = {
  finance: "#2563eb",
  ventes: "#16a34a",
  marketing: "#ea580c",
  operations: "#9333ea",
  clients: "#0891b2",
};

export default function Kpis() {
  const { data: kpisLLM, isLoading } = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const list = await base44.entities.Kpi.list();
      return list || [];
    },
    staleTime: 0,
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions-kpi"],
    queryFn: async () => {
      const list = await base44.entities.Transaction.list("-date", 500);
      return list || [];
    },
    staleTime: 0,
  });
  const { data: orders } = useQuery({
    queryKey: ["orders-kpi"],
    queryFn: async () => {
      const list = await base44.entities.Order.list("-date", 500);
      return list || [];
    },
    staleTime: 0,
  });
  const { data: customers } = useQuery({
    queryKey: ["customers-kpi"],
    queryFn: async () => {
      const list = await base44.entities.Customer.list();
      return list || [];
    },
    staleTime: 0,
  });
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-kpi"],
    queryFn: async () => {
      const list = await base44.entities.Campaign.list();
      return list || [];
    },
    staleTime: 0,
  });
  const { data: products } = useQuery({
    queryKey: ["products-kpi"],
    queryFn: async () => {
      const list = await base44.entities.Product.list();
      return list || [];
    },
    staleTime: 0,
  });
  const { data: inventory } = useQuery({
    queryKey: ["inventory-kpi"],
    queryFn: async () => {
      const list = await base44.entities.Inventory.list("-date", 500);
      return list || [];
    },
    staleTime: 0,
  });
  const { data: cashflow } = useQuery({
    queryKey: ["cashflow-kpi"],
    queryFn: async () => {
      const list = await base44.entities.Cashflow.list("-date", 1000);
      return list || [];
    },
    staleTime: 0,
  });
  const { data: campaignDaily } = useQuery({
    queryKey: ["campaign-daily-kpi"],
    queryFn: async () => {
      const list = await base44.entities.CampaignDaily.list("-date", 500);
      return list || [];
    },
    staleTime: 0,
  });

  const computedKpis = useMemo(() => {
    const result = [];

    // === FINANCE === (only if transactions exist)
    // All month-over-month figures use COMPLETE months: the in-progress month
    // holds only a few days of data and would look like a collapse.
    if ((transactions || []).length > 0) {
      const incomes = transactions.filter((t) => t.type === "income");
      const expenses = transactions.filter((t) => t.type === "expense");

      const revMonthly = monthlyAggComplete(incomes, "date", "amount");
      const expMonthly = monthlyAggComplete(expenses, "date", "amount");
      const currRev = lastVal(revMonthly);
      const prevRev = prevVal(revMonthly);
      const currExp = lastVal(expMonthly);
      const prevExp = prevVal(expMonthly);
      const currMarginPct = currRev > 0 ? ((currRev - currExp) / currRev) * 100 : 0;
      const prevMarginPct = prevRev > 0 ? ((prevRev - prevExp) / prevRev) * 100 : 0;

      // Cash: latest balance, compared on a 7-day average to avoid daily noise.
      const cfSorted = (cashflow || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      const avgCash = (arr) =>
        arr.length > 0 ? arr.reduce((s, c) => s + (Number(c.closing_cash) || 0), 0) / arr.length : 0;
      const latestCash = cfSorted[0]?.closing_cash || 0;
      const cash7 = avgCash(cfSorted.slice(0, 7));
      const cashPrev7 = avgCash(cfSorted.slice(7, 14));

      result.push({ name: "Revenus (dernier mois complet)", domain: "finance", value: Math.round(currRev), previous: Math.round(prevRev), trend: trendDir(currRev, prevRev), unit: "$" });
      result.push({ name: "Dépenses (dernier mois complet)", domain: "finance", value: Math.round(currExp), previous: Math.round(prevExp), trend: trendDir(currExp, prevExp), unit: "$" });
      result.push({ name: "Marge brute (dernier mois complet)", domain: "finance", value: Math.round(currMarginPct), previous: Math.round(prevMarginPct), trend: trendDir(currMarginPct, prevMarginPct), unit: "%" });
      if ((cashflow || []).length > 0) {
        result.push({ name: "Trésorerie actuelle", domain: "finance", value: Math.round(latestCash), previous: cashPrev7 > 0 ? Math.round(cashPrev7) : null, trend: trendDir(cash7, cashPrev7, 1), unit: "$" });
        // Runway: months of cover at the recent burn rate.
        const recentBurn = expMonthly.slice(-3).length
          ? expMonthly.slice(-3).reduce((s, e) => s + e.val, 0) / expMonthly.slice(-3).length
          : 0;
        if (recentBurn > 0) {
          const runway = latestCash / recentBurn;
          result.push({ name: "Autonomie de trésorerie", domain: "finance", value: Math.round(runway * 10) / 10, previous: null, trend: runway >= 6 ? "up" : runway < 3 ? "down" : "stable", unit: " mois" });
        }
      }
    }

    // === VENTES === (only if orders exist)
    if ((orders || []).length > 0) {
      const orderRevMonthly = monthlyAggComplete(orders, "date", "total");
      const orderCntMonthly = monthlyAggComplete(orders, "date", "total", "count");
      const currOrders = lastVal(orderCntMonthly);
      const prevOrders = prevVal(orderCntMonthly);
      const currOrderRev = lastVal(orderRevMonthly);
      const prevOrderRev = prevVal(orderRevMonthly);
      const currAOV = currOrders > 0 ? currOrderRev / currOrders : 0;
      const prevAOV = prevOrders > 0 ? prevOrderRev / prevOrders : 0;
      const totalOrderRev = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const returns = orders.filter((o) =>
        (o.return_status && o.return_status !== "aucun") ||
        o.payment_status === "rembourse" ||
        o.fulfillment_status === "retourne"
      );
      const returnRate = orders.length > 0 ? (returns.length / orders.length) * 100 : 0;

      // 3-month blocks: less sensitive to a single outlier month than 1-vs-1.
      const rev3 = sumLast(orderRevMonthly, 3);
      const revPrev3 = sumPrev(orderRevMonthly, 3);

      result.push({ name: "Panier moyen", domain: "ventes", value: Math.round(currAOV), previous: Math.round(prevAOV), trend: trendDir(currAOV, prevAOV), unit: "$" });
      result.push({ name: "Commandes (dernier mois complet)", domain: "ventes", value: currOrders, previous: prevOrders, trend: trendDir(currOrders, prevOrders), unit: "" });
      result.push({ name: "Taux de retour", domain: "ventes", value: Math.round(returnRate * 10) / 10, previous: null, trend: returnRate > 10 ? "down" : "up", unit: "%" });
      result.push({ name: "CA sur 3 mois", domain: "ventes", value: Math.round(rev3), previous: revPrev3 > 0 ? Math.round(revPrev3) : null, trend: trendDir(rev3, revPrev3), unit: "$" });
      result.push({ name: "Revenu total (commandes)", domain: "ventes", value: Math.round(totalOrderRev), previous: null, trend: "stable", unit: "$" });
    }

    // === MARKETING === (only if campaigns exist)
    if ((campaigns || []).length > 0) {
      const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0);
      const totalNewCust = campaigns.reduce((s, c) => s + (Number(c.new_customers) || 0), 0);
      const totalConv = campaigns.reduce((s, c) => s + (Number(c.conversions) || 0), 0);
      const totalCampRev = campaigns.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
      const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0);
      const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0);
      const cac = totalNewCust > 0 ? totalSpend / totalNewCust : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const convRate = totalClicks > 0 ? (totalConv / totalClicks) * 100 : 0;

      // ROAS on a recent window with a real computed trend, from dated daily
      // rows when available; campaign totals are all-time and have no trend.
      const spendM = monthlyAggComplete(campaignDaily || [], "date", "spend");
      const cRevM = monthlyAggComplete(campaignDaily || [], "date", "revenue");
      const s3 = sumLast(spendM, 3);
      const sp3 = sumPrev(spendM, 3);
      const roas = s3 > 0 ? sumLast(cRevM, 3) / s3 : totalSpend > 0 ? totalCampRev / totalSpend : 0;
      const roasPrev = sp3 > 0 ? sumPrev(cRevM, 3) / sp3 : 0;

      result.push({
        name: s3 > 0 ? "ROAS (3 derniers mois)" : "ROAS moyen",
        domain: "marketing",
        value: Math.round(roas * 10) / 10,
        previous: roasPrev > 0 ? Math.round(roasPrev * 10) / 10 : null,
        trend: roasPrev > 0 ? trendDir(roas, roasPrev) : "stable",
        unit: "x",
      });
      result.push({ name: "CAC moyen", domain: "marketing", value: Math.round(cac), previous: null, trend: "stable", unit: "$" });
      result.push({ name: "Taux de clic (CTR)", domain: "marketing", value: Math.round(ctr * 100) / 100, previous: null, trend: "stable", unit: "%" });
      result.push({ name: "Taux de conversion", domain: "marketing", value: Math.round(convRate * 10) / 10, previous: null, trend: "stable", unit: "%" });
    }

    // === OPÉRATIONS === (only if products or inventory exist)
    if ((products || []).length > 0 || (inventory || []).length > 0) {
      // Latest snapshot per product — counting every historical inventory row
      // over-counts the same problem once per recorded day.
      const latestInv = latestByKey(inventory || [], "product_id", "date");
      const dormantStock = latestInv.filter((i) => i.stock_status === "dormant").length;
      const ruptureStock = latestInv.filter((i) => ["rupture", "proche_rupture"].includes(i.stock_status)).length;
      const avgMargin = (products || []).length > 0
        ? (products || []).reduce((s, p) => s + (Number(p.gross_margin) || 0), 0) / (products || []).length
        : 0;
      // Reorder check against the recorded closing stock, not the imported
      // inventory_level field, so it matches the Produits page.
      const invByProduct = {};
      latestInv.forEach((i) => { invByProduct[i.product_id] = i; });
      const lowStockProducts = (products || []).filter((p) => {
        if (!p.reorder_point) return false;
        const snap = invByProduct[p.product_id];
        const stock = snap && snap.closing_stock != null ? Number(snap.closing_stock) : Number(p.inventory_level) || 0;
        return stock <= p.reorder_point;
      }).length;

      result.push({ name: "Marge produit moyenne", domain: "operations", value: Math.round(avgMargin * 10) / 10, previous: null, trend: "stable", unit: "%" });
      result.push({ name: "Stock dormant", domain: "operations", value: dormantStock, previous: null, trend: dormantStock > 0 ? "down" : "up", unit: "" });
      result.push({ name: "Alertes rupture", domain: "operations", value: ruptureStock, previous: null, trend: ruptureStock > 0 ? "down" : "up", unit: "" });
      result.push({ name: "Produits à réapprovisionner", domain: "operations", value: lowStockProducts, previous: null, trend: "stable", unit: "" });
    }

    // === CLIENTS === (only if customers exist)
    if ((customers || []).length > 0) {
      const activeCustomers = customers.filter((c) => c.status === "actif").length;
      const totalCustomers = customers.length;
      const churnedCustomers = customers.filter((c) => c.status === "inactif" || c.status === "perdu").length;
      const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;
      const custMonthly = monthlyAggComplete(customers, "acquisition_date", "customer_id", "count");
      const newCustomers = lastVal(custMonthly);
      const prevNewCustomers = prevVal(custMonthly);
      const totalOrderRev = (orders || []).reduce((s, o) => s + (Number(o.total) || 0), 0);
      const ltv = activeCustomers > 0 ? totalOrderRev / activeCustomers : 0;

      result.push({ name: "Clients actifs", domain: "clients", value: activeCustomers, previous: null, trend: trendDir(newCustomers, prevNewCustomers), unit: "" });
      result.push({ name: "Taux de churn", domain: "clients", value: Math.round(churnRate * 10) / 10, previous: null, trend: churnRate > 10 ? "down" : "up", unit: "%" });
      result.push({ name: "Nouveaux clients (dernier mois complet)", domain: "clients", value: newCustomers, previous: prevNewCustomers, trend: trendDir(newCustomers, prevNewCustomers), unit: "" });
      result.push({ name: "Valeur vie client (LTV)", domain: "clients", value: Math.round(ltv), previous: null, trend: trendDir(newCustomers, prevNewCustomers), unit: "$" });
    }

    return result;
  }, [transactions, orders, customers, campaigns, campaignDaily, products, inventory, cashflow]);

  // Merge: computed KPIs first, then LLM-generated ones that aren't duplicated
  const allKpis = useMemo(() => {
    const computedNames = new Set(computedKpis.map((k) => k.name.toLowerCase()));
    const llmExtras = (kpisLLM || []).filter((k) => !computedNames.has((k.name || "").toLowerCase()));
    return [...computedKpis, ...llmExtras];
  }, [computedKpis, kpisLLM]);

  const byDomain = useMemo(() => {
    const groups = {};
    allKpis.forEach((k) => {
      if (!groups[k.domain]) groups[k.domain] = [];
      groups[k.domain].push(k);
    });
    return groups;
  }, [allKpis]);

  const rtScores = useMemo(() => computeDomainScores({
    transactions, orders, customers, campaigns, campaignDaily, products, inventory, cashflow,
  }), [transactions, orders, customers, campaigns, campaignDaily, products, inventory, cashflow]);

  // Trend chart data: revenue, AOV, margin % by month.
  // The in-progress month is excluded — a partial month renders as a false cliff.
  const trendData = useMemo(() => {
    const revMonthly = monthlyAggComplete((transactions || []).filter((t) => t.type === "income"), "date", "amount");
    const expMonthly = monthlyAggComplete((transactions || []).filter((t) => t.type === "expense"), "date", "amount");
    const orderRevMonthly = monthlyAggComplete(orders || [], "date", "total");
    const orderCntMonthly = monthlyAggComplete(orders || [], "date", "total", "count");

    const months = new Set([
      ...revMonthly.map((m) => m.month),
      ...orderRevMonthly.map((m) => m.month),
    ]);
    return Array.from(months).sort().slice(-8).map((month) => {
      const rev = revMonthly.find((m) => m.month === month)?.val || 0;
      const exp = expMonthly.find((m) => m.month === month)?.val || 0;
      const oRev = orderRevMonthly.find((m) => m.month === month)?.val || 0;
      const oCnt = orderCntMonthly.find((m) => m.month === month)?.val || 0;
      const aov = oCnt > 0 ? oRev / oCnt : 0;
      const margin = rev > 0 ? ((rev - exp) / rev) * 100 : 0;
      return { month, revenue: Math.round(rev), aov: Math.round(aov), margin: Math.round(margin) };
    });
  }, [transactions, orders]);

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
        title="Aucun KPI disponible"
        description="Importez vos données pour voir vos indicateurs clés calculés automatiquement."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Indicateurs clés (KPI)</h1>
          <p className="mt-1 text-muted-foreground">Indicateurs calculés en temps réel à partir de vos données, par domaine.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportKpis} disabled={allKpis.length === 0}>
          <Download className="mr-1.5 h-4 w-4" /> Exporter CSV
        </Button>
      </div>

      {trendData.length > 0 && <KpiTrendChart data={trendData} />}

      <div>
        <h2 className="mb-1 text-lg font-semibold">Vue d'ensemble des domaines</h2>
        <p className="mb-4 text-sm text-muted-foreground">Du plus faible au plus fort · score sur 100</p>
        <DomainScoreList
          domains={Object.entries(domainLabels)
            .filter(([key]) => rtScores[key])
            .map(([key, label]) => ({
              key,
              label,
              score: rtScores[key].score,
              trend: rtScores[key].trend,
              explanation: rtScores[key].explanation,
            }))}
        />
      </div>

      {Object.entries(domainLabels).map(([domain, label]) => {
        const items = byDomain[domain];
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
      })}
    </div>
  );
}