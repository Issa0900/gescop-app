import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Brain, Upload, BarChart3, AlertTriangle, ShieldAlert, Lightbulb,
  TrendingUp, Calculator, CheckSquare, Bell, Target, FileText, MessageSquare,
  Radar as RadarIcon, History, Book, Settings, Menu, X, Sparkles, ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/hooks/useCompany";

const navGroups = [
  {
    label: "Vue d'ensemble",
    items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
      { to: "/insights", label: "Insights", icon: Brain },
    ],
  },
  {
    label: "Performance",
    items: [
      { to: "/kpis", label: "KPI", icon: BarChart3 },
      { to: "/importer", label: "Importer", icon: Upload },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/anomalies", label: "Anomalies", icon: AlertTriangle },
      { to: "/risques", label: "Risques & opportunités", icon: ShieldAlert },
      { to: "/recommandations", label: "Recommandations", icon: Lightbulb },
      { to: "/previsions", label: "Prévisions", icon: TrendingUp },
      { to: "/simulateur", label: "Simulateur", icon: Calculator },
      { to: "/historique", label: "Historique", icon: History },
    ],
  },
  {
    label: "Actions",
    items: [
      { to: "/taches", label: "Tâches", icon: CheckSquare },
      { to: "/decisions", label: "Décisions", icon: Target },
      { to: "/alertes", label: "Alertes", icon: Bell },
    ],
  },
  {
    label: "Radar",
    items: [{ to: "/radar", label: "Radar externe", icon: RadarIcon }],
  },
  {
    label: "Rapports",
    items: [{ to: "/rapports", label: "Rapports", icon: FileText }],
  },
  {
    label: "Assistant",
    items: [{ to: "/assistant", label: "Assistant IA", icon: MessageSquare }],
  },
];

const bottomItems = [
  { to: "/manuel", label: "Manuel", icon: Book },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({ "Vue d'ensemble": true, Intelligence: true, Actions: true });
  const { company } = useCompany();
  const location = useLocation();

  useEffect(() => {
    navGroups.forEach((g) => {
      if (g.items.some((i) => i.to === location.pathname)) {
        setExpanded((e) => ({ ...e, [g.label]: true }));
      }
    });
  }, [location.pathname]);

  const toggle = (label) => setExpanded((e) => ({ ...e, [label]: !e[label] }));

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card shadow-sm md:hidden">
        <Menu className="h-5 w-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar transition-transform md:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
            <div>
              <p className="text-base font-bold tracking-tight">GESCOP</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pilotage PME</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden"><X className="h-5 w-5" /></button>
        </div>

        {company && (
          <div className="mx-4 mb-2 rounded-lg bg-muted/50 px-3 py-2">
            <p className="truncate text-sm font-medium">{company.name}</p>
            <p className="truncate text-xs text-muted-foreground">{company.sector || "—"}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {navGroups.map((group) => {
            const isExpanded = expanded[group.label];
            const isActive = group.items.some((i) => i.to === location.pathname);
            return (
              <div key={group.label} className="mb-1">
                <button onClick={() => toggle(group.label)} className={cn("flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors", isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {group.label}
                </button>
                {isExpanded && (
                  <div className="ml-2 mt-0.5 space-y-0.5 border-l border-border pl-2">
                    {group.items.map((item) => (
                      <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60")}>
                        <item.icon className="shrink-0" style={{ width: 16, height: 16 }} />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border px-3 py-2">
          {bottomItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60")}>
              <item.icon className="shrink-0" style={{ width: 16, height: 16 }} />
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="border-t border-border px-6 py-3"><p className="text-[11px] text-muted-foreground">Données hébergées au Canada · Loi 25</p></div>
      </aside>
    </>
  );
}