import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Brain, Upload, BarChart3, AlertTriangle, ShieldAlert, Lightbulb,
  TrendingUp, Calculator, CheckSquare, Bell, Target, FileText, MessageSquare,
  Radar as RadarIcon, History, Book, Settings, Menu, X, Sparkles, ChevronDown,
  Users, Package, Megaphone, Wallet, PanelLeftClose, PanelLeftOpen, LogOut, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/lib/AuthContext";
import LiveAlertBadge from "@/components/sidebar/LiveAlertBadge";

const navGroups = [
  {
    label: "Pilotage",
    icon: LayoutDashboard,
    items: [
      { to: "/", label: "Vue d'ensemble", icon: LayoutDashboard, end: true },
      { to: "/kpis", label: "KPI", icon: BarChart3 },
      { to: "/tresorerie", label: "Trésorerie", icon: Wallet },
      { to: "/previsions", label: "Prévisions", icon: TrendingUp },
      { to: "/simulateur", label: "Simulateur", icon: Calculator },
    ],
  },
  {
    label: "Opérations",
    icon: Users,
    items: [
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/produits", label: "Produits", icon: Package },
      { to: "/marketing", label: "Marketing", icon: Megaphone },
      { to: "/taches", label: "Tâches", icon: CheckSquare },
      { to: "/decisions", label: "Décisions", icon: Target },
    ],
  },
  {
    label: "Analyse",
    icon: Brain,
    items: [
      { to: "/insights", label: "Insights IA", icon: Brain },
      { to: "/alertes", label: "Alertes", icon: Bell },
      { to: "/risques", label: "Risques & opportunités", icon: ShieldAlert },
      { to: "/anomalies", label: "Anomalies", icon: AlertTriangle },
      { to: "/recommandations", label: "Recommandations", icon: Lightbulb },
      { to: "/historique", label: "Historique", icon: History },
      { to: "/radar", label: "Radar externe", icon: RadarIcon },
    ],
  },
  {
    label: "Outils",
    icon: FileText,
    items: [
      { to: "/importer", label: "Sources", icon: Upload },
      { to: "/audit", label: "Audit des calculs", icon: ShieldCheck },
      { to: "/rapports", label: "Rapports", icon: FileText },
      { to: "/assistant", label: "Assistant IA", icon: MessageSquare },
      { to: "/manuel", label: "Manuel", icon: Book },
      { to: "/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

export default function Sidebar({ compact, onToggleCompact }) {
  const [open, setOpen] = useState(false);
  const { company } = useCompany();
  const { user, logout } = useAuth();
  const location = useLocation();

  const activeGroup = navGroups.find((g) => g.items.some((i) => i.to === location.pathname))?.label || "Accueil";
  const [expanded, setExpanded] = useState(
    Object.fromEntries(navGroups.map((g) => [g.label, true]))
  );

  useEffect(() => {
    setExpanded((e) => ({ ...e, [activeGroup]: true }));
  }, [activeGroup]);

  const toggle = (label) => setExpanded((e) => ({ ...e, [label]: !e[label] }));

  const renderNavItem = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={() => setOpen(false)}
      title={compact ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
          compact && "justify-center px-0",
          isActive
            ? "bg-sidebar-primary/15 text-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:translate-x-0.5"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className={cn("absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary", compact ? "left-0" : "left-0")} />}
          <item.icon
            className={cn("shrink-0 transition-colors duration-200", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/80 group-hover:text-sidebar-foreground")}
            style={{ width: 17, height: 17 }}
          />
          {!compact && <span className="truncate">{item.label}</span>}
          {item.to === "/alertes" && <LiveAlertBadge compact={compact} />}
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
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300 ease-out md:translate-x-0",
          compact ? "w-16" : "w-64",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center py-5", compact ? "justify-center px-2" : "justify-between px-5")}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-blue-500 shadow-lg shadow-sidebar-primary/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            {!compact && (
              <div>
                <p className="text-base font-bold tracking-tight text-sidebar-accent-foreground">GESCOP</p>
                <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Pilotage intelligent</p>
              </div>
            )}
          </div>
          {!compact && (
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Company selector */}
        {!compact && company && (
          <div className="mx-3 mb-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{company.name}</p>
                <p className="truncate text-xs text-sidebar-foreground/70">{company.sector || "—"}</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
          {navGroups.map((group) => {
            const isExpanded = expanded[group.label] || compact;
            const isActiveGroup = activeGroup === group.label;
            return (
              <div key={group.label}>
                {!compact ? (
                  <button
                    onClick={() => toggle(group.label)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200",
                      isActiveGroup
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/55 hover:text-sidebar-foreground/90 hover:bg-sidebar-accent/40"
                    )}
                  >
                    <group.icon className="shrink-0" style={{ width: 13, height: 13 }} />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform duration-200", !isExpanded && "-rotate-90")} />
                  </button>
                ) : (
                  <div className="flex justify-center py-1">
                    <group.icon
                      className={cn("transition-colors", isActiveGroup ? "text-sidebar-primary" : "text-sidebar-foreground/55")}
                      style={{ width: 16, height: 16 }}
                    />
                  </div>
                )}
                {compact && <div className="mx-3 my-1 border-t border-sidebar-border/40" />}
                <div className={cn("overflow-hidden transition-all duration-300 ease-out", isExpanded ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0")}>
                  <div className={cn("space-y-0.5", !compact && "ml-2.5 border-l border-sidebar-border/60 pl-2.5")}>
                    {group.items.map(renderNavItem)}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border px-3 py-2">
          {!compact && user && (
            <div className="flex items-center justify-between rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-sidebar-accent-foreground">{user.full_name || user.email}</p>
                <p className="truncate text-[10px] text-sidebar-foreground/50">{user.email}</p>
              </div>
              <button
                onClick={() => logout()}
                title="Se déconnecter"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-red-500/20 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
          {compact && user && (
            <button
              onClick={() => logout()}
              title="Se déconnecter"
              className="flex w-full justify-center rounded-lg px-0 py-2 text-sidebar-foreground/70 transition-colors hover:bg-red-500/20 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Compact toggle + footer */}
        <div className="border-t border-sidebar-border px-3 py-2">
          <button
            onClick={onToggleCompact}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              compact && "justify-center px-0"
            )}
          >
            {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!compact && "Réduire la sidebar"}
          </button>
          {!compact && <p className="mt-2 px-3 text-[10px] text-sidebar-foreground/50">Données hébergées au Canada · Loi 25</p>}
        </div>
      </aside>
    </>
  );
}