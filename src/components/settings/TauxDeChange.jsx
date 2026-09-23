import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Taux de change fournis par l'entreprise : 1 unite de la devise = X unites de
// la devise de reference. GESCOP n'invente jamais un taux : sans taux, une
// vente dans une autre devise n'entre pas dans les chiffres, et les KPI
// concernes sont signales « partiels ».
const DEVISES = ["USD", "EUR", "GBP", "AUD", "CHF", "MXN", "JPY", "CAD"];

export default function TauxDeChange({ form, setForm }) {
  const base = form.currency || "CAD";
  const taux = form.exchange_rates || {};
  const [devise, setDevise] = useState(DEVISES.find((d) => d !== base && !taux[d]) || "USD");
  const [valeur, setValeur] = useState("");

  const ajouter = () => {
    const v = Number(String(valeur).replace(",", "."));
    if (!devise || devise === base || !Number.isFinite(v) || v <= 0) return;
    setForm({ ...form, exchange_rates: { ...taux, [devise]: v } });
    setValeur("");
  };
  const retirer = (d) => {
    const suivant = { ...taux };
    delete suivant[d];
    setForm({ ...form, exchange_rates: suivant });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border p-4 sm:col-span-2">
      <div>
        <p className="text-sm font-semibold text-foreground">Taux de change</p>
        <p className="text-xs text-muted-foreground">
          Pour les fichiers de ventes en plusieurs devises : 1 unité de la devise = combien de {base}. Sans taux, les ventes dans
          une autre devise ne sont pas additionnées au chiffre d'affaires et les indicateurs sont signalés « partiels ».
        </p>
      </div>
      {Object.keys(taux).length > 0 && (
        <ul className="space-y-1 text-sm">
          {Object.entries(taux).map(([d, t]) => (
            <li key={d} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
              <span>1 {d} = {Number(t).toLocaleString("fr-CA", { maximumFractionDigits: 6 })} {base}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => retirer(d)}>Retirer</Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs" htmlFor="taux-devise">
          Devise
          <select id="taux-devise" value={devise} onChange={(e) => setDevise(e.target.value)} className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm">
            {DEVISES.filter((d) => d !== base).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-xs" htmlFor="taux-valeur">
          Taux (en {base})
          <Input id="taux-valeur" className="mt-1 h-9 w-32" inputMode="decimal" placeholder="ex. 1,37" value={valeur} onChange={(e) => setValeur(e.target.value)} />
        </label>
        <Button type="button" size="sm" onClick={ajouter}>Ajouter le taux</Button>
      </div>
    </div>
  );
}
