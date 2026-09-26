// Chiffres d'un rapport (quotidien, hebdomadaire, mensuel), calcules par le
// moteur KPI sur la periode du rapport.
//
// Les rapports affichaient des chiffres de demonstration codes en dur
// (reportDataExtractor.js : « 1 184 000 $ », « Nordik Plein Air », stock de
// 420 000 $...) et le serveur calculait ses propres totaux (revenus =
// transactions seulement, marge = revenus - depenses, CA TTC). Desormais,
// comme pour l'analyse IA (instantane.js), l'ecran calcule les chiffres avec
// le moteur - memes formules que la page Indicateurs - et les envoie a
// generateReport, qui les stocke dans le rapport et demande a l'IA de les
// commenter sans les recalculer.

import { preparerPeriodes, moisComplets, decalerMois, kpisSurFenetre, kpisEntreDates, finDeMois } from "./kpiPeriodes";
import { detecterCroisements } from "./croisements";
import { getKpiDefinition } from "./kpiRegistry";
import { dateLigne, notePeriodeCommune } from "./kpiRecords";

export const VERSION_CHIFFRES = 1;

const COMMUNS = ["total_revenue", "order_count", "aov", "gross_margin_pct", "cash_closing", "inventory_value_total"];
export const IDS_RAPPORT = {
  quotidien: COMMUNS,
  hebdomadaire: [...COMMUNS, "gross_margin_amount", "total_expense", "return_rate"],
  mensuel: [...COMMUNS, "gross_margin_amount", "total_charges", "net_income", "net_margin_pct", "ebitda", "payroll_total", "rh_expense_ratio", "return_rate"],
};

// Une baisse de ces indicateurs est une bonne nouvelle.
const BAISSE_FAVORABLE = new Set(["total_charges", "total_expense", "return_rate", "rh_expense_ratio"]);
// Photos (soldes, stock) : pas de comparaison de periode pour le stock, dont
// le relevé importé n'est pas date par periode.
const PHOTO_SANS_HISTORIQUE = new Set(["inventory_value_total"]);

const NOMS_BRUTS = { cash_closing: "Trésorerie (solde de clôture)" };

const unite = (id) => {
  if (id === "cash_closing") return "$";
  const t = getKpiDefinition(id)?.dataType;
  return t === "currency" ? "$" : t === "percentage" ? "%" : "";
};

const statutDe = (r) => {
  if (!r || r.value === null || r.value === undefined || !Number.isFinite(r.value)) return "non mesuré";
  return r.status === "UNKNOWN" ? "partiel" : "mesuré";
};

const valeur = (r) => (r && Number.isFinite(r.value) ? Math.round(r.value * 100) / 100 : null);

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const jourFr = (iso) => { const [a, m, j] = iso.split("-").map(Number); return `${j} ${MOIS_FR[m - 1]} ${a}`; };
const moisFr = (m) => { const [a, n] = m.split("-").map(Number); return `${MOIS_FR[n - 1]} ${a}`; };
const decalerJour = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const periodeJours = (debut, fin) => ({ debut, fin, libelle: debut === fin ? jourFr(debut) : `${jourFr(debut)} → ${jourFr(fin)}` });
const periodeMois = (m) => ({ debut: `${m}-01`, fin: finDeMois(m), libelle: moisFr(m) });

/** Dernier jour avec des ventes (commandes ou transactions), sinon avec un flux, au plus aujourd'hui. */
function dernierJourActif(prep, aujourdhui) {
  let ventes = null, flux = null;
  for (const lignes of prep.parMois.values()) {
    for (const r of lignes) {
      const d = dateLigne(r)?.jour;
      if (!d || d > aujourdhui) continue;
      if (!flux || d > flux) flux = d;
      if ((r._entity === "Order" || r._entity === "Transaction") && (!ventes || d > ventes)) ventes = d;
    }
  }
  return ventes ? { jour: ventes, source: "ventes" } : flux ? { jour: flux, source: "données" } : null;
}

/**
 * @param {Object} data - jeu de donnees du moteur (useDonneesKpi)
 * @param {"quotidien"|"hebdomadaire"|"mensuel"} type
 * @param {{ aujourdhui?: Date, comparer?: boolean }} [options]
 */
export function chiffresRapport(data, type, { aujourdhui = new Date(), comparer = true } = {}) {
  const ids = IDS_RAPPORT[type] || IDS_RAPPORT.quotidien;
  const prep = preparerPeriodes(data, { aujourdhui });
  const jourCourant = aujourdhui.toISOString().slice(0, 10);

  let periode = null, precedente = null, base = null, calcul = null, serie = [];
  if (type === "mensuel") {
    const mois = moisComplets(prep);
    if (mois.length) {
      const dernier = mois[mois.length - 1];
      periode = periodeMois(dernier);
      precedente = periodeMois(decalerMois(dernier, -1));
      base = dernier === prep.moisCourant
        ? "Mois en cours, encore incomplet : moins de trois mois complets de données sont importés (même fenêtre que la page Indicateurs)."
        : "Dernier mois complet avec des données (même fenêtre que la page Indicateurs).";
      calcul = (p) => kpisSurFenetre(prep, ids, p.debut.slice(0, 7), p.fin.slice(0, 7));
      for (let i = 5; i >= 0; i--) {
        const m = decalerMois(dernier, -i);
        serie.push({ libelle: moisFr(m), ...periodeMois(m) });
      }
    }
  } else {
    const actif = dernierJourActif(prep, jourCourant);
    if (actif) {
      const long = type === "hebdomadaire" ? 7 : 1;
      periode = periodeJours(decalerJour(actif.jour, -(long - 1)), actif.jour);
      precedente = periodeJours(decalerJour(actif.jour, -(2 * long - 1)), decalerJour(actif.jour, -long));
      base = `${long === 7 ? "Sept jours se terminant" : "Journée"} au dernier jour avec des ${actif.source} enregistrées (${jourFr(actif.jour)}).`;
      calcul = (p) => kpisEntreDates(prep, ids, p.debut, p.fin);
      const pas = long === 7 ? 7 : 1, n = long === 7 ? 5 : 7;
      for (let i = n - 1; i >= 0; i--) {
        const fin = decalerJour(actif.jour, -i * pas);
        const p = periodeJours(decalerJour(fin, -(long - 1)), fin);
        serie.push({ ...p });
      }
    }
  }

  if (!periode) {
    return {
      version: VERSION_CHIFFRES, type, periode: null, precedente: null,
      base: "Aucune donnée datée importée : aucun indicateur ne peut être calculé pour ce rapport.",
      indicateurs: ids.map((id) => ({ id, nom: getKpiDefinition(id)?.name?.fr || NOMS_BRUTS[id] || id, unite: unite(id), baisseFavorable: BAISSE_FAVORABLE.has(id), courant: { valeur: null, statut: "non mesuré" }, precedent: null })),
      serie: [], couverture: {}, constats: [],
    };
  }

  const cour = calcul(periode);
  const prec = comparer && precedente ? calcul(precedente) : null;
  const indicateurs = ids.map((id) => {
    const r = cour.get(id);
    const note = [
      notePeriodeCommune(r),
      PHOTO_SANS_HISTORIQUE.has(id) && valeur(r) !== null ? "Dernier relevé de stock importé (non daté par période)" : null,
    ].filter(Boolean).join(" · ") || null;
    const p = prec && !PHOTO_SANS_HISTORIQUE.has(id) ? prec.get(id) : null;
    return {
      id,
      nom: getKpiDefinition(id)?.name?.fr || NOMS_BRUTS[id] || id,
      unite: unite(id),
      baisseFavorable: BAISSE_FAVORABLE.has(id),
      courant: { valeur: valeur(r), statut: statutDe(r), ...(note ? { note } : {}) },
      precedent: p ? { valeur: valeur(p), statut: statutDe(p) } : null,
    };
  });

  // Serie : CA et taux de marge brute de chaque sous-periode, memes formules.
  const serieCalculee = serie.map((p) => {
    const res = type === "mensuel"
      ? kpisSurFenetre(prep, ["total_revenue", "gross_margin_pct"], p.debut.slice(0, 7), p.fin.slice(0, 7))
      : kpisEntreDates(prep, ["total_revenue", "gross_margin_pct"], p.debut, p.fin);
    return { libelle: p.libelle, debut: p.debut, fin: p.fin, ca: valeur(res.get("total_revenue")), margePct: valeur(res.get("gross_margin_pct")) };
  });

  // Couverture : lignes de flux reellement retenues dans la periode.
  const couverture = {};
  for (const lignes of prep.parMois.values()) {
    for (const r of lignes) {
      const d = dateLigne(r);
      if (!d) continue;
      const dedans = d.jour ? d.jour >= periode.debut && d.jour <= periode.fin : `${d.mois}-01` >= periode.debut && finDeMois(d.mois) <= periode.fin;
      if (dedans) couverture[r._entity] = (couverture[r._entity] || 0) + 1;
    }
  }

  const constats = detecterCroisements(data, { aujourdhui }).slice(0, 10)
    .map(({ niveau, titre, constat, action }) => ({ niveau, titre, constat, action }));

  return {
    version: VERSION_CHIFFRES, type, periode, precedente: prec ? precedente : null, base,
    indicateurs, serie: serieCalculee, couverture, constats,
  };
}

/**
 * Variation d'un indicateur entre deux periodes, ou null si l'une des deux
 * valeurs n'est pas mesuree. Les pourcentages varient en points.
 */
export function variation(ind) {
  const c = ind?.courant?.valeur, p = ind?.precedent?.valeur;
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  const enPoints = ind.unite === "%";
  const ecart = c - p;
  const pct = enPoints ? null : p !== 0 ? (ecart / Math.abs(p)) * 100 : null;
  const valeurRef = enPoints ? ecart : pct;
  const sens = valeurRef === null ? (ecart === 0 ? "stable" : null) : Math.abs(valeurRef) < (enPoints ? 0.1 : 0.5) ? "stable" : ecart > 0 ? "hausse" : "baisse";
  const favorable = sens === "stable" || sens === null ? null : (sens === "hausse") !== Boolean(ind.baisseFavorable);
  return { ecart, pct, enPoints, sens, favorable };
}
