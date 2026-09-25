import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Users, Banknote, Upload, PieChart, TrendingUp, Building2, UserCircle, Briefcase, Percent } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { AXE, AXE_MOIS, AXE_MONTANT, GRILLE, INFOBULLE, INFOBULLE_LIGNE, LEGENDE, BARRE_H, LIGNE, COULEURS, montant, nombre, libelleCode, plierAutres, FENETRE_MOIS } from "@/lib/graphiques";
import { motion } from "@/lib/fake-framer-motion.jsx";
import DataErrorState from "@/components/DataErrorState";
import DataTable from "@/components/ui/DataTable";
import BadgeStatus from "@/components/ui/BadgeStatus";
import { columnPresent } from "@/lib/metrics";
import { useDonneesKpi } from "@/hooks/useDonneesKpi";
import { useKpiEngine } from "@/lib/useKpiEngine";
import { notePeriodeCommune } from "@/lib/core/kpiRecords";
import { preparerPeriodes, serieMensuelle } from "@/lib/core/kpiPeriodes";

function formatCurrency(val) {
  if (val === null || val === undefined || !Number.isFinite(Number(val))) return "-";
  return `${Math.round(val).toLocaleString("fr-CA")} $`;
}

// Masse salariale, effectif, CA par employe et poids sur le CA : les KPI du
// moteur, avec le MEME chiffre d'affaires que Finance et la page KPI. La page
// divisait la paie par le seul CA des commandes (poids 559,8 % ici, 315 % pour
// le moteur) et inventait une paie a partir des taux de commission quand
// aucune paie n'etait importee.
const IDS_RH = ["payroll_total", "employee_count", "revenue_per_employee", "rh_expense_ratio", "total_revenue"];

export default function RessourcesHumaines() {
  const { data: donnees, isLoading, isError, refetch } = useDonneesKpi();
  const { kpis } = useKpiEngine(donnees, IDS_RH);

  const data = useMemo(() => ({
    employees: (donnees.employees || []).map((employee) => ({
      ...employee,
      employee_id: employee.employee_id || employee.id || employee.employee_number || employee.matricule,
      display_name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
        || employee.full_name
        || employee.name
        || employee.employee_id
        || employee.id
        || "Inconnu",
      status: employee.status || "actif",
    })),
    payrolls: donnees.payrolls || [],
  }), [donnees]);

  // Serie mensuelle du moteur : masse salariale et CA, memes definitions que
  // les cartes. Mois futurs exclus (une paie datee de decembre n'est pas
  // encore versee).
  const { timeSeries, available } = useMemo(() => {
    const serie = serieMensuelle(preparerPeriodes(donnees), ["payroll_total", "total_revenue"])
      .map((p) => ({ date: p.month, payroll_total: p.payroll_total, total_revenue: p.total_revenue }));
    return { timeSeries: serie, available: serie.some((p) => p.payroll_total != null) };
  }, [donnees]);

  const { metrics, distribution } = useMemo(() => {
    const v = (id) => { const x = kpis.get(id)?.value; return Number.isFinite(x) ? x : null; };
    const activeEmployees = data.employees.filter(e => e.status !== "depart");

    const depts = {};
    activeEmployees.forEach(e => {
      const dept = e.department || "Non assigné";
      depts[dept] = (depts[dept] || 0) + 1;
    });
    const dist = Object.keys(depts).map(name => ({ name, value: depts[name] })).sort((a,b) => b.value - a.value);

    // Sans paie importee, la remuneration annuelle portee par les fiches
    // employes est affichee COMME TELLE (libelle distinct), jamais melangee a
    // une paie versee ni recalculee a partir des commissions.
    let totalPayroll = v("payroll_total");
    let payrollSource = totalPayroll === null ? null : "paie";
    if (totalPayroll === null) {
      const annuel = data.employees.reduce((s, e) => s + (Number(e.total_employer_cost) || Number(e.annual_salary) || Number(e.salary) || 0), 0);
      if (annuel > 0) { totalPayroll = annuel; payrollSource = "fiches"; }
    }

    // Shown only when at least one employee actually carries a commission
    // rate, so a roster imported without one doesn't get a stat card of "0%".
    const withCommission = activeEmployees.filter((e) => e.commission_rate !== null && e.commission_rate !== undefined && e.commission_rate !== "");
    const avgCommission = withCommission.length > 0
      ? withCommission.reduce((s, e) => s + (Number(e.commission_rate) || 0), 0) / withCommission.length
      : null;

    return {
      metrics: {
        headcount: v("employee_count"),
        totalPayroll,
        payrollSource,
        revPerEmp: v("revenue_per_employee"),
        ratioPct: v("rh_expense_ratio"),
        ratioNote: notePeriodeCommune(kpis.get("rh_expense_ratio")),
        avgCommission,
      },
      distribution: dist,
    };
  }, [data, kpis]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
      </div>
    );
  }
  if (isError) return <DataErrorState onRetry={refetch} />;

  if (!data.employees.length && !data.payrolls.length) {
    return (
      <EmptyState
        icon={Users}
        title="Aucune donnée RH"
        description="Importez la liste de vos employés ou vos données de paie pour suivre vos effectifs et coûts salariaux."
        action={
          <Link to="/importer">
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Importer des données
            </Button>
          </Link>
        }
      />
    );
  }

  const hasCommission = columnPresent(data.employees, "commission_rate");
  const employeeColumns = [
    {
      key: "employee_id",
      header: "Collaborateur",
      searchValue: (emp) => emp.employee_id || "",
      sortValue: (emp) => emp.employee_id || "",
      render: (emp) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold shadow-sm">
            {String(emp.employee_id || "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="font-medium text-slate-900">{emp.employee_id || "Inconnu"}</div>
        </div>
      ),
    },
    {
      key: "department",
      header: "Département",
      sortValue: (emp) => emp.department || "",
      render: (emp) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          {emp.department || "-"}
        </div>
      ),
    },
    { key: "role", header: "Rôle", sortValue: (emp) => emp.role || "", render: (emp) => <span className="font-medium text-slate-700">{emp.role || "-"}</span> },
    {
      key: "employment_type",
      header: "Contrat",
      sortValue: (emp) => emp.employment_type || "",
      render: (emp) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Briefcase className="h-3.5 w-3.5 text-slate-400" />
          {emp.employment_type ? String(emp.employment_type).replace("_", " ") : "-"}
        </div>
      ),
    },
    ...(hasCommission ? [{
      key: "commission_rate",
      header: "Commission",
      align: "right",
      sortValue: (emp) => Number(emp.commission_rate) || 0,
      render: (emp) => emp.commission_rate != null ? `${(emp.commission_rate <= 1 ? emp.commission_rate * 100 : emp.commission_rate).toFixed(1)}%` : "-",
    }] : []),
    {
      key: "status",
      header: "Statut",
      align: "right",
      sortValue: (emp) => emp.status || "",
      render: (emp) => (
        <BadgeStatus status={emp.status === "actif" ? "good" : emp.status === "depart" ? "critical" : "neutral"}>
          {String(emp.status || "Actif").toUpperCase()}
        </BadgeStatus>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ressources Humaines</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Suivi de vos effectifs, de votre masse salariale et du rendement par employé. Analysez l'impact de vos ressources sur votre chiffre d'affaires.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        <StatCard
          label="Effectifs (actifs)"
          value={metrics.headcount ?? "Non mesuré"} 
          icon={Users}
          accent="bg-blue-100 text-blue-600"
        />
        <StatCard
          label={metrics.payrollSource === "fiches" ? "Rémunération annuelle (fiches employés)" : "Masse salariale (période importée)"}
          value={metrics.totalPayroll === null ? "Non mesuré" : formatCurrency(metrics.totalPayroll)}
          sublabel={metrics.payrollSource === "fiches" ? "Aucune paie importée : somme des salaires annuels déclarés" : undefined}
          icon={Banknote}
          accent="bg-rose-100 text-rose-600"
        />
        <StatCard
          label="CA par employé"
          value={metrics.revPerEmp === null ? "Non mesuré" : formatCurrency(metrics.revPerEmp)} 
          icon={TrendingUp}
          accent="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          label="Masse salariale / CA"
          value={metrics.ratioPct === null ? "Non mesuré" : `${metrics.ratioPct.toFixed(1)} %`}
          sublabel={metrics.ratioNote || undefined}
          icon={PieChart}
          accent="bg-purple-100 text-purple-600"
        />
        {metrics.avgCommission !== null && (
          <StatCard
            label="Taux de commission moyen"
            value={`${(metrics.avgCommission <= 1 ? metrics.avgCommission * 100 : metrics.avgCommission).toFixed(1)}%`}
            icon={Percent}
            accent="bg-amber-100 text-amber-600"
          />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Masse salariale et chiffre d'affaires</h3>
              <p className="text-sm text-muted-foreground">Par mois · mois futurs exclus</p>
            </div>
          </div>
          <div className="h-72">
            {available && timeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries.slice(-FENETRE_MOIS)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid {...GRILLE} />
                  <XAxis dataKey="date" {...AXE_MOIS} />
                  <YAxis {...AXE_MONTANT} />
                  <Tooltip {...INFOBULLE_LIGNE} formatter={(v, nom) => [montant(v), nom]} />
                  <Legend {...LEGENDE} />
                  <Line dataKey="total_revenue" name="Chiffre d'affaires" stroke={COULEURS.revenus} {...LIGNE} />
                  <Line dataKey="payroll_total" name="Masse salariale" stroke={COULEURS.paie} {...LIGNE} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                Pas assez de données temporelles
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Répartition par département</h3>
              <p className="text-sm text-muted-foreground">Effectifs actifs</p>
            </div>
            <Building2 className="h-5 w-5 text-slate-400" />
          </div>
          <div className="h-72">
            {distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plierAutres(distribution, "value", 8).map((d) => ({ ...d, name: libelleCode(d.name) }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid {...GRILLE} vertical horizontal={false} />
                  <XAxis type="number" {...AXE} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" {...AXE} width={120} />
                  <Tooltip {...INFOBULLE} labelFormatter={(l) => l} formatter={(v) => [nombre(v), "Employés actifs"]} />
                  <Bar dataKey="value" fill={COULEURS.effectif} {...BARRE_H} name="Employés actifs" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                Aucun département renseigné
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg">Annuaire des employés</h3>
            <p className="text-sm text-muted-foreground mt-1">Liste détaillée du personnel enregistré</p>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium shadow-sm">
            <Users className="h-4 w-4 text-slate-500" />
            <span>{data.employees.length} collaborateurs</span>
          </div>
        </div>
        <div className="p-4">
          <DataTable
            columns={employeeColumns}
            data={data.employees}
            rowKey={(emp, i) => emp.id || i}
            searchPlaceholder="Rechercher un collaborateur…"
            emptyIcon={UserCircle}
            emptyTitle="Aucun employé enregistré dans l'annuaire."
          />
        </div>
      </div>
    </motion.div>
  );
}
