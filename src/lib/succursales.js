// P&L par succursale (page Succursales), sorti de la page pour être testé
// (banc Vert Québec, tests/succursales.test.js).
//
// Rapport du 25 sept. 2026 :
//  - les transactions n'étaient pas comptées (la page ne lisait que les
//    commandes) : 105 573 $ sur 113 919 $ restaient « Non assigné » ;
//  - « Québec (siège) » devenait « siège » (on gardait la partie entre
//    parenthèses) et « Siège social » restait un autre groupe ;
//  - « Toutes succursales » était traité comme une succursale.

import { montantHT, commandeHorsCA, transactionsDejaCommandees } from "./core/kpiRecords";
import { isIncome } from "./transactionClassifier";

export const NON_ASSIGNE = "Non assigné";
export const COMMUN = "Commun à toutes les succursales";

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9()]+/g, " ").trim();
const SIEGE = new Set(["siege", "siege social", "bureau chef", "head office", "hq", "quartier general"]);
const TOUTES = new Set(["toutes succursales", "toutes les succursales", "tous", "toutes", "all branches", "all locations", "global", "entreprise"]);

/**
 * Clé de regroupement d'un libellé de succursale. `seuls` = libellés
 * normalisés utilisés seuls ailleurs : « Québec (Sainte-Foy) » rejoint
 * « Sainte-Foy » si ce nom existe seul (fichier RH vs ventes).
 */
export function cleSuccursale(libelle, seuls = new Set()) {
  const n = norm(libelle);
  if (!n) return "__non_assigne__";
  if (TOUTES.has(n)) return "__commun__";
  const m = n.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const dehors = m ? m[1].trim() : n;
  const dedans = m ? m[2].trim() : "";
  if (SIEGE.has(n) || SIEGE.has(dedans) || SIEGE.has(dehors)) return "__siege__";
  if (dedans && seuls.has(dedans)) return dedans;
  return n.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * @param {{ orders?: any[], transactions?: any[], employees?: any[], assets?: any[], summaryRows?: any[] }} d
 */
export function calculerSuccursales({ orders = [], transactions = [], employees = [], assets = [], summaryRows = [] } = {}) {
  const libelleVente = (o) => o.location_id || o.succursale || o.store || o.location;
  const libelleTx = (t) => t.branch || t.succursale || t.location;
  const libelleRh = (e) => e.branch || e.location || e.succursale;
  const libelleActif = (a) => a.location_id || a.succursale || a.location;

  // Libellés utilisés seuls (sans parenthèses) : cibles possibles d'un « Ville (Nom) ».
  const tous = [
    ...orders.map(libelleVente), ...transactions.map(libelleTx), ...employees.map(libelleRh),
    ...assets.map(libelleActif), ...summaryRows.map((s) => s.location_id || s.succursale || s.store),
  ].filter(Boolean);
  const seuls = new Set(tous.map(norm).filter((n) => n && !/\(/.test(n)));

  const groupes = {};
  const vus = {};
  const groupe = (libelle) => {
    const cle = cleSuccursale(libelle, seuls);
    if (!groupes[cle]) groupes[cle] = { cle, name: "", revenue: 0, cogs: 0, employerCost: 0, depreciation: 0 };
    // Nom affiché : le libellé le plus fréquent du groupe (« Québec (siège) »).
    if (libelle) ((vus[cle] ||= {})[String(libelle).trim()] = ((vus[cle] || {})[String(libelle).trim()] || 0) + 1);
    return groupes[cle];
  };

  const coutDe = (o) => {
    const c = o.total_cost ?? o.cost;
    return c === null || c === undefined || c === "" ? null : Number(c);
  };
  const ventes = orders.filter((o) => !commandeHorsCA(o));
  let coutsConnus = ventes.some((o) => Number.isFinite(coutDe(o)));
  for (const o of ventes) {
    const g = groupe(libelleVente(o));
    const rev = montantHT(o);
    if (Number.isFinite(rev)) g.revenue += rev;
    const c = coutDe(o);
    if (Number.isFinite(c)) g.cogs += c;
  }

  // Ventes des transactions, sauf celles qui encaissent une commande déjà comptée.
  const records = [...orders.map((o) => ({ ...o, _entity: "Order" })), ...transactions.map((t) => ({ ...t, _entity: "Transaction" }))];
  const dejaComptees = new Set([...transactionsDejaCommandees(records)].map((r) => r.id ?? r));
  const recettes = transactions.filter((t) => isIncome(t) && !dejaComptees.has(t.id ?? t));
  for (const t of recettes) {
    const g = groupe(libelleTx(t));
    const m = Math.abs(Number(t.amount));
    if (Number.isFinite(m)) g.revenue += m;
  }
  // Des revenus sans coût de vente : la marge brute n'est pas mesurable.
  if (recettes.length > 0) coutsConnus = false;

  if (ventes.length === 0 && recettes.length === 0 && summaryRows.length > 0) {
    coutsConnus = summaryRows.some((s) => Number.isFinite(Number(s.total_cost ?? s.cost)));
    for (const s of summaryRows) {
      const g = groupe(s.location_id || s.succursale || s.store);
      g.revenue += Number(s.total_revenue) || Number(s.total) || 0;
      g.cogs += Number(s.total_cost) || Number(s.cost) || 0;
    }
  }

  // Le DEPARTEMENT n'est jamais une succursale : pas de repli sur lui.
  for (const e of employees) groupe(libelleRh(e)).employerCost += Number(e.total_employer_cost) || 0;
  for (const a of assets) groupe(libelleActif(a)).depreciation += Number(a.net_book_value || 0) * Number(a.dpa_rate || 0);

  const locations = Object.values(groupes).map((g) => {
    const noms = Object.entries(vus[g.cle] || {}).sort((a, b) => b[1] - a[1]);
    const name = g.cle === "__non_assigne__" ? NON_ASSIGNE : g.cle === "__commun__" ? COMMUN : (noms[0]?.[0] || g.cle);
    const grossProfit = coutsConnus ? g.revenue - g.cogs : null;
    const ebitda = grossProfit === null ? null : grossProfit - g.employerCost;
    const ebit = ebitda === null ? null : ebitda - g.depreciation;
    const marginPct = ebit !== null && g.revenue > 0 ? (ebit / g.revenue) * 100 : null;
    return { ...g, name, grossProfit, ebitda, ebit, marginPct };
  }).sort((a, b) => (b.ebit ?? b.revenue) - (a.ebit ?? a.revenue));

  const somme = (cle) => (locations.some((l) => l[cle] === null) ? null : locations.reduce((s, l) => s + l[cle], 0));
  const totalRev = somme("revenue");
  const totalEbit = somme("ebit");
  return {
    locations,
    coutsConnus,
    nbSuccursales: locations.filter((l) => l.cle !== "__non_assigne__" && l.cle !== "__commun__").length,
    totalRev,
    totalGrossProfit: somme("grossProfit"),
    totalEmployerCost: somme("employerCost"),
    totalDepreciation: somme("depreciation"),
    totalEbitda: somme("ebitda"),
    totalEbit,
    weightedMarginPct: totalEbit !== null && totalRev > 0 ? (totalEbit / totalRev) * 100 : null,
  };
}
