// Soldes de trésorerie par mois (page Trésorerie), sortis de la page pour être
// testés (banc Vert Québec, tests/tresorerie.test.js).
//
// Rapport du 25 sept. 2026 : 12 mois de flux importés à 100 %, mais « Trésorerie
// actuelle : 0 $ » et un graphique de 0 à 4 $. La colonne « solde_fermeture »
// n'était pas lue (lexique), et la page faisait `closing_cash || 0` sans repli.
// Désormais : solde de clôture fourni, sinon ouverture + entrées − sorties
// (ouverture = clôture du mois précédent si elle manque) ; sans aucune base,
// le solde est null (« non mesuré »), jamais 0.

import { classifyTransaction } from "./transactionClassifier";

const nombre = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * @returns {{ mois: string[], parMois: Record<string, { in: number, out: number, net: number, solde: number|null, soldeDerive: boolean }>, soldeActuel: number|null, date: string|null, derive: boolean }}
 */
export function soldesTresorerie(cashflow = [], transactions = []) {
  const parMois = {};
  const tries = [...(cashflow || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  let precedent = null;
  for (const c of tries) {
    const m = String(c.date || "").slice(0, 7);
    if (!m) continue;
    const p = (parMois[m] ||= { in: 0, out: 0, net: 0, solde: null, soldeDerive: false });
    const entree = nombre(c.cash_in) ?? 0;
    const sortie = nombre(c.cash_out) ?? 0;
    const flux = nombre(c.net_cash_flow) ?? entree - sortie;
    p.in += entree;
    p.out += sortie;
    p.net += flux;
    const cloture = nombre(c.closing_cash);
    if (cloture !== null) {
      p.solde = cloture;
      p.soldeDerive = false;
    } else {
      const ouverture = nombre(c.opening_cash) ?? precedent;
      if (ouverture !== null) {
        p.solde = ouverture + flux;
        p.soldeDerive = true;
      }
    }
    if (p.solde !== null) precedent = p.solde;
  }

  // Sans relevé de trésorerie : solde reconstitué depuis les transactions,
  // avec la même règle de sens que le reste de l'app (jamais « positif = entrée »).
  if (tries.length === 0 && (transactions || []).length > 0) {
    let courant = 0;
    const tx = [...transactions].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    for (const t of tx) {
      const m = String(t.date || "").slice(0, 7);
      if (!m) continue;
      const p = (parMois[m] ||= { in: 0, out: 0, net: 0, solde: null, soldeDerive: true });
      const sens = classifyTransaction(t);
      const montant = Math.abs(Number(t.amount) || 0);
      if (sens === "income") { p.in += montant; p.net += montant; courant += montant; }
      else if (sens === "expense") { p.out += montant; p.net -= montant; courant -= montant; }
      p.solde = courant;
      p.soldeDerive = true;
    }
  }

  const mois = Object.keys(parMois).sort();
  const dernier = mois.length ? parMois[mois[mois.length - 1]] : null;
  const derniereLigne = tries[tries.length - 1];
  return {
    mois,
    parMois,
    soldeActuel: dernier ? dernier.solde : null,
    date: derniereLigne?.date || null,
    derive: Boolean(dernier?.soldeDerive),
  };
}
