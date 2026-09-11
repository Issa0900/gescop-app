import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import EmptyState from "@/components/EmptyState";
import KpiCard from "@/components/kpis/KpiCard";
import KpiTrendChart from "@/components/kpis/KpiTrendChart";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/exportUtils";

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

function monthlyAgg(items, dateField, valueField, mode = "sum") {
  const map = {};
  items.forEach((it) => {
    const m = (it[dateField] || "").slice(0, 7);
    if (!m) return;
    if (!map[m]) map[m] = 0;
    const v = Number(it[valueField]) || 0;
    if (mode === "sum") map[m] += v;
    else if (mode === "count") map[m] += 1;
    else if (mode === "last") map[m] = v;
  });
  return Object.entries(map)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, val]) => ({ month, val }));
}

function trendDir(curr, prev) {
  if (curr > prev) return "up";
  if (curr < prev) return "down";
  return "stable";
}

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
      const list = await base44.entities.Inventory.list("-date", 200);
      return list || [];
    },
    staleTime: 0,
  });
  const { data: cashflow } = useQuery({
    queryKey: ["cashflow-kpi"],
    queryFn: async () => {
      const list = await base44.entities.Cashflow.list("-date", 100);
      return list || [];
    },
    staleTime: 0,
  });

  const computedKpis = useMemo(() => {
    const result = [];

    // Helper: get last N months that have data from a monthly aggregation array
    const lastMonths = (monthly, n) => monthly.slice(-n);
    const lastVal = (monthly) => (monthly.length > 0 ? monthly[monthly.length - 1].val : 0);
    const prevVal = (monthly) => (monthly.length > 1 ? monthly[monthly.length - 2].val : 0);

    // === FINANCE === (only if transactions exist)
    if ((transactions || []).length > 0) {
      const incomes = transactions.filter((t) => t.type === "income");
      const expenses = transactions.filter((t) => t.type === "expense");
      const totalIncome = incomes.reduce((s, t) => s + (t.amount || 0), 0);
      const totalExpenses = expenses.reduce((s, t) => s + (t.amount || 0), 0);
      const marginPct = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

      const revMonthly = monthlyAgg(incomes, "date", "amount");
      const expMonthly = monthlyAgg(expenses, "date", "amount");
      const currRev = lastVal(revMonthly);
      const prevRev = prevVal(revMonthly);
      const currExp = lastVal(expMonthly);
      const prevExp = prevVal(expMonthly);
      const latestCash = (cashflow || [])[0]?.closing_cash || 0;

      result.push({ name: "Revenus (dernier mois)", domain: "finance", value: Math.round(currRev), previous: Math.round(prevRev), trend: trendDir(currRev, prevRev), unit: "$" });
      result.push({ name: "Dépenses (dernier mois)", domain: "finance", value: Math.round(currExp), previous: Math.round(prevExp), trend: trendDir(currExp, prevExp), unit: "$" });
      result.push({ name: "Marge brute", domain: "finance", value: Math.round(marginPct), previous: null, trend: marginPct >= 30 ? "up" : marginPct < 10 ? "down" : "stable", unit: "%" });
      if (latestCash > 0 || (cashflow || []).length > 0) {
        result.push({ name: "Trésorerie actuelle", domain: "finance", value: Math.round(latestCash), previous: null, trend: latestCash > 0 ? "up" : "down", unit: "$" });
      }
    }

    // === VENTES === (only if orders exist)
    if ((orders || []).length > 0) {
      const orderRevMonthly = monthlyAgg(orders, "date", "total");
      const orderCntMonthly = monthlyAgg(orders, "date", "total", "count");
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

      result.push({ name: "Panier moyen", domain: "ventes", value: Math.round(currAOV), previous: Math.round(prevAOV), trend: trendDir(currAOV, prevAOV), unit: "$" });
      result.push({ name: "Commandes (dernier mois)", domain: "ventes", value: currOrders, previous: prevOrders, trend: trendDir(currOrders, prevOrders), unit: "" });
      result.push({ name: "Taux de retour", domain: "ventes", value: Math.round(returnRate * 10) / 10, previous: null, trend: returnRate > 10 ? "down" : "up", unit: "%" });
      result.push({ name: "Revenu total (commandes)", domain: "ventes", value: Math.round(totalOrderRev), previous: null, trend: "stable", unit: "$" });
    }

    // === MARKETING === (only if campaigns exist)
    if ((campaigns || []).length > 0) {
      const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0);
      const totalNewCust = campaigns.reduce((s, c) => s + (Number(c.new_customers) || 0), 0);
      const totalCampRev = campaigns.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
      const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0);
      const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0);
      const roas = totalSpend > 0 ? totalCampRev / totalSpend : 0;
      const cac = totalNewCust > 0 ? totalSpend / totalNewCust : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const convRate = totalClicks > 0 ? (totalConv / totalClicks) * 100 : 0;

      result.push({ name: "ROAS moyen", domain: "marketing", value: Math.round(roas * 10) / 10, previous: null, trend: roas >= 3 ? "up" : roas < 1 ? "down" : "stable", unit: "x" });
      result.push({ name: "CAC moyen", domain: "marketing", value: Math.round(cac), previous: null, trend: "stable", unit: "$" });
      result.push({ name: "Taux de clic (CTR)", domain: "marketing", value: Math.round(ctr * 100) / 100, previous: null, trend: "stable", unit: "%" });
      result.push({ name: "Taux de conversion", domain: "marketing", value: Math.round(convRate * 10) / 10, previous: null, trend: "stable", unit: "%" });
    }

    // === OPÉRATIONS === (only if products or inventory exist)
    if ((products || []).length > 0 || (inventory || []).length > 0) {
      const dormantStock = (inventory || []).filter((i) => i.stock_status === "dormant").length;
      const ruptureStock = (inventory || []).filter((i) => ["rupture", "proche_rupture"].includes(i.stock_status)).length;
      const avgMargin = (products || []).length > 0
        ? (products || []).reduce((s, p) => s + (Number(p.gross_margin) || 0), 0) / (products || []).length
        : 0;
      const lowStockProducts = (products || []).filter((p) => p.reorder_point && (p.inventory_level || 0) < p.reorder_point).length;

      result.push({ name: "Marge produit moyenne", domain: "operations", value: Math.round(avgMargin * 10) / 10, previous: null, trend: "stable", unit: "%" });
      result.push({ name: "Stock dormant", domain: "operations", value: dormantStock, previous: null, trend: dormantStock > 0 ? "down" : "up", unit: "" });
      result.push({ name: "Alertes rupture", domain: "operations", value: ruptureStock, previous: null, trend: ruptureStock > 0 ? "down" : "up", unit: "" });
      result.push({ name: "Produits à réapprovisionner", domain: "operations", value: lowStockProducts, previous: null, trend: "stable", unit: "" });
    }

    // === CLIENTS === (only if customers exist)
    if ((customers || []).length > 0) {
      const activeCustomers = customers.filter((c) => c.status === "actif").length;
      const totalCustomers = customers.length;
      const churnedCustomers = customers.filter((c) => c.status === "inactif" || c.status === "churn").length;
      const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;
      const custMonthly = monthlyAgg(customers, "acquisition_date", "customer_id", "count");
      const newCustomers = lastVal(custMonthly);
      const prevNewCustomers = prevVal(custMonthly);
      const totalOrderRev = (orders || []).reduce((s, o) => s + (Number(o.total) || 0), 0);
      const ltv = activeCustomers > 0 ? totalOrderRev / activeCustomers : 0;

      result.push({ name: "Clients actifs", domain: "clients", value: activeCustomers, previous: null, trend: "stable", unit: "" });
      result.push({ name: "Taux de churn", domain: "clients", value: Math.round(churnRate * 10) / 10, previous: null, trend: churnRate > 10 ? "down" : "up", unit: "%" });
      result.push({ name: "Nouveaux clients (dernier mois)", domain: "clients", value: newCustomers, previous: prevNewCustomers, trend: trendDir(newCustomers, prevNewCustomers), unit: "" });
      result.push({ name: "Valeur vie client (LTV)", domain: "clients", value: Math.round(ltv), previous: null, trend: "stable", unit: "$" });
    }

    return result;
  }, [transactions, orders, customers, campaigns, products, inventory, cashflow]);

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

  // Trend chart data: revenue, AOV, margin % by month
  const trendData = useMemo(() => {
    const revMonthly = monthlyAgg((transactions || []).filter((t) => t.type === "income"), "date", "amount");
    const expMonthly = monthlyAgg((transactions || []).filter((t) => t.type === "expense"), "date", "amount");
    const orderRevMonthly = monthlyAgg(orders || [], "date", "total");
    const orderCntMonthly = monthlyAgg(orders || [], "date", "total", "count");

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