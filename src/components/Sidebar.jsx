import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  AlertTriangle,
  ShieldAlert,
  Lightbulb,
  Radar as RadarIcon,
  CheckSquare,
  Bell,
  FileText,
  MessageSquare,
  Book,
  Settings,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/hooks/useCompany";

const navItems = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/importer", label: "Importer", icon: Upload },
  { to: "/kpis", label: "KPI", icon: BarChart3 },
  { to: "/anomalies", label: "Anomalies", icon: AlertTriangle },
  { to: "/risques", label: "Risques & opportunités", icon: ShieldAlert },
  { to: "/recommandations", label: "Recommandations", icon: Lightbulb },
  { to: "/radar", label: "Radar externe", icon: RadarIcon },
  { to: "/taches", label: "Tâches", icon: CheckSquare },
  { to: "/alertes", label: "Alertes", icon: Bell },
  { to: "/rapports", label: "Rapports", icon: FileText },
  { to: "/assistant", label: "Assistant IA", icon: MessageSquare },
  { to: "/manuel", label: "Manuel", icon: Book },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const { company } = useCompany();

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card shadow-sm md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">GESCOP</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Pilotage PME
              </p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {company && (
          <div className="mx-4 mb-2 rounded-lg bg-muted/50 px-3 py-2">
            <p className="truncate text-sm font-medium">{company.name}</p>
            <p className="truncate text-xs text-muted-foreground">{company.sector || "—"}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                )
              }
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border px-6 py-4">
          <p className="text-[11px] text-muted-foreground">
            Données hébergées au Canada · Loi 25
          </p>
        </div>
      </aside>
    </>
  );
}