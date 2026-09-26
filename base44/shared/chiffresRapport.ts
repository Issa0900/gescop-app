// Chiffres d'un rapport envoyes par l'ecran (src/lib/core/rapportChiffres.js) :
// les KPI du moteur sur la periode du rapport, identiques a ceux de la page
// Indicateurs. generateReport ne calcule plus ses propres totaux (revenus =
// transactions seulement, marge = revenus - depenses, CA TTC) : il valide ces
// chiffres, les stocke dans le rapport et les donne a l'IA, qui les commente.
// Bornes et typage stricts : ce sont des donnees, jamais des instructions.

const texte = (v: any, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, max);
const nombre = (v: any) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const date = (v: any) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const STATUTS = ["mesuré", "partiel", "non mesuré"];
const statut = (v: any) => (STATUTS.includes(v) ? v : "non mesuré");
const periode = (p: any) => (p && date(p.debut) && date(p.fin) ? { debut: p.debut, fin: p.fin, libelle: texte(p.libelle, 80) } : null);
const TYPES = ["quotidien", "hebdomadaire", "mensuel"];

export function lireChiffresRapport(body: any) {
  const c = body?.chiffres;
  if (!c || typeof c !== "object" || !Array.isArray(c.indicateurs)) return null;
  const indicateurs = c.indicateurs.slice(0, 40).map((i: any) => ({
    id: texte(i?.id, 60),
    nom: texte(i?.nom, 120),
    unite: texte(i?.unite, 6),
    baisseFavorable: i?.baisseFavorable === true,
    courant: {
      valeur: nombre(i?.courant?.valeur),
      statut: nombre(i?.courant?.valeur) === null ? "non mesuré" : statut(i?.courant?.statut),
      ...(i?.courant?.note ? { note: texte(i.courant.note, 200) } : {}),
    },
    precedent: i?.precedent ? {
      valeur: nombre(i.precedent.valeur),
      statut: nombre(i.precedent.valeur) === null ? "non mesuré" : statut(i.precedent.statut),
    } : null,
  })).filter((i: any) => i.id && i.nom);
  const couverture: Record<string, number> = {};
  for (const [k, v] of Object.entries(c.couverture || {}).slice(0, 30)) {
    if (/^[A-Za-z]{1,40}$/.test(k) && nombre(v) !== null) couverture[k] = Math.max(0, Math.round(v as number));
  }
  const niveaux = ["critique", "important", "modere"];
  return {
    version: nombre(c.version) ?? 1,
    type: TYPES.includes(c.type) ? c.type : null,
    periode: periode(c.periode),
    precedente: periode(c.precedente),
    base: texte(c.base, 300),
    indicateurs,
    serie: (Array.isArray(c.serie) ? c.serie : []).slice(0, 24).map((s: any) => ({
      libelle: texte(s?.libelle, 80), debut: date(s?.debut), fin: date(s?.fin), ca: nombre(s?.ca), margePct: nombre(s?.margePct),
    })),
    couverture,
    constats: (Array.isArray(c.constats) ? c.constats : []).slice(0, 10).map((k: any) => ({
      niveau: niveaux.includes(k?.niveau) ? k.niveau : "modere",
      titre: texte(k?.titre, 200), constat: texte(k?.constat, 1200), action: texte(k?.action, 400),
    })).filter((k: any) => k.titre),
  };
}

/**
 * Comparaison au format lu par ReportComparison.jsx et l'export PDF
 * (metrics : key, label, current, previous, delta, deltaPct, trend, unit,
 * invert). Une valeur non mesuree d'un cote ou de l'autre n'a pas de
 * variation : « non-mesurable », jamais un -100 %.
 */
export function comparaisonDepuisChiffres(ch: any) {
  const metrics = ch.indicateurs.filter((i: any) => i.precedent).map((i: any) => {
    const cur = i.courant.valeur, prev = i.precedent.valeur;
    const base = { key: i.id, label: i.nom, current: cur, previous: prev, unit: i.unite, invert: i.baisseFavorable };
    if (cur === null || prev === null) return { ...base, delta: null, deltaPct: null, trend: "non-mesurable" };
    const delta = Math.round((cur - prev) * 100) / 100;
    const deltaPct = i.unite === "%" || prev === 0 ? null : Math.round((delta / Math.abs(prev)) * 1000) / 10;
    const trend = delta === 0 ? "stable" : (delta > 0) !== i.baisseFavorable ? "up" : "down";
    return { ...base, delta, deltaPct, trend };
  });
  return {
    currentLabel: ch.periode?.libelle || "",
    previousLabel: ch.precedente?.libelle || "",
    currentRange: ch.periode ? { start: ch.periode.debut, end: ch.periode.fin } : null,
    previousRange: ch.precedente ? { start: ch.precedente.debut, end: ch.precedente.fin } : null,
    metrics,
  };
}

const fmt = (v: number | null, unite: string) => (v === null ? "non mesuré" : `${v}${unite === "%" ? " %" : unite ? ` ${unite}` : ""}`);

export function blocChiffresRapport(ch: any) {
  const lignes: string[] = [];
  lignes.push(`PÉRIODE DU RAPPORT : ${ch.periode ? `${ch.periode.libelle} (${ch.periode.debut} → ${ch.periode.fin})` : "aucune donnée datée"}`);
  if (ch.base) lignes.push(`Choix de la période : ${ch.base}`);
  if (ch.precedente) lignes.push(`PÉRIODE DE COMPARAISON : ${ch.precedente.libelle} (${ch.precedente.debut} → ${ch.precedente.fin})`);
  lignes.push("", "CHIFFRES CALCULÉS PAR GESCOP (identiques à ceux affichés dans le rapport — ils font foi) :");
  for (const i of ch.indicateurs) {
    const prec = i.precedent ? ` | période précédente : ${fmt(i.precedent.valeur, i.unite)}` : "";
    const note = i.courant.note ? ` — ${i.courant.note}` : "";
    lignes.push(`- ${i.nom} : ${fmt(i.courant.valeur, i.unite)} [${i.courant.statut}]${prec}${note}`);
  }
  const serie = ch.serie.filter((s: any) => s.ca !== null || s.margePct !== null);
  if (serie.length) {
    lignes.push("", "ÉVOLUTION (chiffre d'affaires HT, taux de marge brute) :");
    for (const s of serie) lignes.push(`- ${s.libelle} : CA ${fmt(s.ca, "$")}, marge ${fmt(s.margePct, "%")}`);
  }
  const cov = Object.entries(ch.couverture);
  if (cov.length) lignes.push("", `LIGNES DE DONNÉES DE LA PÉRIODE : ${cov.map(([k, v]) => `${k} ${v}`).join(", ")}`);
  if (ch.constats.length) {
    lignes.push("", "CONSTATS CROISÉS (calculés en comparant deux sources, déterministes) :");
    for (const c of ch.constats) lignes.push(`- [${c.niveau}] ${c.titre} — ${c.constat} Action proposée : ${c.action}`);
  }
  return lignes.join("\n");
}
