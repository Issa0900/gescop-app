import React from "react";

const fmt = (v) => `${Math.round(Number(v) || 0).toLocaleString("fr-CA")} $`;
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/**
 * Registre des immobilisations (entite Asset) : cout d'acquisition,
 * amortissement cumule et valeur nette comptable. La valeur nette n'est
 * recalculee (cout - amortissement) que si le fichier ne la donne pas.
 */
export default function ImmobilisationsCard({ assets }) {
  const lignes = (assets || []).map((a) => {
    const cout = num(a.acquisition_cost);
    const amort = num(a.accumulated_depreciation);
    const vnc = num(a.net_book_value) ?? (cout !== null && amort !== null ? cout - amort : null);
    return { ...a, cout, amort, vnc };
  });
  if (lignes.length === 0) return null;
  const total = (k) => lignes.reduce((s, l) => s + (l[k] ?? 0), 0);
  const tries = [...lignes].sort((a, b) => (b.vnc ?? 0) - (a.vnc ?? 0)).slice(0, 8);
  const taux = (t) => {
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return `${Math.round((n <= 1 ? n * 100 : n) * 10) / 10} %`;
  };
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Immobilisations</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Coût d&apos;acquisition</p><p className="text-xl font-bold">{fmt(total("cout"))}</p></div>
        <div><p className="text-xs text-muted-foreground">Amortissement cumulé</p><p className="text-xl font-bold">{fmt(total("amort"))}</p></div>
        <div><p className="text-xs text-muted-foreground">Valeur nette comptable</p><p className="text-xl font-bold">{fmt(total("vnc"))}</p></div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Actif</th>
              <th className="py-2 pr-3">Acquis le</th>
              <th className="py-2 pr-3">Classe · taux</th>
              <th className="py-2 pr-3 text-right">Coût</th>
              <th className="py-2 text-right">Valeur nette</th>
            </tr>
          </thead>
          <tbody>
            {tries.map((a, i) => (
              <tr key={a.asset_id || i} className="border-t border-border">
                <td className="py-2 pr-3">{a.asset_name || a.asset_id}</td>
                <td className="py-2 pr-3">{a.acquisition_date || "—"}</td>
                <td className="py-2 pr-3">{[a.cca_class, a.cca_rate != null ? taux(a.cca_rate) : null].filter(Boolean).join(" · ") || "—"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{a.cout != null ? fmt(a.cout) : "—"}</td>
                <td className="py-2 text-right tabular-nums">{a.vnc != null ? fmt(a.vnc) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lignes.length > tries.length && (
          <p className="mt-2 text-xs text-muted-foreground">{lignes.length - tries.length} autre(s) actif(s) non affiché(s).</p>
        )}
      </div>
    </div>
  );
}
