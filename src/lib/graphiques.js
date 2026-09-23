// Regles communes des graphiques (phase 3 de l'audit visuel, 23 sept 2026).
//
// Constat en production : axes bruts (« 2025-10 », « 150000 »), codes
// techniques en legende (« google_ads »), 75 couleurs ecrites en dur, une meme
// grandeur bleue ici et verte la, deux echelles sur un meme axe. Chaque
// graphique passe desormais par ce module : formats fr-CA, une couleur par
// ENTITE (le CA est bleu partout), axes et infobulles communs, et la palette
// validee (daltonisme) portee par les variables CSS --chart-1..8 d'index.css,
// qui ont leur propre version en mode sombre.

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const RE_MOIS = /^(\d{4})-(\d{2})/;

/** « 2025-10 » -> « oct. 2025 » ; toute autre valeur est rendue telle quelle. */
export function moisLisible(v) {
  const m = RE_MOIS.exec(String(v ?? ""));
  if (!m) return String(v ?? "");
  return `${MOIS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Libelle d'axe court : « oct. 25 ». */
export function moisAxe(v) {
  const m = RE_MOIS.exec(String(v ?? ""));
  if (!m) return String(v ?? "");
  return `${MOIS[Number(m[2]) - 1]} ${m[1].slice(2)}`;
}

const nf = (d) => new Intl.NumberFormat("fr-CA", { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Montant complet : « 150 000 $ » (infobulles, tableaux). */
export function montant(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return `${nf(0).format(Math.round(Number(v)))} $`;
}

/** Montant d'axe : « 850 $ », « 12 k$ », « 1,2 M$ ». */
export function montantCourt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const a = Math.abs(n);
  if (a >= 1e6) return `${nf(a >= 1e7 ? 0 : 1).format(n / 1e6)} M$`;
  if (a >= 1e3) return `${nf(a >= 1e4 ? 0 : 1).format(n / 1e3)} k$`;
  return `${nf(0).format(n)} $`;
}

/** « 12,5 % » (valeur deja en pourcentage). */
export function pourcent(v, d = 1) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return `${nf(d).format(Number(v))} %`;
}

/** Nombre entier lisible : « 1 234 ». */
export function nombre(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return nf(0).format(Number(v));
}

const SIGLES = { seo: "SEO", sms: "SMS", sem: "SEM", b2b: "B2B", b2c: "B2C", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", ads: "Ads", rh: "RH", tps: "TPS", tvq: "TVQ" };
/** Code technique -> libelle : « google_ads » -> « Google Ads », « meta-ads » -> « Meta Ads ». */
export function libelleCode(v) {
  const s = String(v ?? "").trim();
  if (!s || /\s/.test(s) && s !== s.toLowerCase()) return s;
  return s.split(/[_\-\s]+/).filter(Boolean)
    .map((mot) => SIGLES[mot.toLowerCase()] || mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase())
    .join(" ");
}

/** Couleur d'un emplacement de la palette validee (1..8). */
export const couleur = (n) => `hsl(var(--chart-${n}))`;

// Une couleur par ENTITE, la meme sur toutes les pages : un lecteur qui a vu
// le CA en bleu sur Finance le retrouve en bleu sur la page KPI.
export const COULEURS = {
  revenus: couleur(1),
  charges: couleur(2),
  resultat: couleur(3),
  tresorerie: couleur(3),
  panier: couleur(5),
  ratio: couleur(5),
  paie: couleur(7),
  // Quantites (unites, commandes, effectifs) : une teinte distincte du CA.
  volume: couleur(7),
  effectif: couleur(3),
};

export const STATUT = {
  bon: "hsl(var(--status-good))",
  vigilance: "hsl(var(--status-warning))",
  serieux: "hsl(var(--status-serious))",
  critique: "hsl(var(--status-critical))",
};

/**
 * Categories (canal, segment, departement...) : couleurs dans l'ordre FIXE de
 * la palette, jamais recyclees. Au-dela de `max`, les plus petites sont
 * regroupees en « Autres ».
 */
export function plierAutres(lignes, cleValeur, max = 6, libelle = "Autres") {
  const tri = [...(lignes || [])].sort((a, b) => (Number(b[cleValeur]) || 0) - (Number(a[cleValeur]) || 0));
  if (tri.length <= max) return tri;
  const gardes = tri.slice(0, max - 1);
  const reste = tri.slice(max - 1).reduce((s, l) => s + (Number(l[cleValeur]) || 0), 0);
  return [...gardes, { name: libelle, [cleValeur]: reste, _autres: true }];
}
export const couleurCategorie = (i) => couleur(Math.min(i, 7) + 1);

// Reglages communs (recharts).
export const AXE = { tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" }, tickLine: false, axisLine: false, tickMargin: 8 };
export const AXE_MOIS = { ...AXE, tickFormatter: moisAxe, minTickGap: 12 };
export const AXE_MONTANT = { ...AXE, tickFormatter: montantCourt, width: 64 };
export const AXE_POURCENT = { ...AXE, tickFormatter: (v) => `${nf(0).format(v)} %`, width: 52 };
export const GRILLE = { stroke: "hsl(var(--chart-grid))", vertical: false };
export const INFOBULLE = {
  contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" },
  labelStyle: { color: "hsl(var(--muted-foreground))", marginBottom: 4 },
  cursor: { fill: "hsl(var(--muted))", opacity: 0.5 },
  labelFormatter: moisLisible,
};
export const INFOBULLE_LIGNE = { ...INFOBULLE, cursor: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "3 3" } };
export const LEGENDE = { wrapperStyle: { fontSize: 12, paddingTop: 8 }, iconType: "circle", iconSize: 8 };
// Barres : extremites arrondies cote donnees, 2 px d'ecart entre barres voisines.
export const BARRE = { radius: [4, 4, 0, 0], maxBarSize: 36 };
export const BARRE_H = { radius: [0, 4, 4, 0], maxBarSize: 22 };
export const LIGNE = { type: "monotone", strokeWidth: 2, dot: false, activeDot: { r: 4 } };

/** Nombre de mois montres par les graphiques d'evolution, partout pareil. */
export const FENETRE_MOIS = 12;
