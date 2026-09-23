import React, { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { montantHT, commandeHorsCA } from "@/lib/core/kpiRecords";
import { currentMonthKey } from "@/lib/periods";
import { AXE, AXE_MOIS, AXE_MONTANT, GRILLE, INFOBULLE_LIGNE, LIGNE, COULEURS, montant, nombre, FENETRE_MOIS } from "@/lib/graphiques";

export default function ProductSalesTrend({ orders }) {
  const data = useMemo(() => {
    // Mois en cours (partiel) et mois futurs (non realises) exclus, et memes
    // regles que le CA du moteur : commandes annulees/retournees hors ventes.
    const cm = currentMonthKey();
    const map = {};
    (orders || []).forEach((o) => {
      const m = (o.date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(m) || m >= cm || commandeHorsCA(o)) return;
      if (!map[m]) map[m] = { month: m, quantite: 0, revenu: 0 };
      map[m].quantite += Number(o.quantity) || 0;
      map[m].revenu += Number.isFinite(montantHT(o)) ? montantHT(o) : 0;
    });
    return Object.values(map)
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .slice(-FENETRE_MOIS);
  }, [orders]);

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Aucune donnée de vente
      </div>
    );
  }

  // Quantité et revenu vivent sur des échelles différentes (unités vs $) :
  // deux petits multiples côte à côte, un axe chacun.
  const panneaux = [
    { cle: "quantite", titre: "Quantité vendue", couleur: COULEURS.volume, axe: { ...AXE, tickFormatter: nombre, width: 48 }, format: (v) => `${nombre(v)} unités` },
    { cle: "revenu", titre: "CA commandes (HT)", couleur: COULEURS.revenus, axe: AXE_MONTANT, format: montant },
  ];
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {panneaux.map((p) => (
        <div key={p.cle}>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{p.titre} · {data.length} derniers mois complets</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid {...GRILLE} />
              <XAxis dataKey="month" {...AXE_MOIS} />
              <YAxis {...p.axe} />
              <Tooltip {...INFOBULLE_LIGNE} formatter={(v) => [p.format(v), p.titre]} />
              <Area dataKey={p.cle} name={p.titre} stroke={p.couleur} fill={p.couleur} fillOpacity={0.12} {...LIGNE} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
