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
import { moisLigne, dateLigne } from "./kpiRecords";

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

/** Dernier jour (AAAA-MM-JJ) d'un mois AAAA-MM. */
export const finDeMois = (mois) => {
  const [a, m] = mois.split("-").map(Number);
  return `${mois}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/**
 * Lignes d'une periode [debut, fin] en DATES (AAAA-MM-JJ, bornes incluses) +
 * tous les referentiels. Une ligne datee au jour y entre si son jour est dans
 * la periode ; une ligne mensuelle (paie « 2026-08 ») seulement si la periode
 * couvre tout son mois : elle ne se repartit pas sur une journee ou une semaine.
 */
export function lignesEntreDates(prep, debut, fin) {
  const out = [...prep.referentiels];
  for (const lignes of prep.parMois.values()) {
    for (const r of lignes) {
      const d = dateLigne(r);
      if (!d) continue;
      if (d.jour ? d.jour >= debut && d.jour <= fin : `${d.mois}-01` >= debut && finDeMois(d.mois) <= fin) out.push(r);
    }
  }
  const cle = (r) => { const d = dateLigne(r); return d?.jour ?? (d ? finDeMois(d.mois) : ""); };
  out.sort((a, b) => (cle(a) < cle(b) ? -1 : cle(a) > cle(b) ? 1 : 0));
  return out;
}

export function kpisEntreDates(prep, ids, debut, fin) {
  return computeKpiBatch(ids, lignesEntreDates(prep, debut, fin), prep.semantics);
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

// ─────────────────────────────────────────────────────────────────────────────
// NOUVEAU MOTEUR TEMPOREL UNIVERSEL (Phase 1 : Fonctions Pures SSOT)
// Distinction stricte Flux (P&L sur [T_début, T_fin]) vs Soldes/Stocks (Bilan <= T_fin)
// ─────────────────────────────────────────────────────────────────────────────

const NOMS_MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export const moisLisible = (mois) => {
  if (!mois || !mois.includes("-")) return mois || "";
  const [a, m] = mois.split("-").map(Number);
  const nom = NOMS_MOIS_FR[m - 1] || mois;
  return `${nom} ${a}`;
};

/**
 * Décalage d'années (YoY / N-1) : gère AAAA-MM-JJ et AAAA-MM,
 * avec prise en charge propre du 29 février (ramené au 28 février les années non bissextiles).
 */
export function decalerAn(dateStr, n) {
  if (!dateStr || typeof dateStr !== "string") return dateStr;
  const parts = dateStr.split("-");
  const a = Number(parts[0]) + n;
  if (parts.length === 2) {
    return `${a}-${parts[1]}`;
  }
  if (parts.length === 3) {
    const m = Number(parts[1]);
    const j = Number(parts[2]);
    if (m === 2 && j === 29) {
      const estBissextile = (a % 4 === 0 && a % 100 !== 0) || (a % 400 === 0);
      return `${a}-02-${estBissextile ? "29" : "28"}`;
    }
    return `${a}-${parts[1]}-${parts[2]}`;
  }
  return dateStr;
}

/**
 * Calcule les bornes de la période comparative selon le mode :
 * - "YoY" (Year-over-Year) : même période exacte à N-1 (neutralise la saisonnalité).
 * - "MoM" (Month-over-Month) : mois précédent (ou intervalle précédent équivalent).
 */
export function calculerBornesComparatives(startDate, endDate, compareType = "MoM") {
  if (!startDate || !endDate) return { compareStartDate: null, compareEndDate: null };

  if (compareType === "YoY") {
    return {
      compareStartDate: decalerAn(startDate, -1),
      compareEndDate: decalerAn(endDate, -1),
    };
  }

  // MoM
  const [y1, m1, d1] = startDate.split("-").map(Number);
  const [y2, m2] = endDate.split("-").map(Number);
  const mois1 = startDate.slice(0, 7);
  const mois2 = endDate.slice(0, 7);
  const estMoisComplet = d1 === 1 && endDate === finDeMois(mois2);

  if (estMoisComplet) {
    const spanMonths = (y2 - y1) * 12 + (m2 - m1) + 1;
    const prevFinMois = decalerMois(mois1, -1);
    const prevDebutMois = decalerMois(prevFinMois, -(spanMonths - 1));
    return {
      compareStartDate: `${prevDebutMois}-01`,
      compareEndDate: finDeMois(prevFinMois),
    };
  }

  // Intervalle arbitraire en jours : décalage exact de la durée en millisecondes
  const t1 = new Date(`${startDate}T00:00:00Z`).getTime();
  const t2 = new Date(`${endDate}T00:00:00Z`).getTime();
  const diffJours = Math.max(1, Math.round((t2 - t1) / 86400000) + 1);
  const prevEnd = new Date(t1 - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (diffJours - 1) * 86400000);

  const fmt = (d) => d.toISOString().slice(0, 10);
  return {
    compareStartDate: fmt(prevStart),
    compareEndDate: fmt(prevEnd),
  };
}

/**
 * Entités de flux strict (P&L / Activité) : filtrées sur [startDate, endDate].
 */
const FLUX_STRICT = new Set(["Transaction", "Order", "Expense", "Payroll", "CampaignDaily", "ExecutiveSummary"]);

/**
 * Lignes pour une période selon la règle d'or :
 * 1. Flux P&L (ventes, charges, paie) : intervalle strict [startDate, endDate].
 * 2. Soldes & Stocks (Bilan : Cashflow, Inventory) : relevés à date d'arrêt (<= endDate).
 * 3. Référentiels (Clients, Employés, Produits, Fournisseurs) : conservés pour calculs de ratios.
 */
export function lignesPourFiltre(prep, startDate, endDate) {
  const out = [];

  // 1. Référentiels purs (hors flux et hors inventaire)
  for (const r of prep.referentiels) {
    if (r._entity === "Inventory") {
      // Pour l'inventaire, ne retenir que les relevés jusqu'à la date d'arrêt
      const d = r.date || r.reference_date || "";
      if (!d || d <= endDate) out.push(r);
    } else {
      out.push(r);
    }
  }

  // 2. Flux et relevés de trésorerie
  for (const lignes of prep.parMois.values()) {
    for (const r of lignes) {
      if (r._entity === "Cashflow") {
        // Trésorerie (Bilan / Snapshot) : relevés jusqu'à la date d'arrêt
        const d = dateLigne(r);
        const jour = d?.jour ?? (d ? finDeMois(d.mois) : "");
        if (!jour || jour <= endDate) out.push(r);
      } else if (FLUX_STRICT.has(r._entity)) {
        // Flux P&L : appartenance stricte à l'intervalle [startDate, endDate]
        const d = dateLigne(r);
        if (!d) continue;
        if (d.jour) {
          if (d.jour >= startDate && d.jour <= endDate) out.push(r);
        } else if (d.mois) {
          if (`${d.mois}-01` >= startDate && finDeMois(d.mois) <= endDate) out.push(r);
        }
      } else {
        out.push(r);
      }
    }
  }

  // Tri chronologique : garantit que toute agrégation LAST (solde) prend la valeur la plus proche de endDate
  const cle = (r) => { const d = dateLigne(r); return d?.jour ?? (d ? finDeMois(d.mois) : (r.date || r.reference_date || "")); };
  out.sort((a, b) => (cle(a) < cle(b) ? -1 : cle(a) > cle(b) ? 1 : 0));
  return out;
}

/**
 * Construit un objet PeriodFilter complet avec presets rapides et comparaison.
 */
export function construireFiltrePeriode({
  prep,
  preset = "CLOSED_MONTH",
  compareType = "MoM",
  customStart = null,
  customEnd = null,
  moisCible = null,
} = {}) {
  const moisDispo = prep ? moisComplets(prep) : [];
  const anchorMonth = moisCible || (moisDispo.length > 0 ? moisDispo[moisDispo.length - 1] : cleMois(new Date()));
  const [anchorYear, anchorM] = anchorMonth.split("-").map(Number);

  let startDate = `${anchorMonth}-01`;
  let endDate = finDeMois(anchorMonth);
  let isOngoing = false;
  let label = moisLisible(anchorMonth);

  if (preset === "MTD") {
    const currentM = prep?.moisCourant || cleMois(new Date());
    startDate = `${currentM}-01`;
    endDate = finDeMois(currentM);
    isOngoing = true;
    label = `${moisLisible(currentM)} (en cours)`;
  } else if (preset === "QTD") {
    const qNum = Math.floor((anchorM - 1) / 3) + 1;
    const startM = String((qNum - 1) * 3 + 1).padStart(2, "0");
    const endM = String(qNum * 3).padStart(2, "0");
    startDate = `${anchorYear}-${startM}-01`;
    endDate = finDeMois(`${anchorYear}-${endM}`);
    label = `T${qNum} ${anchorYear}`;
  } else if (preset === "YTD") {
    startDate = `${anchorYear}-01-01`;
    endDate = finDeMois(anchorMonth);
    label = `Année ${anchorYear}`;
  } else if (preset === "CUSTOM" && customStart && customEnd) {
    startDate = customStart;
    endDate = customEnd;
    label = `Du ${startDate} au ${endDate}`;
  }

  const { compareStartDate, compareEndDate } = calculerBornesComparatives(startDate, endDate, compareType);
  const compareLabel = compareType === "YoY"
    ? `vs N-1 (${moisLisible(decalerAn(startDate.slice(0, 7), -1))})`
    : `vs M-1 (${moisLisible(decalerMois(startDate.slice(0, 7), -1))})`;

  return {
    preset,
    compareType,
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
    isOngoing,
    label,
    compareLabel,
    anchorMonth,
  };
}

/**
 * Déplace la période d'un pas (direction: -1 pour reculer, +1 pour avancer).
 */
export function deplacerFiltre(filter, direction, prep) {
  if (!filter) return filter;
  const dir = direction >= 0 ? 1 : -1;

  if (filter.preset === "QTD") {
    const newMonth = decalerMois(filter.anchorMonth, dir * 3);
    return construireFiltrePeriode({ prep, preset: "QTD", compareType: filter.compareType, moisCible: newMonth });
  }

  if (filter.preset === "YTD") {
    const [y, m] = filter.anchorMonth.split("-").map(Number);
    const newMonth = `${y + dir}-${String(m).padStart(2, "0")}`;
    return construireFiltrePeriode({ prep, preset: "YTD", compareType: filter.compareType, moisCible: newMonth });
  }

  // CLOSED_MONTH, MTD ou défaut : décalage mois par mois
  const newMonth = decalerMois(filter.anchorMonth, dir);
  return construireFiltrePeriode({
    prep,
    preset: filter.preset === "MTD" ? "CLOSED_MONTH" : filter.preset,
    compareType: filter.compareType,
    moisCible: newMonth,
  });
}

/**
 * Calcule tous les KPI demandés pour une période et sa période comparative,
 * avec calcul automatique des deltas et pourcentages d'évolution.
 */
export function kpisPourFiltre(prep, ids, filter) {
  const currentLines = lignesPourFiltre(prep, filter.startDate, filter.endDate);
  const currentBatch = computeKpiBatch(ids, currentLines, prep.semantics);

  let previousBatch = null;
  if (filter.compareStartDate && filter.compareEndDate) {
    const prevLines = lignesPourFiltre(prep, filter.compareStartDate, filter.compareEndDate);
    previousBatch = computeKpiBatch(ids, prevLines, prep.semantics);
  }

  const variations = new Map();
  for (const id of ids) {
    const currVal = currentBatch.get(id)?.value;
    const prevVal = previousBatch?.get(id)?.value;

    let delta = null;
    let pct = null;
    if (Number.isFinite(currVal) && Number.isFinite(prevVal)) {
      delta = currVal - prevVal;
      if (prevVal !== 0) {
        pct = (delta / Math.abs(prevVal)) * 100;
      }
    }

    variations.set(id, {
      id,
      current: Number.isFinite(currVal) ? currVal : null,
      previous: Number.isFinite(prevVal) ? prevVal : null,
      delta: delta != null ? Math.round(delta * 100) / 100 : null,
      pct: pct != null ? Math.round(pct * 10) / 10 : null,
      status: currentBatch.get(id)?.status,
      sources: currentBatch.get(id)?.sources,
    });
  }

  return {
    current: currentBatch,
    previous: previousBatch,
    variations,
    filter,
  };
}

