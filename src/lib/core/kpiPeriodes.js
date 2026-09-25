// KPI par periode : le MEME moteur, applique a une fenetre de mois.
//
// Avant, chaque ecran recalculait « le mois », « les 3 mois » ou la serie
// mensuelle avec sa propre formule : la page KPI affichait une marge nette de
// -95 % (revenus - depenses, sans paie ni cout des ventes) quand Finance
// affichait -391 % (definition du moteur). Ici une fenetre ne change qu'une
// chose : les lignes de FLUX retenues. La formule reste celle du registre, donc
// « Marge nette (3 mois) » et « Marge nette » (total) ne peuvent plus diverger
// que par la periode.

import { buildKpiDataset } from "./kpiDataset";
import { computeKpiBatch } from "./kpiEngine";
import { moisLigne } from "./kpiRecords";

// Entites datees dont les lignes sont des flux d'une periode. Les autres
// (clients, produits, employes, campagnes recapitulatives, stock) sont des
// referentiels : ils entrent dans toutes les fenetres.
export const ENTITES_FLUX = new Set(["Transaction", "Order", "Expense", "Payroll", "CampaignDaily", "Cashflow", "ExecutiveSummary"]);

export const moisDe = moisLigne;

const cleMois = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function decalerMois(mois, n) {
  const [a, m] = mois.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/**
 * Prepare une fois le jeu de donnees (memes entites que useKpiEngine) et range
 * les lignes de flux par mois.
 */
export function preparerPeriodes(data, { aujourdhui = new Date() } = {}) {
  const { records, semantics } = buildKpiDataset(data);
  if (data?.observations) for (const o of data.observations) records.push(o);
  const referentiels = [];
  const parMois = new Map();
  const sansDate = [];
  for (const r of records) {
    if (!ENTITES_FLUX.has(r._entity)) { referentiels.push(r); continue; }
    const m = moisDe(r);
    if (!m) { sansDate.push(r); continue; }
    if (!parMois.has(m)) parMois.set(m, []);
    parMois.get(m).push(r);
  }
  return { records, semantics, referentiels, parMois, sansDate, moisCourant: cleMois(aujourdhui) };
}

/**
 * Mois complets disponibles, du plus ancien au plus recent. Le mois en cours
 * est partiel et un mois futur n'est pas realise : ni l'un ni l'autre ne sert
 * de « dernier mois ». Exception reprise de monthlyAggComplete : si l'historique
 * n'a pas 3 mois complets, le mois en cours est garde plutot que de ne rien
 * pouvoir analyser.
 */
export function moisComplets(prep) {
  const tous = [...prep.parMois.keys()].filter((m) => m <= prep.moisCourant).sort();
  const complets = tous.filter((m) => m !== prep.moisCourant);
  return complets.length >= 3 ? complets : tous;
}

/** Lignes d'une fenetre [debut, fin] (mois inclus) + tous les referentiels. */
export function lignesFenetre(prep, debut, fin) {
  const out = [...prep.referentiels];
  for (const [m, lignes] of prep.parMois) {
    if (m >= debut && m <= fin) for (const r of lignes) out.push(r);
  }
  // Tri chronologique : les agregations LAST (solde de tresorerie) prennent
  // la derniere valeur de la fenetre.
  const d = (r) => String(r.date ?? r.period ?? "");
  out.sort((a, b) => (d(a) < d(b) ? -1 : d(a) > d(b) ? 1 : 0));
  return out;
}

export function kpisSurFenetre(prep, ids, debut, fin) {
  return computeKpiBatch(ids, lignesFenetre(prep, debut, fin), prep.semantics);
}

export function kpisTotal(prep, ids) {
  return computeKpiBatch(ids, prep.records, prep.semantics);
}

/**
 * Les fenetres affichees partout : dernier mois complet, mois precedent,
 * 3 derniers mois complets, 3 mois precedents, et le total. Chaque entree est
 * la Map du moteur (valeur, statut, sources) ; `null` si la fenetre n'a pas
 * d'historique (pas de « mois precedent » invente).
 */
export function kpisParFenetre(prep, ids) {
  const mois = moisComplets(prep);
  const total = kpisTotal(prep, ids);
  if (mois.length === 0) return { total, mois: null, moisPrec: null, trim: null, trimPrec: null, dernierMois: null };
  const dernier = mois[mois.length - 1];
  const precedent = decalerMois(dernier, -1);
  const aDesDonnees = (debut, fin) => mois.some((m) => m >= debut && m <= fin);
  const fen = (debut, fin) => (aDesDonnees(debut, fin) ? kpisSurFenetre(prep, ids, debut, fin) : null);
  return {
    total,
    dernierMois: dernier,
    mois: fen(dernier, dernier),
    moisPrec: fen(precedent, precedent),
    // 3 mois complets seulement si l'historique les contient.
    trim: mois.length >= 3 ? fen(decalerMois(dernier, -2), dernier) : null,
    trimPrec: mois.length >= 6 ? fen(decalerMois(dernier, -5), decalerMois(dernier, -3)) : null,
  };
}

/**
 * Serie mensuelle continue (mois sans ligne = valeurs du moteur sur une
 * fenetre vide, donc non mesurees -> null), du premier au dernier mois complet.
 */
export function serieMensuelle(prep, ids) {
  const mois = moisComplets(prep);
  if (mois.length === 0) return [];
  const out = [];
  for (let m = mois[0]; m <= mois[mois.length - 1]; m = decalerMois(m, 1)) {
    const res = kpisSurFenetre(prep, ids, m, m);
    const point = { month: m };
    for (const id of ids) {
      const v = res.get(id)?.value;
      point[id] = Number.isFinite(v) ? v : null;
    }
    out.push(point);
  }
  return out;
}
