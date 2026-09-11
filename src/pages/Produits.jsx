import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import ProductSalesTrend from "@/components/produits/ProductSalesTrend";
import { latestByKey } from "@/lib/periods";
import { Package, AlertTriangle, Boxes, DollarSign } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const stockColors = {
  optimal: "#10b981",
  rupture: "#ef4444",
  surstock: "#f59e0b",
  dormant: "#94a3b8",
  faible: "#f97316",
  proche_rupture: "#dc2626",
};

const stockLabels = {
  optimal: "Optimal",
  rupture: "Rupture",
  surstock: "Surstock",
  dormant: "Dormant",
  faible: "Faible",
  proche_rupture: "Proche rupture",
};

const monthLabels = {
  "01": "jan", "02": "fév", "03": "mar", "04": "avr",
  "05": "mai", "06": "jun", "07": "jul", "08": "aoû",
  "09": "sep", "10": "oct", "11": "nov", "12": "déc",
};

function formatMonthLabel(m) {
  const [, mm] = (m || "").split("-");
  return monthLabels[mm] || m;
}

export default function Produits() {
  const { data: products, isLoading: lp } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await base44.entities.Product.list()) || [],
  });
  const { data: inventory, isLoading: li } = useQuery({
    queryKey: ["inventory-summary"],
    queryFn: async () => (await base44.entities.Inventory.list("-date", 500)) || [],
  });
  const { data: orders, isLoading: lo } = useQuery({
    queryKey: ["orders-produits"],
    queryFn: async () => (await base44.entities.Order.list("-date", 500)) || [],
  });

  if (lp || li || lo) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!products || products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Aucun produit"
        description="Importez vos données produits et inventaire pour voir la performance et le statut des stocks."
      />
    );
  }

  const total = products.length;
  const lowMargin = products.filter((p) => (p.gross_margin || 0) < 15);

  // Inventory arrives as one row per product per date. Counting every historical
  // row multiplies each situation by its number of recorded days, so all stock
  // figures use the most recent snapshot per product.
  const latestInv = latestByKey(inventory || [], "product_id", "date");
  const invByProduct = {};
  latestInv.forEach((i) => { invByProduct[i.product_id] = i; });
  const stockOf = (p) => {
    const snap = invByProduct[p.product_id];
    return snap && snap.closing_stock != null ? Number(snap.closing_stock) : Number(p.inventory_level) || 0;
  };
  const dormantCount = latestInv.filter((i) => i.stock_status === "dormant").length;
  const nearRupture = products.filter((p) => p.reorder_point > 0 && stockOf(p) <= (p.reorder_point || 0));

  // Compute actual sales per product from orders (most recent month)
  const orderMonths = (orders || []).map((o) => (o.date || "").slice(0, 7)).filter(Boolean).sort();
  const latestMonth = orderMonths.length > 0 ? orderMonths[orderMonths.length - 1] : null;
  const salesByProduct = {};
  const totalSalesByProduct = {};
  const totalRevByProduct = {};
  (orders || []).forEach((o) => {
    const m = (o.date || "").slice(0, 7);
    const pid = o.product_id;
    if (!pid) return;
    const qty = Number(o.quantity) || 0;
    const rev = Number(o.total) || 0;
    totalSalesByProduct[pid] = (totalSalesByProduct[pid] || 0) + qty;
    totalRevByProduct[pid] = (totalRevByProduct[pid] || 0) + rev;
    if (latestMonth && m !== latestMonth) return;
    salesByProduct[pid] = (salesByProduct[pid] || 0) + qty;
  });
  const topBySales = [...products]
    .map((p) => ({
      ...p,
      _recentSales: salesByProduct[p.product_id] || (latestMonth ? 0 : (p.monthly_sales || 0)),
    }))
    .sort((a, b) => (b._recentSales || 0) - (a._recentSales || 0))
    .slice(0, 10);
  const topBarData = topBySales.map((p) => ({
    name: (p.product_name || p.product_id || "").slice(0, 20),
    ventes: p._recentSales || 0,
    marge: Math.round(p.gross_margin || 0),
  }));

  const stockDist = {};
  latestInv.forEach((i) => {
    const s = i.stock_status || "non_precise";
    stockDist[s] = (stockDist[s] || 0) + 1;
  });
  const pieData = Object.entries(stockDist).map(([s, v]) => ({
    name: stockLabels[s] || s,
    value: v,
    key: s,
  }));
  const inventoryValue = latestInv.reduce((s, i) => s + (Number(i.inventory_value) || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Produits & Inventaire</h1>
        <p className="mt-1 text-muted-foreground">Performance produits, marges, rotation de stock et alertes d'inventaire.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total produits" value={total.toLocaleString()} icon={Package} />
        <StatCard label="Faible marge (<15%)" value={lowMargin.length} icon={DollarSign} accent={lowMargin.length > 0 ? "bg-amber-50 text-amber-600" : "bg-muted text-muted-foreground"} />
        <StatCard label="Stock dormant" value={dormantCount} icon={Boxes} accent={dormantCount > 0 ? "bg-amber-50 text-amber-600" : "bg-muted text-muted-foreground"} />
        <StatCard label="Proches rupture" value={nearRupture.length} icon={AlertTriangle} accent={nearRupture.length > 0 ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Évolution des ventes par mois</h2>
        <p className="mb-4 text-xs text-muted-foreground">Quantité vendue (axe gauche) — revenu $ (axe droit) · 12 derniers mois</p>
        <ProductSalesTrend orders={orders} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top 10 produits {latestMonth ? `(${formatMonthLabel(latestMonth)})` : "(ventes/mois)"}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topBarData} margin={{ left: 10, right: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="ventes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Statut des stocks</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.name}: ${e.value}`}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={stockColors[entry.key] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune donnée d'inventaire</p>
          )}
          {inventoryValue > 0 && (
            <p className="mt-2 text-center text-sm text-muted-foreground">Valeur inventaire total: <span className="font-semibold text-foreground">{Math.round(inventoryValue).toLocaleString()} $</span></p>
          )}
        </div>
      </div>

      {nearRupture.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/30 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-semibold text-red-900">Produits proches de la rupture</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {nearRupture.slice(0, 12).map((p) => (
              <div key={p.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <p className="font-medium truncate">{p.product_name || p.product_id}</p>
                <p className="text-xs text-muted-foreground">Stock: {stockOf(p)} · Seuil: {p.reorder_point}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Produit</th>
              <th className="px-4 py-3 font-medium">Catégorie</th>
              <th className="px-4 py-3 font-medium">Coût</th>
              <th className="px-4 py-3 font-medium">Prix vente</th>
              <th className="px-4 py-3 font-medium">Marge</th>
              <th className="px-4 py-3 font-medium">Unités vendues</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...products].map((p) => ({
              ...p,
              _totalSales: totalSalesByProduct[p.product_id] || 0,
              _totalRev: totalRevByProduct[p.product_id] || 0,
            })).sort((a, b) => (b._totalSales || 0) - (a._totalSales || 0)).slice(0, 30).map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="max-w-[180px] truncate px-4 py-3 font-medium" title={p.product_name}>{p.product_name || p.product_id}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.category || "—"}</td>
                <td className="px-4 py-3">{Math.round(p.purchase_cost || 0)} $</td>
                <td className="px-4 py-3">{Math.round(p.selling_price || 0)} $</td>
                <td className="px-4 py-3">
                  <span className={(p.gross_margin || 0) < 15 ? "text-red-600 font-medium" : ""}>{Math.round(p.gross_margin || 0)}%</span>
                </td>
                <td className="px-4 py-3">{p._totalSales}</td>
                <td className="px-4 py-3">{stockOf(p)}</td>
                <td className="px-4 py-3">
                  {/* Real stock state from the latest inventory snapshot, falling
                      back to the imported product status when none exists. */}
                  {(() => {
                    const st = invByProduct[p.product_id]?.stock_status || p.status;
                    const cls = ["rupture", "proche_rupture"].includes(st)
                      ? "text-red-600"
                      : ["faible", "surstock", "dormant"].includes(st)
                        ? "text-amber-600"
                        : st === "optimal" || st === "actif"
                          ? "text-emerald-600"
                          : "text-muted-foreground";
                    return <span className={cls}>{stockLabels[st] || st || "—"}</span>;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}