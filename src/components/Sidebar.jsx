import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Brain, Upload, BarChart3, AlertTriangle, ShieldAlert, Lightbulb,
  TrendingUp, Calculator, CheckSquare, Bell, Target, FileText, MessageSquare,
  Radar as RadarIcon, History, Book, Settings, Menu, X, Sparkles, ChevronDown, ChevronRight,
  Users, Package, Megaphone, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/hooks/useCompany";

const navGroups = [
  {
    label: "Pilotage",
    items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
      { to: "/insights", label: "Insights", icon: Brain },
    ],
  },
  {
    label: "Données",
    items: [
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/produits", label: "Produits", icon: Package },
      { to: "/marketing", label: "Marketing", icon: Megaphone },
      { to: "/tresorerie", label: "Trésorerie", icon: Wallet },
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
    label: "Outils",
    items: [
      { to: "/radar", label: "Radar externe", icon: RadarIcon },
      { to: "/rapports", label: "Rapports", icon: FileText },
      { to: "/assistant", label: "Assistant IA", icon: MessageSquare },
    ],
  },
];

const bottomItems = [
  { to: "/manuel", label: "Manuel", icon: Book },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({ Pilotage: true, Données: true, Intelligence: true, Actions: true });
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

  const renderNavItem = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-primary/15 text-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:translate-x-0.5"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
          )}
          <item.icon
            className={cn(
              "shrink-0 transition-colors duration-200",
              isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
            )}
            style={{ width: 17, height: 17 }}
          />
          <span className="transition-colors duration-200">{item.label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/80 shadow-md backdrop-blur transition-transform hover:scale-105 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar-background transition-transform duration-300 ease-out md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-blue-500 shadow-lg shadow-sidebar-primary/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight text-sidebar-accent-foreground">GESCOP</p>
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Pilotage PME</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Company badge */}
        {company && (
          <div className="mx-3 mb-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{company.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/50">{company.sector || "—"}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navGroups.map((group) => {
            const isExpanded = expanded[group.label];
            const isActive = group.items.some((i) => i.to === location.pathname);
            return (
              <div key={group.label} className="mb-0.5">
                <button
                  onClick={() => toggle(group.label)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                    isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
                  )}
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !isExpanded && "-rotate-90")} />
                  {group.label}
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-out",
                    isExpanded ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="ml-2.5 space-y-0.5 border-l border-sidebar-border/60 pl-2.5">
                    {group.items.map(renderNavItem)}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-sidebar-border px-3 py-2">
          {bottomItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary/15 text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:translate-x-0.5"
                )
              }
            >
              <item.icon className="shrink-0 text-sidebar-foreground/60 group-hover:text-sidebar-foreground" style={{ width: 17, height: 17 }} />
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="border-t border-sidebar-border px-5 py-3">
          <p className="text-[10px] text-sidebar-foreground/30">Données hébergées au Canada · Loi 25</p>
        </div>
      </aside>
    </>
  );
}