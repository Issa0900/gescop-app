// Donnees affichees par les rapports (vues, diaporama, PowerPoint).
//
// Ce fichier fabriquait un rapport de demonstration : chiffres codes en dur
// (« 1 184 000 $ », stock de 420 000 $, score de fiabilite de 91 %), nom
// d'entreprise « Nordik Plein Air », diagnostics, scenarios et plan d'action
// inventes, affiches a chaque client comme ses propres resultats (ANO-15).
// Il ne fait plus que mettre en forme ce que le rapport contient : les
// chiffres du moteur KPI stockes a la generation (report.chiffres) et le texte
// de l'IA, presente comme tel. Rien n'est complete par defaut.

import { variation } from "@/lib/core/rapportChiffres";

const LIBELLES_SOURCES = {
  Order: "commandes", Transaction: "transactions", Expense: "dépenses", Payroll: "paies",
  Cashflow: "relevés de trésorerie", CampaignDaily: "lignes de campagne", ExecutiveSummary: "lignes de synthèse",
};

export const CLASSIFICATIONS = {
  FACT: "FAIT", CALCULATION: "CALCUL", OBSERVATION: "OBSERVATION",
  INFERENCE: "INFÉRENCE", HYPOTHESIS: "HYPOTHÈSE", RECOMMENDATION: "RECOMMANDATION",
};

const nf = (max) => new Intl.NumberFormat("fr-CA", { maximumFractionDigits: max });

/** Valeur d'un indicateur, ou « Non mesuré ». */
export function fmtValeur(v, unite) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "Non mesuré";
  const n = Number(v);
  if (unite === "$") return `${nf(0).format(n)} $`;
  if (unite === "%") return `${nf(1).format(n)} %`;
  return nf(Math.abs(n) < 100 ? 2 : 0).format(n);
}

/** Variation lisible (« +8,2 % », « -1,2 pt », « +500 $ »), ou null. */
export function fmtVariation(va, unite) {
  if (!va) return null;
  const signe = (x) => (x > 0 ? "+" : x < 0 ? "-" : "");
  if (va.enPoints) return `${signe(va.ecart)}${nf(1).format(Math.abs(va.ecart))} pt`;
  if (va.pct !== null) return `${signe(va.pct)}${nf(1).format(Math.abs(va.pct))} %`;
  return `${signe(va.ecart)}${fmtValeur(Math.abs(va.ecart), unite)}`;
}

// Rapports generes avant le 25 sept. 2026 : seuls les chiffres de l'ancienne
// comparaison serveur existent (revenus = transactions seulement, marge =
// revenus - depenses). Ils sont montres tels quels, avec un avertissement.
function indicateursAnciens(comparison) {
  return (comparison?.metrics || []).map((m) => {
    const nonMesure = m.trend === "non-mesurable";
    const courant = nonMesure && !m.current ? null : m.current ?? null;
    const precedent = nonMesure && !m.previous ? null : m.previous ?? null;
    return {
      id: m.key, nom: m.label, unite: m.unit || "", baisseFavorable: Boolean(m.invert),
      courant: { valeur: courant, statut: courant === null ? "non mesuré" : "mesuré" },
      precedent: { valeur: precedent, statut: precedent === null ? "non mesuré" : "mesuré" },
    };
  });
}

/**
 * @param {Object} report - entite Report
 * @param {Object} [company] - entite Company (nom affiche)
 */
export function extractReportData(report, company) {
  if (!report) return null;
  const ch = report.chiffres && Array.isArray(report.chiffres.indicateurs) ? report.chiffres : null;
  const comparison = report.comparison || {};

  const indicateurs = (ch ? ch.indicateurs : indicateursAnciens(comparison)).map((ind) => {
    const va = variation(ind);
    return {
      ...ind,
      variation: va,
      valeurTexte: fmtValeur(ind.courant?.valeur, ind.unite),
      precedentTexte: ind.precedent ? fmtValeur(ind.precedent.valeur, ind.unite) : null,
      variationTexte: fmtVariation(va, ind.unite),
    };
  });

  const detail = (i) => `${i.valeurTexte} contre ${i.precedentTexte} (${i.variationTexte})`;
  const progres = indicateurs.filter((i) => i.variation?.favorable === true).map((i) => ({ titre: i.nom, detail: detail(i) }));
  const reculs = indicateurs.filter((i) => i.variation?.favorable === false).map((i) => ({ titre: i.nom, detail: detail(i) }));

  const compte = (s) => indicateurs.filter((i) => i.courant?.statut === s).length;
  const mesures = {
    total: indicateurs.length,
    mesures: compte("mesuré"),
    partiels: compte("partiel"),
    nonMesures: indicateurs.filter((i) => i.courant?.statut === "non mesuré").map((i) => i.nom),
  };

  const variationAnalysis = (comparison.variationAnalysis || []).map((v) => ({
    ...v,
    classificationTexte: CLASSIFICATIONS[v.classification] || v.classification || "",
  }));
  const sections = Object.entries(report.sections || {})
    .filter(([, contenu]) => typeof contenu === "string" && contenu.trim())
    .map(([titre, contenu]) => ({ titre, contenu }));

  return {
    type: report.type || "quotidien",
    period: report.period || ch?.periode?.libelle || "",
    createdDate: report.created_date,
    companyName: company?.name || "",
    ancien: !ch,
    periode: ch?.periode || (comparison.currentLabel ? { libelle: comparison.currentLabel } : null),
    precedente: ch?.precedente || (comparison.previousLabel ? { libelle: comparison.previousLabel } : null),
    base: ch?.base || "",
    indicateurs,
    serie: (ch?.serie || []).filter((s) => s.ca !== null || s.margePct !== null),
    progres,
    reculs,
    constats: ch?.constats || [],
    couverture: Object.entries(ch?.couverture || {}).map(([entite, n]) => ({ libelle: LIBELLES_SOURCES[entite] || entite, n })),
    mesures,
    ia: {
      summary: report.summary || "",
      variationAnalysis,
      keyInsights: (comparison.keyInsights || []).filter(Boolean),
      sections,
      reviewRequired: Boolean(comparison.reviewRequired),
    },
    rawContent: report.content || "",
  };
}

export const PAR_DIAPOSITIVE = 9;

/** Liste des diapositives que le contenu du rapport permet de remplir. */
export function diapositives(data) {
  const l = [{ id: "cover", title: "Couverture" }];
  if (data.ia.summary) l.push({ id: "resume", title: "Synthèse" });
  // 9 indicateurs par diapositive : au-dela, ils etaient coupes (ecran) ou
  // perdus sans le dire (PowerPoint, 12 au plus).
  for (let debut = 0; debut < data.indicateurs.length; debut += PAR_DIAPOSITIVE) {
    l.push({ id: "indicateurs", title: debut ? "Indicateurs clés (suite)" : "Indicateurs clés", debut });
  }
  if (data.serie.length >= 2) l.push({ id: "evolution", title: "Évolution" });
  if (data.progres.length || data.reculs.length) l.push({ id: "progres", title: "Progrès et reculs" });
  if (data.constats.length) l.push({ id: "constats", title: "Constats croisés" });
  if (data.ia.variationAnalysis.length || data.ia.keyInsights.length) l.push({ id: "analyse", title: "Analyse de l'IA" });
  l.push({ id: "donnees", title: "Données utilisées" });
  return l;
}
