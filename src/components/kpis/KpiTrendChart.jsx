import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { AXE_MOIS, AXE_MONTANT, AXE_POURCENT, GRILLE, INFOBULLE, INFOBULLE_LIGNE, BARRE, LIGNE, COULEURS, montant, pourcent } from "@/lib/graphiques";

// Trois mesures, trois echelles : trois petits panneaux a axe unique. Le
// panier moyen (~1 000 $) partageait l'axe du CA (~30 000 $) et restait
// ecrase contre zero.
const PANNEAUX = [
  { cle: "revenue", titre: "Chiffre d'affaires", forme: "barre", couleur: COULEURS.revenus, axe: AXE_MONTANT, format: montant },
  { cle: "aov", titre: "Panier moyen", forme: "ligne", couleur: COULEURS.panier, axe: AXE_MONTANT, format: montant },
  { cle: "margin", titre: "Marge nette", forme: "ligne", couleur: COULEURS.resultat, axe: AXE_POURCENT, format: (v) => pourcent(v, 0), zero: true },
];

function Panneau({ data, cle, titre, forme, couleur, axe, format, zero }) {
  const Graphique = forme === "barre" ? BarChart : LineChart;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{titre}</p>
      <ResponsiveContainer width="100%" height={200}>
        <Graphique data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRILLE} />
          <XAxis dataKey="month" {...AXE_MOIS} />
          <YAxis {...axe} />
          {zero && <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />}
          <Tooltip {...(forme === "barre" ? INFOBULLE : INFOBULLE_LIGNE)} formatter={(v) => [format(v), titre]} />
          {forme === "barre"
            ? <Bar dataKey={cle} name={titre} fill={couleur} {...BARRE} />
            : <Line dataKey={cle} name={titre} stroke={couleur} {...LIGNE} dot={{ r: 3 }} connectNulls={false} />}
        </Graphique>
      </ResponsiveContainer>
    </div>
  );
}

export default function KpiTrendChart({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-1 font-semibold">Tendance des indicateurs clés</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {data.length} derniers mois complets · marge nette = (CA − coût des ventes − dépenses − paie) ÷ CA
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PANNEAUX.map((p) => <Panneau key={p.cle} data={data} {...p} />)}
      </div>
    </div>
  );
}
