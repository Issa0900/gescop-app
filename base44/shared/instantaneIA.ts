// Chiffres et constats envoyes par l'ecran (src/lib/core/instantane.js) : les
// KPI du moteur, identiques a ceux affiches, et les croisements deterministes.
// Bornes et typage stricts : ce sont des donnees, jamais des instructions.
const texte = (v: any, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, max);
export function lireInstantane(body: any) {
  const chiffres = (Array.isArray(body?.chiffres) ? body.chiffres : []).slice(0, 150).map((c: any) => ({
    nom: texte(c?.nom, 120),
    periode: texte(c?.periode, 60),
    valeur: typeof c?.valeur === "number" && Number.isFinite(c.valeur) ? c.valeur : c?.valeur == null ? null : texte(c.valeur, 30),
    unite: texte(c?.unite, 10),
    statut: texte(c?.statut, 30),
  })).filter((c: any) => c.nom);
  const niveaux = ["critique", "important", "modere"];
  const constats = (Array.isArray(body?.constats) ? body.constats : []).slice(0, 20).map((c: any) => ({
    niveau: niveaux.includes(c?.niveau) ? c.niveau : "modere",
    titre: texte(c?.titre, 200),
    constat: texte(c?.constat, 1200),
    action: texte(c?.action, 400),
  })).filter((c: any) => c.titre);
  return { chiffres, constats };
}

export function blocInstantane({ chiffres, constats }: any, qualitatif: any, relations: any[]) {
  const lignes: string[] = [];
  if (chiffres.length) {
    lignes.push("CHIFFRES CALCULÉS PAR GESCOP (identiques à ceux affichés à l'utilisateur — ils font foi) :");
    for (const c of chiffres) lignes.push(`- ${c.nom} (${c.periode}) : ${c.valeur === null ? "non mesuré" : `${c.valeur} ${c.unite}`.trim()} [${c.statut}]`);
  }
  if (constats.length) {
    lignes.push("", "CONSTATS CROISÉS (calculés en comparant deux sources, déterministes) :");
    for (const c of constats) lignes.push(`- [${c.niveau}] ${c.titre} — ${c.constat} Action proposée : ${c.action}`);
  }
  if (qualitatif) {
    lignes.push("", `SIGNAUX QUALITATIFS : ${qualitatif.totalAnalyzed} observations textuelles analysées, ${qualitatif.negativeCount} négatives, dont ${Math.round(qualitatif.priceSensitivityRatio)} % portent sur le prix.`);
  }
  if (relations?.length) {
    lignes.push("", "RELATIONS ENTRE DONNÉES CHIFFRÉES, QUALITATIVES ET EXTERNES :");
    for (const r of relations.slice(0, 20)) lignes.push(`- ${texte(r.description, 300)} (force ${Math.round((r.strength || 0) * 100)} %)`);
  }
  return lignes.join("\n");
}
