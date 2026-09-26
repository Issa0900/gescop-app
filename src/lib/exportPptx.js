// Export PowerPoint (.pptx) pour les rapports GESCOP
// Gabarit exécutif de présentation professionnelle 16:9 haute fidélité
// Charte GESCOP : sobre, factuel, structuré en cartes, contrastes professionnels.
//
// Jusqu'au 25 sept. 2026, les diapositives etaient un dossier de demonstration
// (cascade de marge, previsions de tresorerie, plan d'action, « 98,4 % »
// codes en dur, entreprise « Nordik Plein Air Inc. » par defaut). Elles sont
// construites sur les chiffres du moteur stockes dans le rapport et sur le
// texte de l'IA, les memes que le diaporama (diapositives()).

import pptxgen from "pptxgenjs";
import { extractReportData, diapositives, PAR_DIAPOSITIVE } from "@/components/reports/reportDataExtractor";

// Palette officielle GESCOP Executive
const COLORS = {
  NAVY_DARK: "0F172A",     // Fond de couverture et diapositives majeures
  NAVY_CARD: "1E293B",     // Fond des cartes sombres
  NAVY_BORDER: "334155",   // Bordures sombres
  BG_LIGHT: "F8FAFC",      // Fond des diapositives claires
  CARD_BG: "FFFFFF",       // Fond des cartes blanches
  CARD_BORDER: "E2E8F0",   // Bordures subtiles
  TEXT_DARK: "0F172A",     // Texte principal
  TEXT_MUTED: "64748B",    // Texte secondaire
  TEXT_LIGHT: "F8FAFC",    // Texte blanc sur fond sombre
  TEXT_LIGHT_MUTED: "94A3B8",
  BRAND_BLUE: "2563EB",    // Bleu primaire
  BRAND_LIGHT: "DBEAFE",   // Fond bleu doux
  EMERALD: "059669",       // Succès / Bon
  EMERALD_LIGHT: "D1FAE5", // Fond vert doux
  AMBER: "D97706",         // Attention / Surveillance
  AMBER_LIGHT: "FEF3C7",   // Fond ambre doux
  CRIMSON: "DC2626",       // Risque / Alerte
  CRIMSON_LIGHT: "FEE2E2", // Fond rouge doux
  VIOLET: "7C3AED",        // Hebdo / Analytique
  VIOLET_LIGHT: "EDE9FE",
  WHITE: "FFFFFF",
};

const FONT_HEADING = "Calibri";
const FONT_BODY = "Calibri";

const TITRES_TYPE = { quotidien: "Surveiller", hebdomadaire: "Comprendre", mensuel: "Piloter" };
const NOMS_TYPE = { quotidien: "Rapport quotidien", hebdomadaire: "Rapport hebdomadaire", mensuel: "Rapport mensuel" };
// Les polices Office n'ont pas toujours l'espace fine insecable de fr-CA.
const txt = (t) => String(t ?? "").replace(/[  ]/g, " ");

function addHeader(slide, title, data) {
  slide.addShape("roundRect", { x: 0.5, y: 0.35, w: 9.0, h: 0.75, fill: { color: COLORS.CARD_BG }, line: { color: COLORS.CARD_BORDER, width: 0.5 }, rectRadius: 0.08 });
  const cat = TITRES_TYPE[data.type] || "Rapport";
  const catColor = data.type === "quotidien" ? COLORS.BRAND_BLUE : data.type === "hebdomadaire" ? COLORS.VIOLET : COLORS.EMERALD;
  slide.addShape("roundRect", { x: 0.65, y: 0.45, w: 1.4, h: 0.22, fill: { color: catColor }, rectRadius: 0.1 });
  slide.addText(cat.toUpperCase(), { x: 0.65, y: 0.45, w: 1.4, h: 0.22, fontFace: FONT_HEADING, fontSize: 8, bold: true, color: COLORS.WHITE, align: "center", valign: "middle" });
  slide.addText(txt(title), { x: 2.15, y: 0.42, w: 4.6, h: 0.3, fontFace: FONT_HEADING, fontSize: 13, bold: true, color: COLORS.TEXT_DARK, valign: "middle" });
  slide.addText(txt([data.companyName, data.periode?.libelle || data.period].filter(Boolean).join(" · ")), { x: 6.3, y: 0.45, w: 3.0, h: 0.25, fontFace: FONT_BODY, fontSize: 9, bold: true, color: COLORS.TEXT_MUTED, align: "right", valign: "middle" });
}

function addFooter(slide, page, total) {
  slide.addShape("line", { x: 0.5, y: 5.2, w: 9.0, h: 0, line: { color: COLORS.CARD_BORDER, width: 0.5 } });
  slide.addText("GESCOP · chiffres calculés sur vos données importées", { x: 0.5, y: 5.25, w: 5, h: 0.25, fontFace: FONT_BODY, fontSize: 8, color: COLORS.TEXT_MUTED });
  slide.addText(`${page} / ${total}`, { x: 8.0, y: 5.25, w: 1.5, h: 0.25, fontFace: FONT_BODY, fontSize: 8, bold: true, color: COLORS.TEXT_MUTED, align: "right" });
}

function addIndicateur(slide, ind, { x, y, w, h }) {
  slide.addShape("roundRect", { x, y, w, h, fill: { color: COLORS.CARD_BG }, line: { color: COLORS.CARD_BORDER, width: 0.75 }, rectRadius: 0.1 });
  slide.addText(txt(ind.nom).toUpperCase(), { x: x + 0.12, y: y + 0.08, w: w - 0.24, h: 0.22, fontFace: FONT_HEADING, fontSize: 8, bold: true, color: COLORS.TEXT_MUTED });
  const mesure = ind.courant?.statut !== "non mesuré";
  slide.addText(txt(ind.valeurTexte), { x: x + 0.12, y: y + 0.3, w: w - 0.24, h: 0.38, fontFace: FONT_HEADING, fontSize: mesure ? 18 : 11, bold: mesure, color: mesure ? COLORS.TEXT_DARK : COLORS.TEXT_MUTED, valign: "middle" });
  const bas = [];
  if (ind.variationTexte) {
    const fav = ind.variation?.favorable;
    slide.addShape("roundRect", { x: x + 0.12, y: y + h - 0.32, w: 0.95, h: 0.22, fill: { color: fav === true ? COLORS.EMERALD_LIGHT : fav === false ? COLORS.CRIMSON_LIGHT : COLORS.BG_LIGHT }, rectRadius: 0.08 });
    slide.addText(txt(ind.variationTexte), { x: x + 0.12, y: y + h - 0.32, w: 0.95, h: 0.22, fontFace: FONT_BODY, fontSize: 8, bold: true, color: fav === true ? COLORS.EMERALD : fav === false ? COLORS.CRIMSON : COLORS.TEXT_MUTED, align: "center", valign: "middle" });
  }
  if (ind.precedentTexte) bas.push(`préc. ${ind.precedentTexte}`);
  if (ind.courant?.statut === "partiel") bas.push("partiel");
  if (bas.length) slide.addText(txt(bas.join(" · ")), { x: x + (ind.variationTexte ? 1.12 : 0.12), y: y + h - 0.32, w: w - (ind.variationTexte ? 1.24 : 0.24), h: 0.22, fontFace: FONT_BODY, fontSize: 7.5, color: COLORS.TEXT_MUTED, valign: "middle" });
}

function slideClaire(pres, titre, data, page, total) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.BG_LIGHT };
  addHeader(slide, titre, data);
  addFooter(slide, page, total);
  return slide;
}

const CONSTRUCTEURS = {
  cover(pres, data) {
    const slide = pres.addSlide();
    slide.background = { color: COLORS.NAVY_DARK };
    slide.addText(`GESCOP · ${NOMS_TYPE[data.type] || "Rapport"}`.toUpperCase(), { x: 0.8, y: 1.2, w: 8.4, h: 0.3, fontFace: FONT_HEADING, fontSize: 11, bold: true, color: COLORS.TEXT_LIGHT_MUTED, charSpacing: 4 });
    if (data.companyName) slide.addText(txt(data.companyName), { x: 0.8, y: 1.6, w: 8.4, h: 0.7, fontFace: FONT_HEADING, fontSize: 34, bold: true, color: COLORS.TEXT_LIGHT });
    slide.addText(txt(data.periode?.libelle || data.period), { x: 0.8, y: 2.4, w: 8.4, h: 0.45, fontFace: FONT_HEADING, fontSize: 18, color: COLORS.BRAND_LIGHT });
    if (data.precedente?.libelle) slide.addText(txt(`comparé à ${data.precedente.libelle}`), { x: 0.8, y: 2.85, w: 8.4, h: 0.3, fontFace: FONT_BODY, fontSize: 11, color: COLORS.TEXT_LIGHT_MUTED });
    if (data.base) slide.addText(txt(data.base), { x: 0.8, y: 3.6, w: 8.4, h: 0.5, fontFace: FONT_BODY, fontSize: 9, color: COLORS.TEXT_LIGHT_MUTED });
    if (data.ancien) slide.addText("Rapport généré avec l'ancien calcul : ses chiffres peuvent différer de la page Indicateurs.", { x: 0.8, y: 4.3, w: 8.4, h: 0.35, fontFace: FONT_BODY, fontSize: 9, color: COLORS.AMBER });
  },
  resume(pres, data, page, total) {
    const slide = slideClaire(pres, "Synthèse", data, page, total);
    slide.addText("Rédigé par l'IA à partir des chiffres du rapport", { x: 0.5, y: 1.25, w: 9, h: 0.25, fontFace: FONT_BODY, fontSize: 8, bold: true, color: COLORS.BRAND_BLUE });
    slide.addText(txt(data.ia.summary), { x: 0.5, y: 1.5, w: 9, h: 1.5, fontFace: FONT_BODY, fontSize: 13, color: COLORS.TEXT_DARK, valign: "top" });
    data.indicateurs.filter((i) => i.courant?.statut !== "non mesuré").slice(0, 4)
      .forEach((ind, k) => addIndicateur(slide, ind, { x: 0.5 + k * 2.28, y: 3.3, w: 2.14, h: 1.15 }));
  },
  indicateurs(pres, data, page, total, d) {
    const slide = slideClaire(pres, d.title, data, page, total);
    data.indicateurs.slice(d.debut, d.debut + PAR_DIAPOSITIVE).forEach((ind, k) => addIndicateur(slide, ind, { x: 0.5 + (k % 4) * 2.28, y: 1.3 + Math.floor(k / 4) * 1.25, w: 2.14, h: 1.1 }));
  },
  evolution(pres, data, page, total) {
    const slide = slideClaire(pres, "Évolution", data, page, total);
    const labels = data.serie.map((s) => txt(s.libelle));
    slide.addChart("bar", [{ name: "Chiffre d'affaires HT ($)", labels, values: data.serie.map((s) => (Number.isFinite(s.ca) ? Math.round(s.ca) : 0)) }], {
      x: 0.5, y: 1.3, w: 9, h: 3.6, barDir: "col", chartColors: [COLORS.BRAND_BLUE], showValue: true, dataLabelFontSize: 8,
      catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, showLegend: true, legendPos: "b", legendFontSize: 8,
    });
  },
  progres(pres, data, page, total) {
    const slide = slideClaire(pres, "Progrès et reculs", data, page, total);
    const col = (titre, items, x, couleur) => {
      slide.addText(titre, { x, y: 1.3, w: 4.4, h: 0.3, fontFace: FONT_HEADING, fontSize: 11, bold: true, color: couleur });
      const lignes = items.length ? items.slice(0, 6).flatMap((it) => [
        { text: txt(it.titre), options: { bold: true, fontSize: 10, color: COLORS.TEXT_DARK, breakLine: true } },
        { text: txt(it.detail), options: { fontSize: 9, color: COLORS.TEXT_MUTED, breakLine: true } },
      ]) : [{ text: "Aucun indicateur dans ce sens.", options: { fontSize: 9, color: COLORS.TEXT_MUTED } }];
      slide.addText(lignes, { x, y: 1.65, w: 4.4, h: 3.3, fontFace: FONT_BODY, valign: "top", paraSpaceAfter: 4 });
    };
    col("▲ Ce qui s'améliore", data.progres, 0.5, COLORS.EMERALD);
    col("▼ Ce qui recule", data.reculs, 5.1, COLORS.CRIMSON);
  },
  constats(pres, data, page, total) {
    const slide = slideClaire(pres, "Constats croisés", data, page, total);
    slide.addText("Calculés en comparant deux sources de vos données (règles fixes, sans IA).", { x: 0.5, y: 1.25, w: 9, h: 0.25, fontFace: FONT_BODY, fontSize: 8, color: COLORS.TEXT_MUTED });
    slide.addText(data.constats.slice(0, 4).flatMap((c) => [
      { text: txt(`[${c.niveau === "modere" ? "modéré" : c.niveau}] ${c.titre}`), options: { bold: true, fontSize: 10, color: COLORS.TEXT_DARK, breakLine: true } },
      { text: txt(c.constat), options: { fontSize: 9, color: COLORS.TEXT_MUTED, breakLine: true } },
    ]), { x: 0.5, y: 1.55, w: 9, h: 3.5, fontFace: FONT_BODY, valign: "top", paraSpaceAfter: 5 });
  },
  analyse(pres, data, page, total) {
    const slide = slideClaire(pres, "Analyse de l'IA", data, page, total);
    slide.addText("Rédigé par l'IA à partir des chiffres du rapport ; chaque affirmation porte sa nature.", { x: 0.5, y: 1.25, w: 9, h: 0.25, fontFace: FONT_BODY, fontSize: 8, bold: true, color: COLORS.BRAND_BLUE });
    const blocs = data.ia.variationAnalysis.length
      ? data.ia.variationAnalysis.slice(0, 4).flatMap((v) => [
        { text: txt(`${v.classificationTexte}${v.label ? ` · ${v.label}` : ""}${v.status === "REVIEW_REQUIRED" ? " · À VÉRIFIER" : ""}`), options: { bold: true, fontSize: 8.5, color: COLORS.TEXT_MUTED, breakLine: true } },
        { text: txt(v.text), options: { fontSize: 10, color: COLORS.TEXT_DARK, breakLine: true } },
      ])
      : data.ia.keyInsights.slice(0, 5).map((k) => ({ text: txt(`• ${k}`), options: { fontSize: 10, color: COLORS.TEXT_DARK, breakLine: true } }));
    slide.addText(blocs, { x: 0.5, y: 1.55, w: 9, h: 3.5, fontFace: FONT_BODY, valign: "top", paraSpaceAfter: 5 });
  },
  donnees(pres, data, page, total) {
    const slide = slideClaire(pres, "Données utilisées", data, page, total);
    const m = data.mesures;
    const lignes = [
      data.couverture.length ? data.couverture.map((c) => `${new Intl.NumberFormat("fr-CA").format(c.n)} ${c.libelle}`).join(" · ") : "Aucune ligne datée dans la période.",
      `${m.mesures} indicateur(s) mesuré(s) sur ${m.total}${m.partiels ? `, ${m.partiels} partiel(s)` : ""}.`,
      ...(m.nonMesures.length ? [`Non mesurés faute de données : ${m.nonMesures.join(", ")}.`] : []),
    ];
    slide.addText(lignes.map((l) => ({ text: txt(l), options: { breakLine: true } })), { x: 0.5, y: 1.4, w: 9, h: 3, fontFace: FONT_BODY, fontSize: 12, color: COLORS.TEXT_DARK, valign: "top", paraSpaceAfter: 8 });
  },
};

export async function downloadReportPPTX(report, company) {
  if (!report) return;
  const data = extractReportData(report, company);
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.company = "GESCOP";
  pres.subject = `Rapport GESCOP${data.companyName ? ` - ${data.companyName}` : ""}`;
  pres.title = `${NOMS_TYPE[data.type] || "Rapport"} - ${data.periode?.libelle || report.period || ""}`;

  const liste = diapositives(data);
  liste.forEach((d, k) => CONSTRUCTEURS[d.id]?.(pres, data, k + 1, liste.length, d));

  const dateStr = new Date().toISOString().slice(0, 10);
  const periode = String(data.periode?.libelle || report.period || "Rapport").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return await pres.writeFile({ fileName: `GESCOP_${String(report.type || "rapport").toUpperCase()}_${periode}_${dateStr}.pptx` });
}
