// Reconnaissance par ensemble de preuves (directives §4, §5, §6, §15, §16, §22).
//
// Deux decisions du moteur d'import reposaient sur un seul indice :
//   - le TYPE d'une feuille : la premiere signature d'en-tetes trouvee gagnait.
//     Une feuille « Ventes » de 18 colonnes partait en Customer parce qu'elle
//     contenait « ID Client » ;
//   - le CHAMP d'une colonne : le nom suffisait, meme quand les valeurs le
//     contredisaient, et deux colonnes visant le meme champ s'ecrasaient
//     (« ID Client » puis « Client » : customer_id = « Leblanc, Gabriel »).
//
// Ici chaque decision est un score construit uniquement a partir de preuves
// observees, et chaque preuve est conservee pour etre montree. Aucun score n'est
// releve artificiellement : faute de preuves, le statut reste PROBABLE,
// AMBIGUOUS ou UNKNOWN — mieux vaut « inconnu » qu'une mauvaise interpretation.

import { ENTITY_SCHEMAS } from "../../entitySchemas.ts";
import { rattacherParLexique } from "../../registry/lexiqueChamps.ts";
import {
  champDEntete, entitesEvoqueesParNom, parseNumber, parseDate, coerceEnumDetail,
  HEADER_SIGNATURES, stripAccents, cleCanonique, FIELD_ALIASES, ALIAS_CANONIQUES,
} from "../../importUtils.ts";

export type TypePreuve = "NOM" | "TYPE" | "VALEURS" | "CONTEXTE" | "HUMAIN" | "CONFLIT" | "MATHEMATIQUE" | "RELATION";
export interface Preuve { type: TypePreuve; detail: string; points: number }

export type StatutColonne = "CONFIRMED" | "PROBABLE" | "AMBIGUOUS" | "UNKNOWN";

// ---------------------------------------------------------------------------
// 1. Le type de la feuille
// ---------------------------------------------------------------------------

/**
 * Un champ obligatoire peut etre porte par une colonne d'un autre nom que la
 * normalisation rattache deja a ce champ (normalizeKeys : un « transaction_id »
 * devient order_id sur Order). La detection doit connaitre la meme equivalence,
 * sinon elle juge « impossible » une entite que l'import saurait remplir.
 */
const EQUIVALENCES_REQUISES: Record<string, Record<string, string[]>> = {
  Order: { order_id: ["transaction_id", "invoice_id", "numero_facture", "no_facture"] },
  // normalizeRow (crochet Product) et les alias rattachent deja un SKU a product_id.
  Product: { product_id: ["sku", "ugs", "code_produit"] },
  Inventory: { product_id: ["sku", "ugs", "code_produit"] },
};

const TOUS_LES_CHAMPS = new Set(Object.values(ENTITY_SCHEMAS).flatMap((s) => Object.keys(s.properties)));

/**
 * Le champ qu'un intitule designe, resolu comme l'import le resoudra
 * (dictionnaire de l'entreprise, alias, forme canonique). La detection avait sa
 * propre table, plus pauvre : « Code Produit », « Prix Unitaire ($) » ou
 * « ID Transaction » n'y etaient rien, et une feuille de ventes paraissait ne
 * contenir qu'un identifiant client.
 */
export function champProbable(entete: string, companyDictionary?: Record<string, string>): string {
  const canon = cleCanonique(entete);
  if (companyDictionary?.[canon]) return companyDictionary[canon];
  const detecte = champDEntete(entete, companyDictionary);
  if (TOUS_LES_CHAMPS.has(detecte)) return detecte;
  const lower = String(entete || "").toLowerCase().trim();
  return FIELD_ALIASES[lower] || FIELD_ALIASES[canon] || ALIAS_CANONIQUES[canon] || detecte;
}

export interface CandidatEntite {
  entite: string;
  score: number;
  eligible: boolean;
  preuves: Preuve[];
  manquants: string[];
}

export function classerEntites(
  entetes: string[],
  nomFeuille: string,
  companyDictionary?: Record<string, string>,
): CandidatEntite[] {
  const remplis = entetes.map((h) => String(h ?? "").trim()).filter(Boolean);
  const champsGeneriques = remplis.map((h) => champProbable(h, companyDictionary));
  const nomOnglet = /\[([^\]]+)\]\s*$/.exec(nomFeuille || "")?.[1] ?? "";
  const feuilleNommee = stripAccents(nomOnglet.toLowerCase()).replace(/[^a-z]/g, "");
  const evoquees = new Set(entitesEvoqueesParNom(nomFeuille));
  const out: CandidatEntite[] = [];

  for (const [entite, schema] of Object.entries(ENTITY_SCHEMAS)) {
    // Le lexique par mots est propre a chaque entite : une feuille de paie
    // (« gross_salary », « pay_date », « total_employer_cost ») n'est lisible
    // comme Payroll qu'avec le vocabulaire de Payroll.
    const lexique = rattacherParLexique(entite, remplis);
    const champs = remplis.map((h, i) => lexique.get(h) || champsGeneriques[i]);
    const presents = new Set(champs);
    const proprietes = new Set(Object.keys(schema.properties).filter((f) => f !== "import_id"));
    const equivalences = EQUIVALENCES_REQUISES[entite] || {};
    const preuves: Preuve[] = [];

    const manquants = (schema.required || []).filter((r) => !presents.has(r) && !(equivalences[r] || []).some((e) => presents.has(e)));
    const expliquees = champs.filter((c) => proprietes.has(c) || Object.values(equivalences).some((l) => l.includes(c)));
    if (expliquees.length === 0 && !evoquees.has(entite)) continue;

    const couverture = remplis.length > 0 ? expliquees.length / remplis.length : 0;
    const pointsCouverture = Math.round(60 * couverture);
    if (pointsCouverture > 0) {
      preuves.push({ type: "CONTEXTE", detail: `${expliquees.length}/${remplis.length} colonnes correspondent à des champs de ${entite}`, points: pointsCouverture });
    }
    if (evoquees.has(entite)) preuves.push({ type: "NOM", detail: `le nom « ${nomFeuille} » évoque ${entite}`, points: 25 });
    // Une feuille qui porte exactement le nom d'une entite (« CampaignDaily »,
    // « Payroll », « Purchase ») est un indice plus fort qu'une evocation :
    // sans lui, « CampaignDaily » evoquait autant Campaign que CampaignDaily.
    if (feuilleNommee && (feuilleNommee === entite.toLowerCase() || feuilleNommee === entite.toLowerCase() + "s")) {
      preuves.push({ type: "NOM", detail: `la feuille s'appelle « ${entite} »`, points: 20 });
    }
    const signature = HEADER_SIGNATURES.find((s) => s.entity === entite && s.must.every((m) => presents.has(m)));
    if (signature) preuves.push({ type: "NOM", detail: `colonnes clés présentes : ${signature.must.join(", ")}`, points: 15 });
    if (manquants.length > 0) {
      preuves.push({ type: "CONFLIT", detail: `champ(s) obligatoire(s) absent(s) : ${manquants.join(", ")}`, points: 0 });
    }

    out.push({
      entite,
      score: preuves.reduce((s, p) => s + p.points, 0),
      eligible: manquants.length === 0,
      preuves,
      manquants,
    });
  }
  return out.sort((a, b) => (Number(b.eligible) - Number(a.eligible)) || (b.score - a.score));
}

/**
 * Entite retenue, et si le choix est dispute. Un second candidat eligible a
 * moins de 10 points est signale (§6) : le plan le montre a l'utilisateur au
 * lieu de trancher en silence.
 */
export function choisirEntite(classement: CandidatEntite[]): { entite: string | null; ambigue: boolean; rivale?: string } {
  const eligibles = classement.filter((c) => c.eligible && c.score >= 20);
  if (eligibles.length === 0) return { entite: null, ambigue: false };
  const [premier, second] = eligibles;
  const ambigue = Boolean(second && premier.score - second.score < 10);
  return { entite: premier.entite, ambigue, rivale: ambigue ? second.entite : undefined };
}

// ---------------------------------------------------------------------------
// 2. Le champ de chaque colonne
// ---------------------------------------------------------------------------

export type SourceRattachement = "schema" | "alias" | "reconnaissance" | "dictionnaire" | "ia" | "humain" | "relation";

const POINTS_SOURCE: Record<SourceRattachement, [number, string]> = {
  humain: [50, "rattachement validé par un humain"],
  dictionnaire: [45, "terme du dictionnaire de l'entreprise"],
  schema: [40, "intitulé identique au champ"],
  alias: [35, "synonyme connu du champ"],
  ia: [30, "rattachement proposé par l'analyse IA"],
  reconnaissance: [25, "reconnaissance sémantique de l'intitulé"],
  relation: [30, "valeurs retrouvées dans une autre table"],
};

/** Statut d'une colonne rattachee d'apres sa confiance (memes seuils partout). */
export function statutDepuisConfiance(e: EvaluationColonne, humain = false): StatutColonne {
  if (!e.champ) return e.statut;
  if (humain) return "CONFIRMED";
  if (e.preuves.some((p) => p.detail.startsWith("colonne vide"))) return "PROBABLE";
  // Choix fait a egalite : jamais « confirme », quelles que soient les preuves.
  if (e.preuves.some((p) => p.detail.includes("à égalité"))) return "PROBABLE";
  // Une colonne gardee rattachee est au pire PROBABLE : AMBIGUOUS est reserve
  // aux colonnes ecartees des calculs.
  return e.confiance >= 80 ? "CONFIRMED" : "PROBABLE";
}

/**
 * Ajoute une preuve a une colonne deja evaluee et recalcule sa confiance.
 * Une colonne non rattachee (inconnue, ambigue) n'est pas concernee.
 */
export function ajouterPreuve(e: EvaluationColonne, preuve: Preuve, humain = false) {
  if (!e.champ) return;
  e.preuves = [...e.preuves, preuve];
  e.confiance = Math.max(0, Math.min(100, e.preuves.reduce((s, p) => s + p.points, 0)));
  e.statut = statutDepuisConfiance(e, humain);
}

/** Un code : court, avec des chiffres, au plus deux mots (« C-88124 », « EMP 005 »). */
const SEMBLE_IDENTIFIANT = (v: string) => v.length <= 40 && /\d/.test(v) && v.split(/\s+/).length <= 2;
const SEMBLE_LIBELLE = (v: string) => /[a-zA-ZÀ-ſ]{2,}/.test(v) && !/^[A-Z]{1,5}[-_]?\d+$/.test(v);

/** Part des valeurs non vides compatibles avec le type du champ, et pourquoi. */
export function compatibiliteValeurs(champ: string, prop: any, valeurs: any[]): { taux: number; n: number; detail: string } {
  const pleines = valeurs.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  const n = pleines.length;
  if (n === 0) return { taux: 0, n: 0, detail: "aucune valeur renseignée" };
  let ok = 0;
  let quoi = "";
  if (prop?.enum) {
    ok = pleines.filter((v) => { const d = coerceEnumDetail(v, prop.enum); return prop.enum.includes(d.value) && !d.repli; }).length;
    quoi = "valeurs reconnues dans la liste";
  } else if (prop?.type === "number") {
    ok = pleines.filter((v) => parseNumber(v) !== null).length;
    quoi = "nombres lisibles";
  } else if (prop?.format === "date") {
    ok = pleines.filter((v) => parseDate(v) !== null).length;
    quoi = "dates lisibles";
  } else if (/_id$/.test(champ)) {
    // Un identifiant peut etre un nom (« Julie » comme code client) : seule une
    // valeur demesuree le contredit. La forme « code » sert a departager deux
    // colonnes concurrentes (formeIdentifiant), pas a juger une colonne seule.
    ok = pleines.filter((v) => String(v).trim().length <= 80).length;
    quoi = "valeurs utilisables comme identifiant";
  } else if (/(_name|^name)$/.test(champ)) {
    ok = pleines.filter((v) => SEMBLE_LIBELLE(String(v).trim())).length;
    quoi = "valeurs en forme de libellé";
  } else {
    return { taux: 1, n, detail: "texte libre" };
  }
  return { taux: ok / n, n, detail: `${ok}/${n} ${quoi}` };
}

/** Part des valeurs en forme de code : departage « ID Client » et « Client ». */
function formeIdentifiant(valeurs: any[]): number {
  const pleines = valeurs.map((v) => String(v ?? "").trim()).filter(Boolean);
  return pleines.length ? pleines.filter(SEMBLE_IDENTIFIANT).length / pleines.length : 0;
}

export interface EvaluationColonne {
  colonne: string;
  champ: string | null;
  statut: StatutColonne;
  confiance: number;
  preuves: Preuve[];
  /** Colonne non rattachee mais exploitable comme axe d'analyse (§15). */
  dimension_potentielle?: boolean;
  alternatives?: string[];
}

export interface ColonneAEvaluer { colonne: string; champ: string | null; source?: SourceRattachement }

/**
 * Evalue les rattachements d'une feuille, resout les colonnes en concurrence
 * pour un meme champ et retire un rattachement que les valeurs contredisent.
 *
 * Rend les colonnes corrigees (meme ordre) et leur evaluation. Ne modifie
 * jamais un rattachement valide par un humain.
 */
export function evaluerColonnes(
  entite: string | null,
  colonnes: ColonneAEvaluer[],
  valeursDe: (colonne: string) => any[],
): { colonnes: ColonneAEvaluer[]; evaluations: EvaluationColonne[]; corrections: string[] } {
  const schema = entite ? ENTITY_SCHEMAS[entite] : null;
  const props = schema?.properties || {};
  const corrections: string[] = [];
  const cols = colonnes.map((c) => ({ ...c }));
  const evals = new Map<string, EvaluationColonne>();

  const evaluer = (c: ColonneAEvaluer): EvaluationColonne => {
    if (!c.champ) return { colonne: c.colonne, champ: null, statut: "UNKNOWN", confiance: 0, preuves: [] };
    const preuves: Preuve[] = [];
    const [pts, libelle] = POINTS_SOURCE[c.source || "reconnaissance"];
    preuves.push({ type: c.source === "humain" || c.source === "dictionnaire" ? "HUMAIN" : "NOM", detail: libelle, points: pts });
    const compat = compatibiliteValeurs(c.champ, props[c.champ], valeursDe(c.colonne));
    if (compat.n === 0) {
      preuves.push({ type: "VALEURS", detail: "colonne vide : aucune preuve par les valeurs", points: 0 });
    } else if (compat.taux >= 0.9) {
      preuves.push({ type: "TYPE", detail: compat.detail, points: 35 });
    } else if (compat.taux >= 0.6) {
      preuves.push({ type: "TYPE", detail: compat.detail, points: 20 });
    } else if (props[c.champ]?.enum) {
      // Des valeurs hors liste disent que la liste est incomplete, pas que la
      // colonne n'est pas un canal ou un departement : preuve neutre, et chaque
      // valeur repliee sur « autre » est signalee a l'import.
      preuves.push({ type: "VALEURS", detail: `${compat.detail} — les autres seront rangées sous « autre » (signalé)`, points: 0 });
    } else {
      preuves.push({ type: "CONFLIT", detail: `valeurs contradictoires : ${compat.detail}`, points: -30 });
    }
    if (props[c.champ]) preuves.push({ type: "CONTEXTE", detail: `champ déclaré par ${entite}`, points: 10 });
    const confiance = Math.max(0, Math.min(100, preuves.reduce((s, p) => s + p.points, 0)));
    // Colonne vide : rien ne confirme, rien ne contredit — probable, pas ambigue.
    const statut: StatutColonne = c.source === "humain" ? "CONFIRMED"
      : compat.n === 0 ? "PROBABLE"
      : confiance >= 80 ? "CONFIRMED" : confiance >= 45 ? "PROBABLE" : "AMBIGUOUS";
    return { colonne: c.colonne, champ: c.champ, statut, confiance, preuves };
  };

  // Colonnes en concurrence pour un meme champ : la derniere ecrasait les
  // autres, ligne par ligne. On garde celle que les valeurs soutiennent le
  // mieux ; une perdante textuelle rejoint le champ « nom » correspondant si
  // l'entite en a un, sinon elle reste non rattachee (conservee, signalee).
  const parChamp = new Map<string, number[]>();
  cols.forEach((c, i) => { if (c.champ) parChamp.set(c.champ, [...(parChamp.get(c.champ) || []), i]); });
  for (const [champ, indices] of parChamp) {
    if (indices.length < 2) continue;
    const idChamp = /_id$/.test(champ);
    const notes = indices
      .map((i) => ({ i, e: evaluer(cols[i]), forme: idChamp ? formeIdentifiant(valeursDe(cols[i].colonne)) : 0 }))
      .sort((a, b) => (b.forme - a.forme) || (b.e.confiance - a.e.confiance));
    const gagnante = notes[0];
    // Egalite parfaite : rien dans les valeurs ne departage les colonnes.
    // L'ordre du fichier tranche, mais le choix est signale et plafonne a
    // PROBABLE (§6) — avant, la derniere colonne ecrasait les autres en silence.
    const egalite = notes.length > 1 && notes[1].forme === gagnante.forme && notes[1].e.confiance === gagnante.e.confiance;
    if (egalite && cols[gagnante.i].source !== "humain") {
      const rivales = notes.slice(1).map((n) => `« ${cols[n.i].colonne} »`).join(", ");
      const e = evaluer(cols[gagnante.i]);
      e.preuves.push({ type: "CONFLIT", detail: `retenue à égalité avec ${rivales} (ordre du fichier) — à confirmer`, points: 0 });
      if (e.statut === "CONFIRMED") e.statut = "PROBABLE";
      evals.set(cols[gagnante.i].colonne, e);
      corrections.push(`${champ} : « ${cols[gagnante.i].colonne} » et ${rivales} sont également plausibles ; « ${cols[gagnante.i].colonne} » retenue par ordre du fichier, à confirmer.`);
    }
    if (cols[gagnante.i].source === "humain" && notes.some((n) => n !== gagnante && cols[n.i].source === "humain")) continue;
    for (const perdante of notes.slice(1)) {
      const c = cols[perdante.i];
      if (c.source === "humain") continue;
      // Son propre synonyme d'abord (« Profit Brut » : gross_profit), s'il est
      // libre et que les valeurs ne le contredisent pas.
      const synonyme = champProbable(c.colonne);
      const synonymeLibre = synonyme !== champ && props[synonyme] && !cols.some((x) => x.champ === synonyme);
      const compatSyn = synonymeLibre ? compatibiliteValeurs(synonyme, props[synonyme], valeursDe(c.colonne)) : null;
      if (synonymeLibre && compatSyn && (compatSyn.n === 0 || compatSyn.taux >= 0.6)) {
        corrections.push(`« ${c.colonne} » et « ${cols[gagnante.i].colonne} » visaient tous deux ${champ} : « ${c.colonne} » rattachée à son synonyme ${synonyme}.`);
        c.champ = synonyme;
        c.source = "alias";
        const e = evaluer(c);
        e.preuves.push({ type: "CONFLIT", detail: `déplacée de ${champ} vers ${synonyme} (synonyme connu de l'intitulé)`, points: 0 });
        evals.set(c.colonne, e);
        continue;
      }
      const nomChamp = champ.replace(/_id$/, "_name");
      const libres = nomChamp !== champ && props[nomChamp] && !cols.some((x) => x.champ === nomChamp);
      const compat = libres ? compatibiliteValeurs(nomChamp, props[nomChamp], valeursDe(c.colonne)) : null;
      if (libres && compat && compat.taux >= 0.8) {
        corrections.push(`« ${c.colonne} » et « ${cols[gagnante.i].colonne} » visaient tous deux ${champ} : « ${c.colonne} » contient des libellés (${compat.detail}), rattachée à ${nomChamp}.`);
        c.champ = nomChamp;
        c.source = c.source || "reconnaissance";
        const e = evaluer(c);
        e.preuves.push({ type: "CONFLIT", detail: `déplacée de ${champ} vers ${nomChamp} (libellés, pas des codes)`, points: 0 });
        evals.set(c.colonne, e);
      } else {
        if (!egalite) {
          corrections.push(`« ${c.colonne} » et « ${cols[gagnante.i].colonne} » visaient tous deux ${champ} : « ${cols[gagnante.i].colonne} » est retenue${idChamp ? " (valeurs en forme de code)" : " (mieux soutenue par ses valeurs)"}, « ${c.colonne} » reste conservée sans rattachement.`);
        }
        evals.set(c.colonne, {
          colonne: c.colonne, champ: null, statut: "AMBIGUOUS", confiance: perdante.e.confiance,
          preuves: [...perdante.e.preuves, { type: "CONFLIT", detail: `en concurrence avec « ${cols[gagnante.i].colonne} » pour ${champ}`, points: 0 }],
          alternatives: [champ],
        });
        c.champ = null;
      }
    }
  }

  // Rattachement que les valeurs contredisent nettement : on ne force pas le
  // concept (§6, §22). La colonne reste conservee et signalee comme ambigue.
  cols.forEach((c) => {
    if (!c.champ || c.source === "humain") return;
    if (evals.has(c.colonne) && evals.get(c.colonne)!.statut !== "CONFIRMED") return;
    const e = evaluer(c);
    const compat = compatibiliteValeurs(c.champ, props[c.champ], valeursDe(c.colonne));
    // Retirer un rattachement n'est justifie que s'il ne reposait que sur une
    // supposition (reconnaissance semantique, analyse IA) que les valeurs
    // contredisent. Une colonne nommee comme le champ, un synonyme connu ou un
    // terme du dictionnaire garde son rattachement : ses valeurs illisibles
    // envoient LEURS lignes en quarantaine (INVALID_DATE...), pas la colonne.
    const supposition = c.source === "reconnaissance" || c.source === "ia";
    const typeFort = props[c.champ]?.type === "number" || props[c.champ]?.format === "date";
    if (supposition && ((typeFort && compat.n >= 3 && compat.taux < 0.5) || e.statut === "AMBIGUOUS")) {
      corrections.push(`« ${c.colonne} » → ${c.champ} retiré : ${compat.detail}.`);
      evals.set(c.colonne, { ...e, champ: null, statut: "AMBIGUOUS", alternatives: [c.champ] });
      c.champ = null;
      return;
    }
    // Garde, malgre des valeurs en partie contradictoires : probable, et la
    // contradiction reste visible dans les preuves. AMBIGUOUS est reserve aux
    // colonnes effectivement ecartees des calculs.
    if (e.statut === "AMBIGUOUS") e.statut = "PROBABLE";
    evals.set(c.colonne, e);
  });

  const evaluations = cols.map((c) => {
    const e = evals.get(c.colonne) || evaluer(c);
    if (!e.champ && e.statut === "UNKNOWN") {
      const dim = dimensionPotentielle(valeursDe(c.colonne));
      if (dim) {
        e.dimension_potentielle = true;
        e.preuves = [...e.preuves, { type: "VALEURS", detail: dim, points: 0 }];
      }
    }
    return e;
  });
  return { colonnes: cols, evaluations, corrections };
}

/**
 * Une colonne inconnue peut etre un axe d'analyse (canal, region, campagne...) :
 * du texte, peu de valeurs distinctes, et chacune revient (§14, §15). On le
 * propose — on ne l'utilise pas pour autant dans les KPI.
 */
export function dimensionPotentielle(valeurs: any[]): string | null {
  const pleines = valeurs.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (pleines.length < 2) return null;
  // « AUT26 » est un code, pas un nombre (parseNumber y lirait 26).
  const textuelles = pleines.filter((v) => !/^[\s\d.,$€%()+-]+$/.test(v));
  if (textuelles.length / pleines.length < 0.8) return null;
  const distinctes = new Set(pleines.map((v) => stripAccents(v.toLowerCase())));
  if (distinctes.size < 1 || distinctes.size > 50) return null;
  if (distinctes.size >= pleines.length && pleines.length > 2) return null;
  return `dimension potentielle : ${distinctes.size} valeur(s) distincte(s) sur ${pleines.length} ligne(s)`;
}

/** Resume pour le rapport d'import. */
export function resumeStatuts(evaluations: EvaluationColonne[]): string {
  const par = (s: StatutColonne) => evaluations.filter((e) => e.statut === s);
  const liste = (es: EvaluationColonne[]) => es.slice(0, 6).map((e) => e.colonne).join(", ") + (es.length > 6 ? "…" : "");
  const parts: string[] = [];
  const conf = par("CONFIRMED").length;
  const prob = par("PROBABLE");
  const amb = par("AMBIGUOUS");
  const inc = par("UNKNOWN");
  if (conf) parts.push(`${conf} confirmée(s)`);
  if (prob.length) parts.push(`${prob.length} probable(s) (${liste(prob)})`);
  if (amb.length) parts.push(`${amb.length} ambiguë(s), non utilisée(s) dans les calculs (${liste(amb)})`);
  if (inc.length) parts.push(`${inc.length} inconnue(s), conservée(s) (${liste(inc)})`);
  const dims = evaluations.filter((e) => e.dimension_potentielle);
  if (dims.length) parts.push(`dimension(s) potentielle(s) : ${liste(dims)}`);
  return parts.length ? `Colonnes : ${parts.join(" · ")}.` : "";
}
