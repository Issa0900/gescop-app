import React from "react";
import { useDonneesKpi } from "@/hooks/useDonneesKpi";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import DataTable from "@/components/ui/DataTable";
import BadgeStatus from "@/components/ui/BadgeStatus";
import { formatCAD, formatNumber } from "@/lib/utils";
import { Megaphone, TrendingUp, UserPlus, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from "recharts";
import { AXE, AXE_MOIS, AXE_MONTANT, GRILLE, INFOBULLE, INFOBULLE_LIGNE, LEGENDE, BARRE, LIGNE, COULEURS, montant, libelleCode, FENETRE_MOIS } from "@/lib/graphiques";
import { columnPresent } from "@/lib/metrics";

const num = (value) => Number(value) || 0;

export default function Marketing() {
  // Cache partage (useDonneesKpi) : memes lignes que la page KPI et les
  // croisements, sans relire les sources a chaque ouverture.
  const { data: donnees, isLoading: chargement } = useDonneesKpi();
  const { campaigns, campaignDaily: daily, customers, transactions } = donnees;
  // Ad exports rarely carry a "new customers" column, but the customer file does
  // carry an acquisition date - so the figure is measurable even when it is not
  // attributable to a specific campaign.

  if (chargement) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  
  let totalSpend = (campaigns || []).reduce((s, c) => s + num(c.spend || c.budget), 0);
  let totalRevenue = (campaigns || []).reduce((s, c) => s + num(c.revenue), 0);
  const totalNew = (campaigns || []).reduce((s, c) => s + num(c.new_customers), 0);
  const totalConversions = (campaigns || []).reduce((s, c) => s + num(c.conversions), 0);
  
  // Fallback: extract marketing spend from transactions if campaign data is missing
  if (totalSpend === 0 && Array.isArray(daily) && daily.length === 0) {
    const marketingKeywords = ["marketing", "pub", "publicite", "ads", "advertising", "commercialisation"];
    (transactions || []).forEach(t => {
      const cat = (t.category || "").toLowerCase();
      const type = (t.type || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      if (marketingKeywords.some(k => cat.includes(k) || type.includes(k) || desc.includes(k))) {
        totalSpend += Math.abs(Number(t.amount) || 0);
      }
    });
  }

  // If even after fallback we have absolutely NO data (no campaigns, no marketing transactions)
  // we show the empty state.
  if ((!campaigns || campaigns.length === 0) && totalSpend === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Aucune donnée marketing"
        description="Importez vos données de campagnes ou vos dépenses marketing pour analyser le ROAS et le CAC."
      />
    );
  }

  const overallRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "-";

  // "new_customers" is often absent from ad exports. Dividing by it produced a
  // CAC of 0 $ sitting next to 623 667 $ of spend - a figure that reads as free
  // acquisition instead of missing data. Fall back to conversions, which is the
  // usual proxy, and say which one is being used. Never show 0 for "unknown".
  const cacBasis = totalNew > 0 ? "clients" : totalConversions > 0 ? "conversions" : null;
  const cacDenominator = cacBasis === "clients" ? totalNew : totalConversions;
  const overallCac = cacBasis ? Math.round(totalSpend / cacDenominator) : null;
  // Coverage of the daily records, which drive the monthly trend: campaigns
  // carry no dates in the import, so only dated daily rows can be trended.
  const dailyCampaigns = new Set((daily || []).map((d) => d.campaign_id).filter(Boolean)).size;
  // Shown only when at least one campaign actually carries a CPC, so an
  // import without it doesn't get a column full of dashes.
  const hasCpc = columnPresent(campaigns, "cpc");
  const hasDates = (campaigns || []).some((c) => c.start_date || c.end_date);

  // Acquisitions measured on the customer file. The current month is excluded:
  // it is partial and would read as a collapse in acquisition.
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const acquisitionMonths = {};
  (customers || []).forEach((c) => {
    const m = (c.acquisition_date || "").slice(0, 7);
    if (!m || m >= currentMonth) return;
    acquisitionMonths[m] = (acquisitionMonths[m] || 0) + 1;
  });
  const acquiredMonths = Object.keys(acquisitionMonths).sort();
  const acquiredTotal = acquiredMonths.reduce((s, m) => s + acquisitionMonths[m], 0);
  const lastMonth = acquiredMonths[acquiredMonths.length - 1];
  const lastMonthCount = lastMonth ? acquisitionMonths[lastMonth] : 0;
  const prevMonth = acquiredMonths[acquiredMonths.length - 2];
  const prevMonthCount = prevMonth ? acquisitionMonths[prevMonth] : 0;

  const byChannel = {};
  campaigns.forEach((c) => {
    const ch = c.channel || "Autre";
    if (!byChannel[ch]) byChannel[ch] = { spend: 0, revenue: 0, conversions: 0, new_customers: 0, impressions: 0, clicks: 0 };
    byChannel[ch].spend += num(c.spend || c.budget);
    byChannel[ch].revenue += num(c.revenue);
    byChannel[ch].conversions += num(c.conversions);
    byChannel[ch].new_customers += num(c.new_customers);
    byChannel[ch].impressions += num(c.impressions);
    byChannel[ch].clicks += num(c.clicks);
  });
  const channelData = Object.entries(byChannel).map(([ch, v]) => ({
    canal: libelleCode(ch),
    dépenses: Math.round(v.spend),
    revenus: Math.round(v.revenue),
    roas: v.spend > 0 ? Number((v.revenue / v.spend).toFixed(2)) : 0,
    // Same basis as the global card: cost per new customer when the column
    // exists, otherwise per conversion. null renders as « - », never as 0 €.
    cac: v.new_customers > 0 ? Math.round(v.spend / v.new_customers)
      : v.conversions > 0 ? Math.round(v.spend / v.conversions)
        : null,
    conversions: v.conversions,
  }));

  // Monthly trend from daily, or fallback to dated campaigns
  const byMonth = {};
  if (Array.isArray(daily) && daily.length > 0) {
    daily.forEach((d) => {
      const m = (d.date || "").slice(0, 7);
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = { spend: 0, revenue: 0 };
      byMonth[m].spend += num(d.spend);
      byMonth[m].revenue += num(d.revenue);
    });
  } else {
    (campaigns || []).forEach((c) => {
      const m = (c.start_date || c.end_date || "").slice(0, 7);
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = { spend: 0, revenue: 0 };
      byMonth[m].spend += num(c.spend || c.budget);
      byMonth[m].revenue += num(c.revenue);
    });
  }
  const trendData = Object.entries(byMonth).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-FENETRE_MOIS).map(([m, v]) => ({
    mois: m,
    dépenses: Math.round(v.spend),
    revenus: Math.round(v.revenue),
    roas: v.spend > 0 ? Number((v.revenue / v.spend).toFixed(2)) : 0,
  }));

  const campaignRows = [...campaigns].sort((a, b) => num(b.spend || b.budget) - num(a.spend || a.budget)).map((c) => {
    const spend = num(c.spend || c.budget);
    const revenue = num(c.revenue);
    const newCustomers = num(c.new_customers);
    const conversions = num(c.conversions);
    const roas = spend > 0 ? Number((revenue / spend).toFixed(1)) : null;
    const cac = newCustomers > 0 ? Math.round(spend / newCustomers)
      : conversions > 0 ? Math.round(spend / conversions)
        : null;
    return { ...c, _spend: spend, _revenue: revenue, _conversions: conversions, _roas: roas, _cac: cac };
  });

  const campaignColumns = [
    { key: "campaign_name", header: "Campagne", searchValue: (c) => c.campaign_name || "", sortValue: (c) => c.campaign_name || "", render: (c) => <span className="block max-w-[180px] truncate" title={c.campaign_name}>{c.campaign_name}</span> },
    { key: "channel", header: "Canal", render: (c) => <span className="text-muted-foreground">{libelleCode(c.channel)}</span> },
    ...(hasDates ? [{
      key: "period",
      header: "Période",
      render: (c) => (c.start_date || c.end_date ? `${c.start_date || "…"} → ${c.end_date || "…"}` : "-"),
    }] : []),
    { key: "budget", header: "Budget", align: "right", sortValue: (c) => Number(c.budget) || 0, render: (c) => formatCAD(c.budget || 0) },
    { key: "spend", header: "Dépenses", align: "right", sortValue: (c) => c._spend, render: (c) => formatCAD(c._spend) },
    { key: "revenue", header: "Revenus", align: "right", sortValue: (c) => c._revenue, render: (c) => formatCAD(c._revenue) },
    {
      key: "roas",
      header: "ROAS",
      align: "right",
      sortValue: (c) => c._roas ?? -1,
      render: (c) => c._roas === null ? "-" : (
        <span className={c._roas >= 2 ? "font-medium text-emerald-600" : c._roas < 1 ? "font-medium text-red-600" : ""}>{c._roas}</span>
      ),
    },
    { key: "cac", header: "CAC", align: "right", sortValue: (c) => c._cac ?? -1, render: (c) => c._cac === null ? "-" : formatCAD(c._cac) },
    ...(hasCpc ? [{ key: "cpc", header: "CPC", align: "right", sortValue: (c) => Number(c.cpc) || 0, render: (c) => c.cpc != null ? formatCAD(Number(c.cpc), 2) : "-" }] : []),
    { key: "conversions", header: "Conversions", align: "right", sortValue: (c) => c._conversions, render: (c) => formatNumber(c._conversions) },
    {
      key: "status",
      header: "Statut",
      sortValue: (c) => c.status || "",
      render: (c) => (
        <BadgeStatus status={c.status === "active" ? "good" : c.status === "terminee" ? "neutral" : "warning"}>{c.status || "-"}</BadgeStatus>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="mt-1 text-muted-foreground">Performance des campagnes, ROAS, CAC et efficacité par canal.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Dépenses marketing" value={`${Math.round(totalSpend).toLocaleString("fr-CA")} $`} sublabel={`${campaigns.length} campagnes importées`} icon={DollarSign} />
        <StatCard label="ROAS global (cumul des campagnes)" value={overallRoas} sublabel={`${Math.round(totalRevenue).toLocaleString("fr-CA")} $ de revenus attribués par les plateformes (≠ chiffre d'affaires)`} icon={TrendingUp} accent={totalSpend === 0 ? "bg-muted text-muted-foreground" : Number(overallRoas) >= 2 ? "bg-emerald-50 text-emerald-600" : Number(overallRoas) < 1 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"} />
        <StatCard
          label={cacBasis === "conversions" ? "Coût par conversion" : "CAC global"}
          value={overallCac !== null ? `${overallCac.toLocaleString("fr-CA")} $` : "-"}
          sublabel={cacBasis === "conversions"
            ? `${totalConversions.toLocaleString("fr-CA")} conversions · colonne « nouveaux clients » absente`
            : cacBasis === "clients"
              ? `${totalNew.toLocaleString("fr-CA")} nouveaux clients`
              : "ni nouveaux clients ni conversions dans l'import"}
          icon={UserPlus}
          accent={cacBasis ? undefined : "bg-muted text-muted-foreground"}
        />
        <StatCard
          label="Nouveaux clients"
          value={totalNew > 0
            ? totalNew.toLocaleString("fr-CA")
            : lastMonth ? lastMonthCount.toLocaleString("fr-CA") : "-"}
          sublabel={totalNew > 0
            ? `${totalNew.toLocaleString("fr-CA")} attribués aux campagnes`
            : lastMonth
              ? `en ${lastMonth} · ${acquiredTotal.toLocaleString("fr-CA")} au total${prevMonth ? ` · ${prevMonthCount} le mois précédent` : ""} - mesurés sur les dates d'acquisition, non attribués aux campagnes`
              : "aucune date d'acquisition dans les données clients"}
          icon={UserPlus}
          accent={totalNew > 0 || lastMonth
            ? (lastMonth && prevMonth && !totalNew
              ? (lastMonthCount >= prevMonthCount ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")
              : undefined)
            : "bg-muted text-muted-foreground"}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dépenses vs revenus attribués par canal</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={channelData} margin={{ left: 0, right: 10 }} barGap={2}>
            <CartesianGrid {...GRILLE} />
            <XAxis dataKey="canal" {...AXE} />
            <YAxis {...AXE_MONTANT} />
            <Tooltip {...INFOBULLE} labelFormatter={(l) => l} formatter={(v, nom) => [montant(v), nom]} />
            <Legend {...LEGENDE} />
            <Bar dataKey="dépenses" name="Dépenses" fill={COULEURS.charges} {...BARRE} />
            <Bar dataKey="revenus" name="Revenus attribués (plateformes)" fill={COULEURS.revenus} {...BARRE} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tendance du ROAS ({trendData.length} derniers mois)</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Calculé sur les relevés quotidiens ({daily.length} lignes, {dailyCampaigns} campagnes sur {campaigns.length}) - les campagnes sans date ne peuvent pas être réparties par mois.
        </p>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid {...GRILLE} />
              <XAxis dataKey="mois" {...AXE_MOIS} />
              <YAxis {...AXE} width={40} tickFormatter={(v) => `${v}×`} />
              {/* ROAS de 1 : la publicite rapporte ce qu'elle coute. */}
              <ReferenceLine y={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "rentabilité (1×)", position: "insideTopRight", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip {...INFOBULLE_LIGNE} formatter={(v) => [`${Number(v).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} ×`, "ROAS (revenus attribués ÷ dépenses)"]} />
              <Line dataKey="roas" stroke={COULEURS.ratio} {...LIGNE} dot={{ r: 3 }} name="ROAS" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune donnée quotidienne</p>
        )}
      </div>

      <DataTable
        columns={campaignColumns}
        data={campaignRows}
        rowKey={(c, i) => c.id || i}
        searchPlaceholder="Rechercher une campagne…"
        emptyIcon={Megaphone}
        emptyTitle="Aucune campagne"
      />
    </div>
  );
}