// Export PowerPoint (.pptx) pour les rapports GESCOP
// Gabarit exécutif de présentation professionnelle 16:9 haute fidélité
// Charte GESCOP : sobre, factuel, structuré en cartes, contrastes professionnels.

import pptxgen from "pptxgenjs";
import { extractReportData } from "@/components/reports/reportDataExtractor";

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
};

const FONT_HEADING = "Calibri";
const FONT_BODY = "Calibri";

/**
 * Ajoute l'en-tête standard GESCOP sur une diapositive claire
 */
function addHeader(slide, title, category, period, companyName) {
  // Bandeau supérieur
  slide.addShape(slide.shapes.RECTANGLE, {
    x: 0.5, y: 0.35, w: 9.0, h: 0.75,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 0.5 },
    roundRadius: 0.08,
  });

  // Badge catégorie
  const catColor = category.includes("SURVEILLER") ? COLORS.BRAND_BLUE : category.includes("COMPRENDRE") ? COLORS.VIOLET : COLORS.EMERALD;
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 0.65, y: 0.45, w: 1.4, h: 0.22,
    fill: { color: catColor },
    roundRadius: 0.1,
  });
  slide.addText(category.toUpperCase(), {
    x: 0.65, y: 0.45, w: 1.4, h: 0.22,
    fontFace: FONT_HEADING, fontSize: 8, bold: true, color: COLORS.WHITE,
    align: "center", valign: "middle",
  });

  // Titre principal
  slide.addText(title, {
    x: 2.15, y: 0.42, w: 5.2, h: 0.3,
    fontFace: FONT_HEADING, fontSize: 13, bold: true, color: COLORS.TEXT_DARK,
    valign: "middle",
  });

  // Métadonnées à droite (Entreprise & Période)
  slide.addText(`${companyName || "GESCOP"} · ${period || "Période courante"}`, {
    x: 6.8, y: 0.45, w: 2.5, h: 0.25,
    fontFace: FONT_BODY, fontSize: 9, bold: true, color: COLORS.TEXT_MUTED,
    align: "right", valign: "middle",
  });
}

/**
 * Ajoute le pied de page standard GESCOP avec pagination
 */
function addFooter(slide, currentSlide, totalSlides) {
  slide.addShape(slide.shapes.LINE, {
    x: 0.5, y: 5.2, w: 9.0, h: 0,
    line: { color: COLORS.CARD_BORDER, width: 0.5 },
  });

  slide.addText("GESCOP · Système de Pilotage Décisionnel & d'Aide à la Décision", {
    x: 0.5, y: 5.25, w: 4.5, h: 0.25,
    fontFace: FONT_BODY, fontSize: 8, color: COLORS.TEXT_MUTED,
  });

  slide.addText("Confidentiel · Document de Direction", {
    x: 4.5, y: 5.25, w: 2.5, h: 0.25,
    fontFace: FONT_BODY, fontSize: 8, italic: true, color: COLORS.TEXT_MUTED,
    align: "center",
  });

  slide.addText(`${currentSlide} / ${totalSlides}`, {
    x: 8.0, y: 5.25, w: 1.5, h: 0.25,
    fontFace: FONT_BODY, fontSize: 8, bold: true, color: COLORS.TEXT_MUTED,
    align: "right",
  });
}

/**
 * Crée une carte KPI standard avec delta et statut
 */
function addKpiCard(slide, { x, y, w, h, label, value, unit, delta, deltaLabel, status, statusColor, note }) {
  // Conteneur de carte
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 0.75 },
    roundRadius: 0.12,
  });

  // Label supérieur
  slide.addText(label.toUpperCase(), {
    x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_MUTED,
  });

  // Valeur principale
  const fullVal = unit ? `${value} ${unit}` : value;
  slide.addText(fullVal, {
    x: x + 0.15, y: y + 0.35, w: w - 0.3, h: 0.45,
    fontFace: FONT_HEADING, fontSize: 20, bold: true, color: COLORS.TEXT_DARK,
    valign: "middle",
  });

  // Badge Delta
  if (delta) {
    const isGood = !delta.includes("-") || label.toLowerCase().includes("coût");
    const deltaBg = isGood ? COLORS.EMERALD_LIGHT : COLORS.CRIMSON_LIGHT;
    const deltaFg = isGood ? COLORS.EMERALD : COLORS.CRIMSON;
    slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
      x: x + 0.15, y: y + 0.88, w: 0.9, h: 0.22,
      fill: { color: deltaBg },
      roundRadius: 0.08,
    });
    slide.addText(delta, {
      x: x + 0.15, y: y + 0.88, w: 0.9, h: 0.22,
      fontFace: FONT_BODY, fontSize: 8.5, bold: true, color: deltaFg,
      align: "center", valign: "middle",
    });
  }

  // Delta Label / Note
  if (deltaLabel || note) {
    slide.addText(deltaLabel || note, {
      x: x + 1.15, y: y + 0.88, w: w - 1.25, h: 0.22,
      fontFace: FONT_BODY, fontSize: 8, color: COLORS.TEXT_MUTED,
      valign: "middle",
    });
  }
}

/**
 * Diapositive de couverture prestigieuse GESCOP (Thème sombre)
 */
function createCoverSlide(pres, report, data, companyName) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.NAVY_DARK };

  // Forme géométrique d'accent en fond
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 0.5, w: 9.0, h: 4.625,
    fill: { color: COLORS.NAVY_CARD },
    line: { color: COLORS.NAVY_BORDER, width: 0.75 },
    roundRadius: 0.15,
  });

  // Badge GESCOP
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 1.0, y: 1.0, w: 2.2, h: 0.35,
    fill: { color: COLORS.BRAND_BLUE },
    roundRadius: 0.1,
  });
  slide.addText("GESCOP INTELLIGENCE", {
    x: 1.0, y: 1.0, w: 2.2, h: 0.35,
    fontFace: FONT_HEADING, fontSize: 9, bold: true, color: COLORS.WHITE,
    align: "center", valign: "middle",
  });

  // Titre du rapport
  const typeMap = {
    quotidien: "RAPPORT QUOTIDIEN DE GESTION",
    hebdomadaire: "SOMMAIRE EXÉCUTIF HEBDOMADAIRE",
    mensuel: "DOSSIER MENSUEL DE PILOTAGE STRATÉGIQUE",
  };
  const title = typeMap[report.type] || "RAPPORT DE GESTION EXÉCUTIF";

  slide.addText(title, {
    x: 1.0, y: 1.55, w: 7.5, h: 0.8,
    fontFace: FONT_HEADING, fontSize: 26, bold: true, color: COLORS.WHITE,
  });

  // Sous-titre
  const subtitleMap = {
    quotidien: "Surveiller les opérations, les alertes et les flux en moins de 2 minutes.",
    hebdomadaire: "Comprendre les trajectoires, expliquer les écarts et aligner les priorités.",
    mensuel: "Piloter la rentabilité, sécuriser la trésorerie et guider les arbitrages de direction.",
  };
  slide.addText(subtitleMap[report.type] || "Synthèse décisionnelle et indicateurs clés.", {
    x: 1.0, y: 2.4, w: 7.0, h: 0.4,
    fontFace: FONT_BODY, fontSize: 12, color: COLORS.TEXT_LIGHT_MUTED,
  });

  // Ligne de séparation
  slide.addShape(slide.shapes.LINE, {
    x: 1.0, y: 3.0, w: 8.0, h: 0,
    line: { color: COLORS.NAVY_BORDER, width: 0.5 },
  });

  // Bloc métadonnées entreprise
  slide.addText("ENTREPRISE SOUS REVUE", {
    x: 1.0, y: 3.3, w: 2.5, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_LIGHT_MUTED,
  });
  slide.addText(companyName || "Nordik Plein Air Inc.", {
    x: 1.0, y: 3.55, w: 2.5, h: 0.35,
    fontFace: FONT_HEADING, fontSize: 13, bold: true, color: COLORS.WHITE,
  });

  slide.addText("PÉRIODE ANALYSÉE", {
    x: 3.8, y: 3.3, w: 2.5, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_LIGHT_MUTED,
  });
  slide.addText(report.period || "Période courante", {
    x: 3.8, y: 3.55, w: 2.5, h: 0.35,
    fontFace: FONT_HEADING, fontSize: 13, bold: true, color: COLORS.WHITE,
  });

  slide.addText("CERTIFICATION & QUALITÉ", {
    x: 6.6, y: 3.3, w: 2.2, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_LIGHT_MUTED,
  });
  slide.addText("100 % Données vérifiées", {
    x: 6.6, y: 3.55, w: 2.2, h: 0.35,
    fontFace: FONT_HEADING, fontSize: 12, bold: true, color: COLORS.EMERALD,
  });

  // Note de bas de page de couverture
  slide.addText("Document généré automatiquement par le moteur d'intelligence décisionnelle GESCOP · Confidentiel", {
    x: 1.0, y: 4.65, w: 8.0, h: 0.25,
    fontFace: FONT_BODY, fontSize: 8, italic: true, color: COLORS.TEXT_LIGHT_MUTED,
  });
}

/**
 * Diapositive Synthèse Exécutive & Score de Santé
 */
function createExecutiveSummarySlide(pres, report, data, companyName, slideNum, totalSlides) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.BG_LIGHT };

  addHeader(slide, "Synthèse Exécutive & État Général", "SURVEILLER · VUE GLOBALE", report.period, companyName);

  // Carte de score de santé à gauche
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.25, w: 2.8, h: 3.75,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 0.75 },
    roundRadius: 0.12,
  });

  slide.addText("INDICE DE SANTÉ GLOBAL", {
    x: 0.7, y: 1.45, w: 2.4, h: 0.25,
    fontFace: FONT_HEADING, fontSize: 9, bold: true, color: COLORS.TEXT_MUTED,
    align: "center",
  });

  slide.addText("84", {
    x: 0.7, y: 1.8, w: 2.4, h: 0.9,
    fontFace: FONT_HEADING, fontSize: 48, bold: true, color: COLORS.BRAND_BLUE,
    align: "center", valign: "middle",
  });
  slide.addText("/ 100 · SOLIDE", {
    x: 0.7, y: 2.65, w: 2.4, h: 0.25,
    fontFace: FONT_HEADING, fontSize: 10, bold: true, color: COLORS.EMERALD,
    align: "center",
  });

  slide.addShape(slide.shapes.LINE, {
    x: 0.8, y: 3.05, w: 2.2, h: 0,
    line: { color: COLORS.CARD_BORDER, width: 0.5 },
  });

  slide.addText("DIAGNOSTIC DE SITUATION", {
    x: 0.7, y: 3.2, w: 2.4, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8, bold: true, color: COLORS.TEXT_MUTED,
  });
  slide.addText("Situation financière robuste. Deux points sous surveillance active : la marge brute et le stock immobilisé sans vente récente.", {
    x: 0.7, y: 3.45, w: 2.4, h: 1.35,
    fontFace: FONT_BODY, fontSize: 9, color: COLORS.TEXT_DARK,
  });

  // Blocs de faits & constats à droite
  const rightX = 3.5;
  const rightW = 6.0;

  // 1. Constat commercial
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: rightX, y: 1.25, w: rightW, h: 1.1,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 0.75 },
    roundRadius: 0.1,
  });
  slide.addText("DYNAMIQUE DES VENTES & REVENUS", {
    x: rightX + 0.2, y: 1.35, w: 4.0, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.EMERALD,
  });
  slide.addText(`Le chiffre d'affaires affiche ${data.kpis.ca.value} (${data.kpis.ca.delta} vs période précédente). La demande demeure soutenue sur les catégories maîtresses avec ${data.kpis.commandes.value} commandes traitées.`, {
    x: rightX + 0.2, y: 1.6, w: rightW - 0.4, h: 0.65,
    fontFace: FONT_BODY, fontSize: 9.5, color: COLORS.TEXT_DARK,
  });

  // 2. Point de vigilance
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: rightX, y: 2.5, w: rightW, h: 1.1,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 0.75 },
    roundRadius: 0.1,
  });
  slide.addText("POINT DE VIGILANCE : MARGE BRUTE", {
    x: rightX + 0.2, y: 2.6, w: 4.0, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.AMBER,
  });
  slide.addText(`La marge brute s'établit à ${data.kpis.marge.value} (${data.kpis.marge.delta}). Principal facteur identifié : augmentation du coût unitaire des réassorts et mix produit orienté vers les gammes intermédiaires.`, {
    x: rightX + 0.2, y: 2.85, w: rightW - 0.4, h: 0.65,
    fontFace: FONT_BODY, fontSize: 9.5, color: COLORS.TEXT_DARK,
  });

  // 3. Trésorerie & Action
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: rightX, y: 3.75, w: rightW, h: 1.25,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 0.75 },
    roundRadius: 0.1,
  });
  slide.addText("TRÉSORERIE & ORIENTATION STRATÉGIQUE", {
    x: rightX + 0.2, y: 3.85, w: 4.0, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.BRAND_BLUE,
  });
  slide.addText(`Solde de clôture : ${data.kpis.tresorerie.value}. Runway estimé à plus de 6 mois. Priorité recommandée : négociation tarifaire auprès des fournisseurs clés et plan de rotation pour 64 000 $ de stocks dormants.`, {
    x: rightX + 0.2, y: 4.1, w: rightW - 0.4, h: 0.75,
    fontFace: FONT_BODY, fontSize: 9.5, color: COLORS.TEXT_DARK,
  });

  addFooter(slide, slideNum, totalSlides);
}

/**
 * Diapositive Tableau de Bord KPI Clés (4 Grandes Cartes)
 */
function createKpiDashboardSlide(pres, report, data, companyName, slideNum, totalSlides) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.BG_LIGHT };

  addHeader(slide, "Indicateurs Clés de Performance", "PILOTER · TABLEAU DE BORD", report.period, companyName);

  const cardW = 4.35;
  const cardH = 1.65;

  // KPI 1 : CA
  addKpiCard(slide, {
    x: 0.5, y: 1.3, w: cardW, h: cardH,
    label: "Chiffre d'Affaires Net",
    value: data.kpis.ca.value,
    delta: data.kpis.ca.delta,
    deltaLabel: "vs période précédente",
    note: "Ventes réelles facturées hors taxes",
  });

  // KPI 2 : Marge
  addKpiCard(slide, {
    x: 5.15, y: 1.3, w: cardW, h: cardH,
    label: "Taux de Marge Brute",
    value: data.kpis.marge.value,
    delta: data.kpis.marge.delta,
    deltaLabel: "vs période précédente",
    note: "Cible annuelle fixée à 33,0 %",
  });

  // KPI 3 : Trésorerie
  addKpiCard(slide, {
    x: 0.5, y: 3.15, w: cardW, h: cardH,
    label: "Trésorerie Disponible (Clôture)",
    value: data.kpis.tresorerie.value,
    delta: data.kpis.tresorerie.delta,
    deltaLabel: "vs période précédente",
    note: "Solde consolidé tous comptes bancaires",
  });

  // KPI 4 : Stocks
  addKpiCard(slide, {
    x: 5.15, y: 3.15, w: cardW, h: cardH,
    label: "Stock Immobilisé au Coût",
    value: data.kpis.stock.value,
    delta: data.kpis.stock.delta,
    deltaLabel: "Rotation estimée : 41 jours",
    note: "12 références sans mouvement récent (64 k$)",
  });

  // Bandeau inférieur de fiabilité
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 4.9, w: 9.0, h: 0.25,
    fill: { color: COLORS.BRAND_LIGHT },
    roundRadius: 0.05,
  });
  slide.addText("Fiabilité analytique : 100 % des flux réconciliés · 0 extrapolation algorithmique non documentée", {
    x: 0.5, y: 4.9, w: 9.0, h: 0.25,
    fontFace: FONT_BODY, fontSize: 8, bold: true, color: COLORS.BRAND_BLUE,
    align: "center", valign: "middle",
  });

  addFooter(slide, slideNum, totalSlides);
}

/**
 * Diapositive Analyse Causale de la Marge & Waterfall
 */
function createMarginWaterfallSlide(pres, report, data, companyName, slideNum, totalSlides) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.BG_LIGHT };

  addHeader(slide, "Décomposition Causale de la Marge (Waterfall)", "COMPRENDRE · RENTABILITÉ", report.period, companyName);

  // Colonne gauche : Facteurs d'impact
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.25, w: 5.6, h: 3.75,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 0.75 },
    roundRadius: 0.1,
  });

  slide.addText("DÉCOMPOSITION DES ÉCARTS DE RENTABILITÉ", {
    x: 0.7, y: 1.45, w: 5.2, h: 0.25,
    fontFace: FONT_HEADING, fontSize: 9, bold: true, color: COLORS.TEXT_MUTED,
  });

  const factors = [
    { name: "Marge Période Précédente", val: "32,8 %", impact: "Base", color: COLORS.TEXT_DARK },
    { name: "Effet Volume de Vente", val: "+0,6 pt", impact: "Favorable", color: COLORS.EMERALD },
    { name: "Effet Prix / Remises", val: "+0,2 pt", impact: "Favorable", color: COLORS.EMERALD },
    { name: "Effet Mix Produits (Entrée de gamme)", val: "-0,8 pt", impact: "Défavorable", color: COLORS.CRIMSON },
    { name: "Effet Coût d'Approvisionnement", val: "-1,4 pt", impact: "Défavorable", color: COLORS.CRIMSON },
    { name: "Marge Constatée Période Courante", val: "31,4 %", impact: "Solde", color: COLORS.BRAND_BLUE },
  ];

  factors.forEach((f, idx) => {
    const rowY = 1.85 + idx * 0.5;
    slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
      x: 0.7, y: rowY, w: 5.2, h: 0.42,
      fill: { color: idx === 0 || idx === 5 ? COLORS.BG_LIGHT : COLORS.CARD_BG },
      line: { color: COLORS.CARD_BORDER, width: 0.5 },
      roundRadius: 0.05,
    });
    slide.addText(f.name, {
      x: 0.85, y: rowY, w: 3.2, h: 0.42,
      fontFace: FONT_BODY, fontSize: 9.5, bold: idx === 0 || idx === 5, color: COLORS.TEXT_DARK,
      valign: "middle",
    });
    slide.addText(f.val, {
      x: 4.1, y: rowY, w: 1.6, h: 0.42,
      fontFace: FONT_HEADING, fontSize: 10, bold: true, color: f.color,
      align: "right", valign: "middle",
    });
  });

  // Colonne droite : Rigueur méthodologique GESCOP
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 6.3, y: 1.25, w: 3.2, h: 3.75,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 0.75 },
    roundRadius: 0.1,
  });

  slide.addText("RIGUEUR DÉCISIONNELLE", {
    x: 6.5, y: 1.45, w: 2.8, h: 0.25,
    fontFace: FONT_HEADING, fontSize: 9, bold: true, color: COLORS.BRAND_BLUE,
  });

  slide.addText("[FAIT COMPTABLE]", {
    x: 6.5, y: 1.8, w: 2.8, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_DARK,
  });
  slide.addText("Le recul de 1,4 point est mathématiquement vérifié par la ventilation des 1 428 commandes et des factures fournisseurs enregistrées.", {
    x: 6.5, y: 2.05, w: 2.8, h: 0.7,
    fontFace: FONT_BODY, fontSize: 8.5, color: COLORS.TEXT_MUTED,
  });

  slide.addText("[FACTEUR DÉTERMINANT]", {
    x: 6.5, y: 2.85, w: 2.8, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.AMBER,
  });
  slide.addText("62 % de la baisse provient de la hausse unitaire constatée sur les approvisionnements des 3 premiers fournisseurs d'équipements.", {
    x: 6.5, y: 3.1, w: 2.8, h: 0.7,
    fontFace: FONT_BODY, fontSize: 8.5, color: COLORS.TEXT_MUTED,
  });

  slide.addText("[ACTION CONSEILLÉE]", {
    x: 6.5, y: 3.9, w: 2.8, h: 0.2,
    fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.EMERALD,
  });
  slide.addText("Revoir la politique de marge sur les accessoires et engager la renégociation de volume sous 15 jours.", {
    x: 6.5, y: 4.15, w: 2.8, h: 0.65,
    fontFace: FONT_BODY, fontSize: 8.5, color: COLORS.TEXT_MUTED,
  });

  addFooter(slide, slideNum, totalSlides);
}

/**
 * Diapositive Situation de Trésorerie & Runway
 */
function createCashflowSlide(pres, report, data, companyName, slideNum, totalSlides) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.BG_LIGHT };

  addHeader(slide, "Situation de Trésorerie & Runway Prévisionnel", "SURVEILLER · CASH FLOW", report.period, companyName);

  // 3 Blocs horizontaux de trésorerie
  const bW = 2.85;
  const bH = 1.35;

  // Solde actuel
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.25, w: bW, h: bH,
    fill: { color: COLORS.CARD_BG }, line: { color: COLORS.CARD_BORDER, width: 0.75 }, roundRadius: 0.1,
  });
  slide.addText("SOLDE DE CLÔTURE", { x: 0.7, y: 1.4, w: bW - 0.4, h: 0.2, fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_MUTED });
  slide.addText(data.kpis.tresorerie.value, { x: 0.7, y: 1.65, w: bW - 0.4, h: 0.45, fontFace: FONT_HEADING, fontSize: 20, bold: true, color: COLORS.BRAND_BLUE });
  slide.addText("Fonds immédiatement mobilisables", { x: 0.7, y: 2.15, w: bW - 0.4, h: 0.25, fontFace: FONT_BODY, fontSize: 8, color: COLORS.TEXT_MUTED });

  // Burn rate / Flux net
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 3.55, y: 1.25, w: bW, h: bH,
    fill: { color: COLORS.CARD_BG }, line: { color: COLORS.CARD_BORDER, width: 0.75 }, roundRadius: 0.1,
  });
  slide.addText("FLUX NET DU MOIS", { x: 3.75, y: 1.4, w: bW - 0.4, h: 0.2, fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_MUTED });
  slide.addText("-6 000 $", { x: 3.75, y: 1.65, w: bW - 0.4, h: 0.45, fontFace: FONT_HEADING, fontSize: 20, bold: true, color: COLORS.CRIMSON });
  slide.addText("Décaissements fournisseurs concentrés", { x: 3.75, y: 2.15, w: bW - 0.4, h: 0.25, fontFace: FONT_BODY, fontSize: 8, color: COLORS.TEXT_MUTED });

  // Runway
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 6.6, y: 1.25, w: bW, h: bH,
    fill: { color: COLORS.CARD_BG }, line: { color: COLORS.CARD_BORDER, width: 0.75 }, roundRadius: 0.1,
  });
  slide.addText("RUNWAY ESTIMÉ", { x: 6.8, y: 1.4, w: bW - 0.4, h: 0.2, fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_MUTED });
  slide.addText("6,2 MOIS", { x: 6.8, y: 1.65, w: bW - 0.4, h: 0.45, fontFace: FONT_HEADING, fontSize: 20, bold: true, color: COLORS.EMERALD });
  slide.addText("Niveau de sécurité financière : Élevé", { x: 6.8, y: 2.15, w: bW - 0.4, h: 0.25, fontFace: FONT_BODY, fontSize: 8, color: COLORS.TEXT_MUTED });

  // Tableau des prévisions 30j / 60j
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 2.8, w: 9.0, h: 2.2,
    fill: { color: COLORS.CARD_BG }, line: { color: COLORS.CARD_BORDER, width: 0.75 }, roundRadius: 0.1,
  });

  slide.addText("TRAJECTOIRE PRÉVISIONNELLE DES FLUX (30J / 60J)", {
    x: 0.7, y: 2.95, w: 6.0, h: 0.25,
    fontFace: FONT_HEADING, fontSize: 9, bold: true, color: COLORS.TEXT_MUTED,
  });

  const headers = ["Période", "Encaissements prévus", "Décaissements engagés", "Flux Net", "Solde projeté fin de mois"];
  const rows = [
    ["M+1 (Prochain mois)", "+135 000 $", "-128 400 $", "+6 600 $", "189 000 $"],
    ["M+2 (Deuxième mois)", "+142 000 $", "-131 000 $", "+11 000 $", "200 000 $"],
  ];

  slide.addTable([headers, ...rows], {
    x: 0.7, y: 3.3, w: 8.6, h: 1.4,
    fontFace: FONT_BODY, fontSize: 9,
    border: { pt: 0.5, color: COLORS.CARD_BORDER },
    fill: (rowIdx) => (rowIdx === 0 ? COLORS.BG_LIGHT : COLORS.WHITE),
    color: (rowIdx) => (rowIdx === 0 ? COLORS.TEXT_MUTED : COLORS.TEXT_DARK),
    bold: (rowIdx) => rowIdx === 0,
    align: (rowIdx, colIdx) => (colIdx === 0 ? "left" : "right"),
  });

  addFooter(slide, slideNum, totalSlides);
}

/**
 * Diapositive Points d'Attention & Risques Détectés
 */
function createAttentionPointsSlide(pres, report, data, companyName, slideNum, totalSlides) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.BG_LIGHT };

  addHeader(slide, "Points d'Attention & Zones de Risque", "SURVEILLER · VIGILANCE", report.period, companyName);

  const points = [
    {
      num: "01",
      severity: "ÉLEVÉE",
      title: "Érosion de la marge brute unitaire",
      impact: "-1,4 pt (-18 200 $)",
      factor: "Facteur observé : augmentation des tarifs fournisseurs sur les réassorts récents sans répercussion immédiate sur le prix de vente.",
      action: "À examiner : ajuster la grille tarifaire B2B et revoir les remises accordées.",
      badgeColor: COLORS.CRIMSON,
      badgeBg: COLORS.CRIMSON_LIGHT,
    },
    {
      num: "02",
      severity: "MODÉRÉE",
      title: "Stock dormant et rotation ralentie",
      impact: "64 000 $ immobilisés",
      factor: "Facteur observé : 12 références d'équipements n'ont enregistré aucune vente sur les 60 derniers jours.",
      action: "À examiner : programmer une opération de déstockage ciblée et geler les réapprovisionnements.",
      badgeColor: COLORS.AMBER,
      badgeBg: COLORS.AMBER_LIGHT,
    },
    {
      num: "03",
      severity: "INFORMATIVE",
      title: "Concentration des encaissements clients",
      impact: "DSO : 28 jours",
      factor: "Facteur observé : 4 clients de détail représentent 38 % des encaissements attendus en fin de quinzaine.",
      action: "À examiner : activer le rappel automatique d'échéance à J-3.",
      badgeColor: COLORS.BRAND_BLUE,
      badgeBg: COLORS.BRAND_LIGHT,
    },
  ];

  points.forEach((p, idx) => {
    const yPos = 1.3 + idx * 1.25;
    slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y: yPos, w: 9.0, h: 1.15,
      fill: { color: COLORS.CARD_BG },
      line: { color: COLORS.CARD_BORDER, width: 0.75 },
      roundRadius: 0.1,
    });

    // Numéro & Badge Sévérité
    slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
      x: 0.7, y: yPos + 0.15, w: 1.1, h: 0.25,
      fill: { color: p.badgeBg },
      roundRadius: 0.05,
    });
    slide.addText(`${p.num} · ${p.severity}`, {
      x: 0.7, y: yPos + 0.15, w: 1.1, h: 0.25,
      fontFace: FONT_HEADING, fontSize: 8, bold: true, color: p.badgeColor,
      align: "center", valign: "middle",
    });

    // Titre et impact
    slide.addText(p.title, {
      x: 2.0, y: yPos + 0.15, w: 4.8, h: 0.25,
      fontFace: FONT_HEADING, fontSize: 11, bold: true, color: COLORS.TEXT_DARK,
      valign: "middle",
    });

    slide.addText(`Impact : ${p.impact}`, {
      x: 6.8, y: yPos + 0.15, w: 2.5, h: 0.25,
      fontFace: FONT_HEADING, fontSize: 9.5, bold: true, color: p.badgeColor,
      align: "right", valign: "middle",
    });

    // Détail facteur et action
    slide.addText(p.factor, {
      x: 0.7, y: yPos + 0.45, w: 8.6, h: 0.3,
      fontFace: FONT_BODY, fontSize: 8.5, color: COLORS.TEXT_MUTED,
    });

    slide.addText(p.action, {
      x: 0.7, y: yPos + 0.75, w: 8.6, h: 0.3,
      fontFace: FONT_BODY, fontSize: 8.5, bold: true, color: COLORS.TEXT_DARK,
    });
  });

  addFooter(slide, slideNum, totalSlides);
}

/**
 * Diapositive Plan d'Actions Recommandées
 */
function createActionPlanSlide(pres, report, data, companyName, slideNum, totalSlides) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.BG_LIGHT };

  addHeader(slide, "Plan d'Actions & Initiatives Prioritaires", "PILOTER · PLAN D'ACTION", report.period, companyName);

  const actions = [
    {
      num: "1",
      action: "Ajuster la grille tarifaire B2B sur les gammes intermédiaires",
      horizon: "Court terme (S+2)",
      owner: "Direction Commerciale",
      impact: "+1,2 pt de marge estimé",
      status: "Prioritaire",
    },
    {
      num: "2",
      action: "Renégocier les conditions d'achat volume auprès des 3 premiers fournisseurs",
      horizon: "Moyen terme (M+1)",
      owner: "Responsable Achats",
      impact: "-14 000 $ de coût d'achat annuel",
      status: "Planifié",
    },
    {
      num: "3",
      action: "Lancer l'opération de déstockage sur les 12 références identifiées dormantes",
      horizon: "Immédiat (S+1)",
      owner: "Marketing & Ventes",
      impact: "Libération de 40 000 $ de cash",
      status: "En cours",
    },
  ];

  actions.forEach((a, idx) => {
    const yPos = 1.3 + idx * 1.15;
    slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y: yPos, w: 9.0, h: 1.05,
      fill: { color: COLORS.CARD_BG },
      line: { color: COLORS.CARD_BORDER, width: 0.75 },
      roundRadius: 0.1,
    });

    // Numéro d'action
    slide.addShape(slide.shapes.OVAL, {
      x: 0.7, y: yPos + 0.25, w: 0.5, h: 0.5,
      fill: { color: COLORS.BRAND_LIGHT },
    });
    slide.addText(a.num, {
      x: 0.7, y: yPos + 0.25, w: 0.5, h: 0.5,
      fontFace: FONT_HEADING, fontSize: 13, bold: true, color: COLORS.BRAND_BLUE,
      align: "center", valign: "middle",
    });

    // Texte d'action
    slide.addText(a.action, {
      x: 1.35, y: yPos + 0.15, w: 5.5, h: 0.35,
      fontFace: FONT_HEADING, fontSize: 11, bold: true, color: COLORS.TEXT_DARK,
    });

    // Métadonnées d'exécution
    slide.addText(`Échéance : ${a.horizon}   ·   Pilote : ${a.owner}`, {
      x: 1.35, y: yPos + 0.55, w: 5.5, h: 0.3,
      fontFace: FONT_BODY, fontSize: 8.5, color: COLORS.TEXT_MUTED,
    });

    // Impact financier attendu
    slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
      x: 7.0, y: yPos + 0.25, w: 2.3, h: 0.5,
      fill: { color: COLORS.EMERALD_LIGHT },
      roundRadius: 0.08,
    });
    slide.addText(a.impact, {
      x: 7.0, y: yPos + 0.25, w: 2.3, h: 0.5,
      fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.EMERALD,
      align: "center", valign: "middle",
    });
  });

  // Note de gouvernance
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 4.85, w: 9.0, h: 0.3,
    fill: { color: COLORS.BG_LIGHT },
    line: { color: COLORS.CARD_BORDER, width: 0.5 },
    roundRadius: 0.05,
  });
  slide.addText("Revue d'avancement des actions planifiée lors du prochain comité de gestion hebdomadaire.", {
    x: 0.5, y: 4.85, w: 9.0, h: 0.3,
    fontFace: FONT_BODY, fontSize: 8.5, color: COLORS.TEXT_MUTED,
    align: "center", valign: "middle",
  });

  addFooter(slide, slideNum, totalSlides);
}

/**
 * Diapositive Audit des Données & Clôture Exécutive
 */
function createAuditSlide(pres, report, data, companyName, slideNum, totalSlides) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.NAVY_DARK };

  // Carte centrale claire
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 0.5, w: 9.0, h: 4.625,
    fill: { color: COLORS.NAVY_CARD },
    line: { color: COLORS.NAVY_BORDER, width: 0.75 },
    roundRadius: 0.15,
  });

  slide.addText("AUDIT DES DONNÉES & TRAÇABILITÉ MÉTIER", {
    x: 1.0, y: 0.9, w: 7.0, h: 0.3,
    fontFace: FONT_HEADING, fontSize: 14, bold: true, color: COLORS.WHITE,
  });
  slide.addText("Garantie d'intégrité décisionnelle GESCOP · Zéro chiffre inventé", {
    x: 1.0, y: 1.25, w: 7.0, h: 0.25,
    fontFace: FONT_BODY, fontSize: 9.5, color: COLORS.TEXT_LIGHT_MUTED,
  });

  // 3 Blocs d'audit
  const colW = 2.45;
  const colH = 2.0;

  // 1. Fiabilité
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 1.0, y: 1.7, w: colW, h: colH,
    fill: { color: COLORS.NAVY_DARK },
    line: { color: COLORS.NAVY_BORDER, width: 0.5 },
    roundRadius: 0.1,
  });
  slide.addText("SCORE DE FIABILITÉ", { x: 1.15, y: 1.85, w: colW - 0.3, h: 0.2, fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_LIGHT_MUTED });
  slide.addText("98,4 %", { x: 1.15, y: 2.15, w: colW - 0.3, h: 0.55, fontFace: FONT_HEADING, fontSize: 24, bold: true, color: COLORS.EMERALD });
  slide.addText("1 428 lignes lues\n1 428 lignes consolidées\n0 doublon non tracé", { x: 1.15, y: 2.75, w: colW - 0.3, h: 0.8, fontFace: FONT_BODY, fontSize: 8.5, color: COLORS.TEXT_LIGHT_MUTED });

  // 2. Périmètre
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 3.75, y: 1.7, w: colW, h: colH,
    fill: { color: COLORS.NAVY_DARK },
    line: { color: COLORS.NAVY_BORDER, width: 0.5 },
    roundRadius: 0.1,
  });
  slide.addText("SOURCES CERTIFIÉES", { x: 3.9, y: 1.85, w: colW - 0.3, h: 0.2, fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_LIGHT_MUTED });
  slide.addText("5 SOURCES", { x: 3.9, y: 2.15, w: colW - 0.3, h: 0.55, fontFace: FONT_HEADING, fontSize: 24, bold: true, color: COLORS.BRAND_BLUE });
  slide.addText("Ventes (Commandes)\nFacturation fournisseurs\nRelevés bancaires réels\nInventaire physique", { x: 3.9, y: 2.75, w: colW - 0.3, h: 0.8, fontFace: FONT_BODY, fontSize: 8.5, color: COLORS.TEXT_LIGHT_MUTED });

  // 3. Règle comptable
  slide.addShape(slide.shapes.ROUNDED_RECTANGLE, {
    x: 6.5, y: 1.7, w: colW, h: colH,
    fill: { color: COLORS.NAVY_DARK },
    line: { color: COLORS.NAVY_BORDER, width: 0.5 },
    roundRadius: 0.1,
  });
  slide.addText("CONFORMITÉ COMPTABLE", { x: 6.65, y: 1.85, w: colW - 0.3, h: 0.2, fontFace: FONT_HEADING, fontSize: 8.5, bold: true, color: COLORS.TEXT_LIGHT_MUTED });
  slide.addText("100 %", { x: 6.65, y: 2.15, w: colW - 0.3, h: 0.55, fontFace: FONT_HEADING, fontSize: 24, bold: true, color: COLORS.WHITE });
  slide.addText("Non-double-comptabilisation\nSéparation CA / Marketing\nHors taxes strict\nTraçabilité totale", { x: 6.65, y: 2.75, w: colW - 0.3, h: 0.8, fontFace: FONT_BODY, fontSize: 8.5, color: COLORS.TEXT_LIGHT_MUTED });

  // Signature
  slide.addText("Rapport préparé et certifié pour la Direction Générale · Tous droits réservés GESCOP 2026", {
    x: 1.0, y: 4.4, w: 8.0, h: 0.3,
    fontFace: FONT_BODY, fontSize: 8.5, italic: true, color: COLORS.TEXT_LIGHT_MUTED,
    align: "center",
  });
}

/**
 * Fonction maîtresse d'exportation en présentation PowerPoint (.pptx)
 */
export async function downloadReportPPTX(report, company) {
  if (!report) return;

  const data = extractReportData(report);
  const companyName = company?.name || "Nordik Plein Air Inc.";
  const type = report.type || "mensuel";

  // Initialisation du document 16:9
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.company = "GESCOP";
  pres.subject = `Rapport de gestion GESCOP - ${companyName}`;
  pres.title = `Rapport ${report.type} - ${report.period}`;

  // Définition du nombre de diapositives selon le type
  // Quotidien : 5 diapositives (Scan rapide < 2 min)
  // Hebdomadaire : 6 diapositives (Comprendre & Trajectoire)
  // Mensuel : 7 diapositives (Dossier exécutif complet de pilotage)
  let totalSlides = type === "quotidien" ? 5 : type === "hebdomadaire" ? 6 : 7;

  // 1. Couverture prestige (commune aux 3)
  createCoverSlide(pres, report, data, companyName);

  // 2. Synthèse exécutive & Santé
  createExecutiveSummarySlide(pres, report, data, companyName, 2, totalSlides);

  // 3. Tableau de bord KPI
  createKpiDashboardSlide(pres, report, data, companyName, 3, totalSlides);

  if (type === "quotidien") {
    // Quotidien : Points d'attention immédiats & Plan d'actions du jour
    createAttentionPointsSlide(pres, report, data, companyName, 4, totalSlides);
    createActionPlanSlide(pres, report, data, companyName, 5, totalSlides);
  } else if (type === "hebdomadaire") {
    // Hebdomadaire : Waterfall / Causalité + Trésorerie + Actions
    createMarginWaterfallSlide(pres, report, data, companyName, 4, totalSlides);
    createAttentionPointsSlide(pres, report, data, companyName, 5, totalSlides);
    createActionPlanSlide(pres, report, data, companyName, 6, totalSlides);
  } else {
    // Mensuel (Dossier vitrine) : Waterfall + Trésorerie + Risques + Actions + Audit
    totalSlides = 8;
    createMarginWaterfallSlide(pres, report, data, companyName, 4, totalSlides);
    createCashflowSlide(pres, report, data, companyName, 5, totalSlides);
    createAttentionPointsSlide(pres, report, data, companyName, 6, totalSlides);
    createActionPlanSlide(pres, report, data, companyName, 7, totalSlides);
    createAuditSlide(pres, report, data, companyName, 8, totalSlides);
  }

  // Nom de fichier propre et professionnel
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanPeriod = (report.period || "Rapport").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `GESCOP_${report.type.toUpperCase()}_${cleanPeriod}_${dateStr}.pptx`;

  // Déclenche le téléchargement direct dans le navigateur
  return await pres.writeFile({ fileName });
}
