// Memorisation des calculs sur les donnees du moteur (phase 4, performance).
//
// Tous les ecrans recoivent les MEMES tableaux (cache partage de useDonneesKpi),
// mais chacun les enveloppe dans son propre objet ({ ...donnees, company }).
// Le badge d'alertes et la vue d'ensemble recalculaient donc les memes alertes,
// la serie mensuelle etait refaite par trois modules : ~2,5 s de calcul
// bloquant sur 17 000 lignes. La cle est l'identite des TABLEAUX (pas de
// l'objet) plus un complement (reglages de l'entreprise, mois courant) :
// memes donnees -> meme resultat, calcule une fois.

import { ENTITES_KPI } from "./kpiDataset";

const CLES = [...ENTITES_KPI.map(([cle]) => cle), "observations", "payroll", "executiveSummaries"];

/**
 * @template T
 * @param {(data: Object, ...args: any[]) => T} fn
 * @param {(data: Object, ...args: any[]) => string} [complement]
 * @returns {(data: Object, ...args: any[]) => T}
 */
export function memoDonnees(fn, complement = () => "") {
  let dernier = null;
  return (data, ...args) => {
    const tableaux = CLES.map((c) => data?.[c]);
    const extra = complement(data, ...args);
    if (dernier && dernier.extra === extra && dernier.tableaux.every((t, i) => t === tableaux[i])) return dernier.valeur;
    const valeur = fn(data, ...args);
    dernier = { tableaux, extra, valeur };
    return valeur;
  };
}

const moisCourant = () => new Date().toISOString().slice(0, 7);
export const complementMois = () => moisCourant();
// Reglages de l'entreprise qui changent les alertes et les scores.
export const complementEntreprise = (data) => {
  const c = data?.company || {};
  return `${moisCourant()}|${c.id ?? ""}|${c.stock_alert_threshold ?? ""}|${c.stock_alert_use_reorder_point ?? ""}|${c.stock_dormant_months ?? ""}|${c.currency ?? ""}`;
};
