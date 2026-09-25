// Analyse d'un fichier par l'IA : produire un PLAN DE LECTURE, pas des donnees.
//
// Pourquoi un plan plutot qu'une extraction directe.
// ----------------------------------------------------------------------------
// Les fichiers des PME ne ressemblent jamais a un tableau propre : un en-tete de
// rapport sur quatre lignes, des intitules maison ("Mtt HT reel", "Sens"), une
// ligne de totaux a la fin, des dates 03/04/2026 dont personne ne sait si c'est
// le 3 avril ou le 4 mars. Aucune table de synonymes ne rattrapera cela : c'est
// un probleme de lecture de document, pas de format — donc le terrain d'un LLM.
//
// Mais on ne lui fait PAS retranscrire les valeurs. Recopier 40 000 cellules
// sans jamais en abimer une seule est un travail mecanique, et une ligne fausse
// ACCEPTEE est pire qu'une ligne rejetee : rien ne la signale. L'IA lit donc la
// STRUCTURE du fichier sur un echantillon et rend des consignes ; le code les
// applique ensuite a toutes les lignes, de facon deterministe et reproductible.
//
// Troisieme garde-fou, decisif : ce que le FICHIER prouve l'emporte sur ce que
// l'IA annonce. Si elle dit "dates en MM/JJ" et que la colonne contient 25/03,
// la preuve gagne. Voir verifierAvecPreuves().

import { getSchema } from "./entitySchemas.ts";
import { parseDate, stripAccents, FIELD_ALIASES, cleCanonique, ALIAS_CANONIQUES, variantesCanoniques, isSummaryOrTotalRow, LIGNE_BRUTE, NUMERO_LIGNE, type ConventionDate, type InvocateurLLM } from "./importUtils.ts";
import { trouverLigneEntetes, detectEntityByHeaders, detectEntityByFieldOverlap, detectEntityByName } from "./sheetDetect.ts";
import { recognizeAllColumns } from "./core/contextualRecognition.ts";
import { classifyDocumentSheet, type SheetClassificationResult } from "./core/documentClassifier.ts";
import { calculateQualityProfile, type QualityProfile } from "./core/qualityEngine.ts";
import { evaluateDecision, type DecisionVerdict } from "./core/decisionMatrix.ts";
import { DOCUMENT_ARCHETYPES, type DocumentArchetype, type GrainLevel } from "./core/ontology/types.ts";
import { rattacherParLexique } from "./registry/lexiqueChamps.ts";
import {
  classerEntites, choisirEntite, evaluerColonnes, ajouterPreuve, champProbable,
  type CandidatEntite, type EvaluationColonne, type SourceRattachement,
} from "./core/recognition/preuves.ts";
import { verifierRelations, type VerificationRelation } from "./core/recognition/relations.ts";

export type Confiance = "haute" | "moyenne" | "faible";
export type OriginePlan = "ia" | "ia+preuves" | "regles" | "memoire";

export interface PlanColonne {
  /** Intitule tel qu'il apparait dans le fichier. */
  colonne: string;
  /** Champ vise dans l'entite, ou null si la colonne n'est rattachee a rien. */
  champ: string | null;
  /** Convention de date imposee a toute la colonne. */
  convention_date?: ConventionDate | null;
  /** Correspondance de valeurs, ex. { "D": "expense", "C": "income" }. */
  valeurs?: Record<string, string> | null;
  /** D'ou vient le rattachement : sert a peser la preuve « nom » (preuves.ts). */
  source?: SourceRattachement;
  /**
   * Colonne volontairement laissee sans champ (concurrence avec une autre
   * colonne, valeurs contradictoires) : meme un plan par regles ne doit pas la
   * rendre aux synonymes, qui la rattacheraient au champ qu'on vient de lui
   * refuser. Sa valeur reste dans original_data.
   */
  exclue?: boolean;
}

export interface PlanImport {
  entite: string | null;
  /** Index (base 0) de la ligne d'en-tetes dans la matrice du fichier. */
  ligne_entetes: number;
  /** Index (base 0) des lignes a ignorer : totaux, sous-totaux, commentaires. */
  lignes_ignorees: number[];
  colonnes: PlanColonne[];
  confiance: Confiance;
  /** Phrase en francais montrable a l'utilisateur avant validation. */
  explication: string;
  origine: OriginePlan;
  /** Ce que les preuves du fichier ont corrige dans la proposition de l'IA. */
  corrections: string[];

  /** Nouveaux enrichissements universels V3.0 (Spec Section 9, 14, 22, 26) */
  archetype?: DocumentArchetype;
  grain?: GrainLevel;
  isAggregatedSummary?: boolean;
  qualityProfile?: QualityProfile;
  decision?: DecisionVerdict;

  /** Statut et preuves de chaque colonne (directives §5, §16) — montres a l'utilisateur. */
  evaluations?: EvaluationColonne[];
  /** Les meilleurs candidats pour le type de la feuille, avec leurs preuves. */
  entite_preuves?: CandidatEntite[];
  /** Second type presque aussi plausible : le choix est a confirmer (§6). */
  entite_rivale?: string;
  /** Relations mathematiques verifiees sur les valeurs (§4 niveau 6). */
  relations?: VerificationRelation[];
}

/**
 * Evalue chaque rattachement du plan sur les valeurs du fichier, et applique ce
 * que les preuves imposent : colonnes en concurrence departagees, rattachement
 * contredit par les valeurs retire. Un rattachement humain n'est jamais modifie.
 */
export function evaluerPlan(plan: PlanImport, matrix: any[][], sourceParDefaut: SourceRattachement): PlanImport {
  if (!plan.entite) return plan;
  const entetes = (matrix[plan.ligne_entetes] || []).map((h: any) => String(h ?? "").trim());
  const ignorees = new Set(plan.lignes_ignorees);
  const lignes = matrix.slice(plan.ligne_entetes + 1).filter((_, i) => !ignorees.has(plan.ligne_entetes + 1 + i));
  const echantillon = lignes.slice(0, 200);
  const valeursDe = (colonne: string) => {
    const idx = entetes.indexOf(colonne);
    return idx < 0 ? [] : echantillon.map((r) => (r || [])[idx]);
  };
  const res = evaluerColonnes(
    plan.entite,
    plan.colonnes.map((c) => ({ colonne: c.colonne, champ: c.champ, source: c.source || sourceParDefaut })),
    valeursDe,
  );
  const colonnes = plan.colonnes.map((c, i) => {
    const apres = res.colonnes[i];
    if (apres.champ === c.champ) return { ...c, source: apres.source };
    return { ...c, champ: apres.champ, source: apres.source, exclue: apres.champ === null ? true : c.exclue };
  });

  // Relations mathematiques du metier, verifiees sur les valeurs : une preuve
  // bien plus forte que le nom. Tenue sur 90 % des lignes : chaque colonne en
  // jeu gagne en confiance ; contredite sur la plupart des lignes : le doute
  // est signale (le rattachement n'est pas retire, la relation peut ne pas
  // s'appliquer a ce fichier — remises, taxes non detaillees...).
  const indexParChamp = new Map<string, number>();
  colonnes.forEach((c) => { if (c.champ) { const idx = entetes.indexOf(c.colonne); if (idx >= 0) indexParChamp.set(c.champ, idx); } });
  const lignesParChamp = echantillon.map((r) => {
    const o: Record<string, any> = {};
    for (const [champ, idx] of indexParChamp) o[champ] = (r || [])[idx];
    return o;
  });
  const relations = verifierRelations(new Set(indexParChamp.keys()), lignesParChamp);
  const corrections = [...res.corrections];
  const humaines = new Set(colonnes.filter((c) => c.source === "humain").map((c) => c.colonne));
  for (const rel of relations) {
    const concernees = res.evaluations.filter((e) => e.champ && rel.champs.includes(e.champ));
    if (rel.n >= 2 && rel.taux >= 0.9) {
      for (const e of concernees) {
        ajouterPreuve(e, { type: "MATHEMATIQUE", detail: `${rel.libelle} vérifié sur ${rel.coherentes}/${rel.n} lignes`, points: 15 }, humaines.has(e.colonne));
      }
    } else if (rel.n >= 3 && rel.taux < 0.5) {
      const resultat = res.evaluations.find((e) => e.champ === rel.champs[rel.champs.length - 1]);
      if (resultat) {
        ajouterPreuve(resultat, { type: "CONFLIT", detail: `${rel.libelle} faux sur ${rel.n - rel.coherentes}/${rel.n} lignes`, points: -15 }, humaines.has(resultat.colonne));
        corrections.push(`« ${resultat.colonne} » : ${rel.libelle} ne se vérifie que sur ${rel.coherentes}/${rel.n} lignes — rattachement à vérifier.`);
      }
    }
  }

  return {
    ...plan,
    colonnes,
    relations,
    evaluations: res.evaluations,
    corrections: [...(plan.corrections || []), ...corrections],
    origine: res.corrections.length > 0 && plan.origine === "ia" ? "ia+preuves" : plan.origine,
  };
}

/** Nombre de lignes soumises a l'IA. Assez pour voir la structure ET des cas limites. */
export const LIGNES_ECHANTILLON = 30;

// ---------------------------------------------------------------------------
// 1. Echantillon
// ---------------------------------------------------------------------------

/**
 * Rend le debut du fichier sous forme de grille numerotee.
 *
 * On envoie le fichier TEL QUEL, desordre compris : c'est precisement l'en-tete
 * de rapport, la ligne vide et la ligne de totaux que l'IA doit voir pour les
 * signaler. Les nettoyer avant reviendrait a lui cacher le probleme qu'on lui
 * demande de resoudre.
 */
export function construireEchantillon(matrix: any[][], limite = LIGNES_ECHANTILLON): string {
  return matrix
    .slice(0, limite)
    .map((row, i) => `${String(i).padStart(2, " ")} | ${(row || []).map((c) => String(c ?? "").trim()).join(" | ")}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// 2. Preuves tirees du fichier (deterministes, gratuites, decisives)
// ---------------------------------------------------------------------------

// Heure eventuelle apres la date (« 11/22/2016 14:05 ») : ignoree, meme preuve.
const MOTIF_DATE_COURTE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?:\s+\d{1,2}:\d{2}.*)?$/;

/**
 * Convention de date reellement prouvee par une colonne.
 *
 * Une seule valeur dont le premier nombre depasse 12 suffit a trancher : aucun
 * mois ne vaut 25, donc 25/03 est le 25 mars et toute la colonne est en JJ/MM.
 * C'est plus fiable que n'importe quelle intuition — IA comprise — parce que
 * c'est une preuve, pas une supposition. Retourne null si le fichier ne prouve
 * rien (toutes les valeurs sont ambigues) ou se contredit.
 */
export function conventionDateProuvee(valeurs: any[]): ConventionDate | null {
  let jourEnTete = 0;
  let moisEnTete = 0;
  for (const v of valeurs) {
    const m = String(v ?? "").trim().match(MOTIF_DATE_COURTE);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) jourEnTete++;
    if (b > 12 && a <= 12) moisEnTete++;
  }
  if (jourEnTete > 0 && moisEnTete === 0) return "JJ/MM";
  if (moisEnTete > 0 && jourEnTete === 0) return "MM/JJ";
  return null;
}

/**
 * Separateur decimal d'une colonne de nombres, prouve par ses valeurs.
 *
 * « 22.368 » est illisible seul : 22,368 ou 22 368 ? Decide valeur par valeur,
 * un point suivi de trois chiffres etait lu comme un separateur de milliers
 * (Superstore : 3 801 ventes x 1 000, un CA de 519 M$ au lieu de 2,3 M$). La
 * colonne, elle, tranche : un point suivi de 1, 2 ou 4 chiffres et plus
 * (« 261.96 », « 957.5775 »), ou une virgule de milliers avant un point
 * (« 1,234.5 »), prouve que le point est decimal ; l'inverse pour la virgule.
 * Rend null si la colonne ne prouve rien ou se contredit.
 */
export type ConventionNombre = "point" | "virgule";

export function conventionNombreProuvee(valeurs: any[]): ConventionNombre | null {
  let point = 0;
  let virgule = 0;
  for (const v of valeurs) {
    if (typeof v !== "string") continue;
    const t = v.trim().replace(/[\s\u00A0\u202F$€£%]/g, "").replace(/^[-+(]+|\)$/g, "");
    if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) continue;
    if (/^\d{1,3}(,\d{3})+\.\d+$/.test(t) || /^\d+\.(\d{1,2}|\d{4,})$/.test(t)) point++;
    else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(t) || /^\d+,(\d{1,2}|\d{4,})$/.test(t)) virgule++;
  }
  if (point > 0 && virgule === 0) return "point";
  if (virgule > 0 && point === 0) return "virgule";
  return null;
}

/** Valeur ambigue (un seul separateur suivi de 3 chiffres) lue selon la convention de sa colonne. */
function nombreSelonConvention(valeur: any, convention: ConventionNombre): any {
  if (typeof valeur !== "string") return valeur;
  const t = valeur.trim();
  const m = t.match(/^(-?)(\d{1,3})([.,])(\d{3})$/);
  if (!m) return valeur;
  const decimal = (m[3] === "." && convention === "point") || (m[3] === "," && convention === "virgule");
  return decimal ? Number(`${m[1]}${m[2]}.${m[4]}`) : Number(`${m[1]}${m[2]}${m[4]}`);
}

/**
 * Une ligne est-elle une ligne de totaux ?
 *
 * Signature courante des exports comptables : une premiere cellule textuelle
 * ("TOTAL", "Sous-total", "Cumul") alors que le reste de la ligne est chiffre.
 * Sert de filet quand l'IA ne l'a pas signalee.
 */

export function estLigneDeTotaux(row: any[]): boolean {
  const cells = (row || []).map((c) => String(c ?? "").trim());
  const remplies = cells.filter((c) => c !== "");
  if (remplies.length < 2) return false;
  // Meme regle que l'import sans IA (isSummaryOrTotalRow) : un premier mot
  // « total » ne suffit plus a lui seul (« Total Laval » peut etre un nom) ;
  // cumul et solde final restent des totaux surs.
  return isSummaryOrTotalRow(row) || /^(cumul|solde\s+final)\b/i.test(remplies[0]);
}

// ---------------------------------------------------------------------------
// 3. Validation de la reponse de l'IA
// ---------------------------------------------------------------------------

/**
 * Une reponse de LLM est du texte, jamais une garantie. On verifie donc que le
 * plan est structurellement utilisable AVANT de le laisser piloter un import :
 * les champs vises doivent exister dans le schema de l'entite, les index de
 * lignes doivent etre des entiers, l'entite doit etre connue. Tout ce qui ne
 * passe pas est ecarte — et non "corrige au mieux", ce qui masquerait l'erreur.
 */
export function validerPlan(brut: any, matrix: any[][]): { plan: PlanImport | null; refus: string[] } {
  const refus: string[] = [];
  if (!brut || typeof brut !== "object") return { plan: null, refus: ["reponse vide ou illisible"] };

  const entite = typeof brut.entite === "string" && brut.entite.trim() !== "" ? brut.entite.trim() : null;
  const schema = entite ? getSchema(entite) : null;
  if (entite && !schema) {
    refus.push(`entite inconnue : ${entite}`);
    return { plan: null, refus };
  }
  const champsConnus = schema ? Object.keys(schema.properties) : [];

  const ligneEntetes = Number.isInteger(brut.ligne_entetes) ? brut.ligne_entetes : 0;
  if (ligneEntetes < 0 || ligneEntetes >= matrix.length) {
    refus.push(`ligne d'en-tetes hors du fichier : ${brut.ligne_entetes}`);
    return { plan: null, refus };
  }

  const lignesIgnorees: number[] = Array.isArray(brut.lignes_ignorees)
    ? brut.lignes_ignorees.filter((n: any) => Number.isInteger(n) && n > ligneEntetes && n < matrix.length)
    : [];

  const colonnes: PlanColonne[] = [];
  // Colonnes que l'IA laisse sans champ : le lexique par mots de l'entite les
  // rattrape avant les synonymes (meme lecture que le plan par regles).
  const intitules = (Array.isArray(brut.colonnes) ? brut.colonnes : []).map((c: any) => String(c?.colonne ?? "")).filter(Boolean);
  const pris = new Set<string>((Array.isArray(brut.colonnes) ? brut.colonnes : []).map((c: any) => c?.champ).filter((x: any) => typeof x === "string" && champsConnus.includes(x)));
  const lexiqueIA = entite ? rattacherParLexique(entite, intitules, pris) : new Map<string, string>();
  for (const c of Array.isArray(brut.colonnes) ? brut.colonnes : []) {
    if (!c || typeof c.colonne !== "string") continue;
    let champ = typeof c.champ === "string" && c.champ.trim() !== "" ? c.champ.trim() : null;
    
    // Sauvetage contextuel si l'IA a proposé un synonyme ou nom légèrement différent
    if (champ && champsConnus.length > 0 && !champsConnus.includes(champ)) {
      const rescued = FIELD_ALIASES[champ] || ALIAS_CANONIQUES[champ];
      if (rescued && champsConnus.includes(rescued)) {
        champ = rescued;
      } else if (entite === "Campaign" && (champ === "cout_clic" || champ === "cost_per_click" || champ === "cout_par_clic") && champsConnus.includes("cpc")) {
        champ = "cpc";
      } else if (entite === "Campaign" && (champ === "budget_cad" || champ === "budget_total") && champsConnus.includes("budget")) {
        champ = "budget";
      } else if (entite === "Inventory" && (champ === "qte_en_stock" || champ === "inventory_level" || champ === "stock_quantity") && champsConnus.includes("closing_stock")) {
        champ = "closing_stock";
      } else if (entite === "Inventory" && (champ === "seuil_d_alerte" || champ === "seuil_alerte") && champsConnus.includes("reorder_point")) {
        champ = "reorder_point";
      } else if (entite === "Inventory" && (champ === "fournisseur" || champ === "supplier_name") && champsConnus.includes("supplier_id")) {
        champ = champsConnus.includes("supplier_name") ? "supplier_name" : "supplier_id";
      } else if (entite === "Customer" && (champ === "nom_complet" || champ === "full_name" || champ === "nom_client") && (champsConnus.includes("first_name") || champsConnus.includes("full_name"))) {
        champ = champsConnus.includes("full_name") ? "full_name" : "first_name";
      } else if (entite === "Customer" && champ === "code_postal" && champsConnus.includes("postal_code")) {
        champ = "postal_code";
      } else if (entite === "ExecutiveSummary" && (champ === "total" || champ === "ventes_totales") && champsConnus.includes("total_revenue")) {
        champ = "total_revenue";
      } else if (entite === "ExecutiveSummary" && (champ === "nb_transactions" || champ === "nombre_transactions") && champsConnus.includes("total_orders")) {
        champ = "total_orders";
      } else if (entite === "Supplier" && champ === "contact_principal" && champsConnus.includes("contact_name")) {
        champ = "contact_name";
      } else if (entite === "Supplier" && (champ === "conditions_paiement" || champ === "condition_paiement") && champsConnus.includes("payment_terms")) {
        champ = "payment_terms";
      } else if (entite === "Employee" && (champ === "role_poste" || champ === "poste") && champsConnus.includes("role")) {
        champ = "role";
      } else if (entite === "Employee" && champ === "taux_commission" && champsConnus.includes("commission_rate")) {
        champ = "commission_rate";
      } else if (entite === "Asset" && (champ === "amortissement_cumule" || champ === "amortissement_cumule_cad") && champsConnus.includes("accumulated_depreciation")) {
        champ = "accumulated_depreciation";
      } else if (entite === "Asset" && (champ === "cout_acquisition_initial" || champ === "cout_acquisition_initial_cad") && champsConnus.includes("initial_cost")) {
        champ = "initial_cost";
      } else if (entite === "Asset" && (champ === "valeur_nette_comptable" || champ === "valeur_nette_comptable_cad" || champ === "vnc") && champsConnus.includes("net_book_value")) {
        champ = "net_book_value";
      } else if (entite === "Asset" && (champ === "classe_dpa" || champ === "classe_dpa_fiscale") && champsConnus.includes("dpa_class")) {
        champ = "dpa_class";
      } else if (entite === "Asset" && (champ === "taux_amortissement_dpa" || champ === "taux_dpa") && champsConnus.includes("dpa_rate")) {
        champ = "dpa_rate";
      } else {
        refus.push(`champ inconnu ignore : ${c.colonne} -> ${champ}`);
        champ = null;
      }
    }
    
    // Rattrapage : si l'IA n'a pas su rattacher (ou s'est trompee), on cherche 
    // une correspondance exacte ou via dictionnaire.
    if (!champ && lexiqueIA.has(c.colonne)) champ = lexiqueIA.get(c.colonne)!;
    // Rattrapage multi-variantes si l'IA n'a pas su rattacher
    if (!champ && champsConnus.length > 0) {
      const vars = variantesCanoniques(c.colonne);
      for (const vr of vars) {
        if (champsConnus.includes(vr)) {
          champ = vr;
          break;
        }
        const alias = FIELD_ALIASES[vr] || ALIAS_CANONIQUES[vr];
        if (alias && champsConnus.includes(alias)) {
          champ = alias;
          break;
        }
      }
    }
    
    const convention = c.convention_date === "JJ/MM" || c.convention_date === "MM/JJ" ? c.convention_date : null;
    const valeurs = c.valeurs && typeof c.valeurs === "object" && !Array.isArray(c.valeurs) ? c.valeurs : null;
    colonnes.push({ colonne: c.colonne, champ, convention_date: convention, valeurs });
  }
  if (colonnes.length === 0) {
    refus.push("aucune colonne exploitable");
    return { plan: null, refus };
  }

  const confiance: Confiance = ["haute", "moyenne", "faible"].includes(brut.confiance) ? brut.confiance : "moyenne";

  return {
    plan: {
      entite,
      ligne_entetes: ligneEntetes,
      lignes_ignorees: lignesIgnorees,
      colonnes,
      confiance,
      explication: typeof brut.explication === "string" ? brut.explication : "",
      origine: "ia",
      corrections: [],
    },
    refus,
  };
}

// ---------------------------------------------------------------------------
// 4. Confrontation aux preuves — le fichier a toujours le dernier mot
// ---------------------------------------------------------------------------

export function verifierAvecPreuves(plan: PlanImport, matrix: any[][]): PlanImport {
  const corrections: string[] = [];
  const entetes = (matrix[plan.ligne_entetes] || []).map((h: any) => String(h ?? "").trim());
  const lignesDonnees = matrix.slice(plan.ligne_entetes + 1);

  const colonnes = plan.colonnes.map((col) => {
    const idx = entetes.indexOf(col.colonne);
    if (idx < 0) return col;
    const valeurs = lignesDonnees.map((r) => (r || [])[idx]);

    const prouvee = conventionDateProuvee(valeurs);
    if (prouvee && col.convention_date && col.convention_date !== prouvee) {
      corrections.push(
        `colonne « ${col.colonne} » : l'analyse annoncait des dates ${col.convention_date}, `
        + `le fichier prouve ${prouvee} (une valeur y depasse 12 jours) — le fichier l'emporte.`,
      );
      return { ...col, convention_date: prouvee };
    }
    if (prouvee && !col.convention_date) return { ...col, convention_date: prouvee };
    return col;
  });

  // Lignes de totaux que l'IA n'aurait pas vues.
  const ignorees = new Set(plan.lignes_ignorees);
  lignesDonnees.forEach((row, i) => {
    const absolu = plan.ligne_entetes + 1 + i;
    if (!ignorees.has(absolu) && estLigneDeTotaux(row)) {
      ignorees.add(absolu);
      corrections.push(`ligne ${absolu} ecartee : ligne de totaux non signalee par l'analyse.`);
    }
  });

  return {
    ...plan,
    colonnes,
    lignes_ignorees: Array.from(ignorees).sort((a, b) => a - b),
    origine: corrections.length > 0 ? "ia+preuves" : plan.origine,
    corrections,
  };
}

// ---------------------------------------------------------------------------
// 5. L'appel a l'IA
// ---------------------------------------------------------------------------

// construirePrompt/SCHEMA_REPONSE deplaces vers importUtils.ts (18 sept
// 2026) : fonctions pures, aucune dependance a XLSX — les y laisser via
// l'import de sheetDetect.ts (qui, lui, importe npm:xlsx@0.18.5) empechait
// de les tester sous le test runner Node du repo, meme probleme deja
// rencontre avec deriveFallbackIdentity et les fonctions de detection.
export { construirePrompt, SCHEMA_REPONSE, type InvocateurLLM } from "./importUtils.ts";
import { construirePrompt, SCHEMA_REPONSE } from "./importUtils.ts";

/**
 * Produit le plan de lecture d'un fichier.
 *
 * `planDeSecours` est le plan deterministe deja calcule par les regles
 * existantes (detection d'entite + ligne d'en-tetes). Il sert des que l'IA est
 * indisponible, lente, ou rend une reponse inutilisable : un import ne doit
 * jamais echouer parce qu'un service tiers est en panne.
 */
/** Nombre de colonnes du plan dont le champ existe dans l'entite. */
export function colonnesAccueillies(entite: string | null | undefined, colonnes: { champ?: string | null }[]): number {
  const props = getSchema(entite || "")?.properties;
  if (!props) return 0;
  return (colonnes || []).filter((c) => c?.champ && c.champ in props).length;
}

/**
 * Un autre type ne l'emporte que s'il accueille NETTEMENT plus de colonnes :
 * au moins 3 de plus et une fois et demie autant. Sur un ecart faible, le
 * premier choix est garde (pas de bascule sur une ou deux colonnes).
 * Sur une petite feuille, l'ecart de 3 est hors d'atteinte : l'autre type
 * l'emporte aussi quand il accueille TOUTES les colonnes (3 au moins) et le
 * premier au plus la moitie (« depenses_fournisseurs.csv » lu comme des
 * fournisseurs d'apres son nom : 2 colonnes sur 4, contre 4 sur 4 en depenses).
 */
export function typeNettementMeilleur(nAutre: number, nActuel: number, nColonnes = 0): boolean {
  if (nAutre >= nActuel + 3 && nAutre >= 1.5 * nActuel) return true;
  return nColonnes >= 3 && nAutre === nColonnes && nActuel * 2 <= nColonnes;
}

export async function analyserFichier(
  invoquer: InvocateurLLM,
  options: {
    matrix: any[][];
    nomFichier: string;
    entitesPossibles: string[];
    planDeSecours: PlanImport;
    companyDictionary?: Record<string, string>;
  },
): Promise<{ plan: PlanImport; refus: string[]; erreur?: string }> {
  const { matrix, nomFichier, entitesPossibles, planDeSecours, companyDictionary } = options;
  if (matrix.length === 0) return { plan: planDeSecours, refus: ["fichier vide"] };

  let brut: any;
  try {
    brut = await invoquer({
      prompt: construirePrompt(construireEchantillon(matrix), nomFichier, entitesPossibles, companyDictionary),
      response_json_schema: SCHEMA_REPONSE,
    });
  } catch (e: any) {
    return { plan: planDeSecours, refus: [], erreur: `analyse indisponible : ${e?.message || e}` };
  }

  const { plan, refus } = validerPlan(brut, matrix);
  if (!plan) return { plan: planDeSecours, refus, erreur: "plan refuse" };
  const verifie = verifierAvecPreuves(plan, matrix);

  // Le type retenu doit pouvoir accueillir les colonnes. L'IA a lu « Ventes_
  // Transactions » (commande, ligne, produit, quantite, prix, client, taxes)
  // comme des Transactions, qui n'ont aucun de ces champs : tout etait perdu
  // pour les KPI (24 sept. 2026). Si le type trouve par les preuves accueille
  // nettement plus de colonnes, c'est lui qui est retenu, avec ses colonnes.
  const nIA = colonnesAccueillies(verifie.entite, verifie.colonnes);
  const nPreuves = colonnesAccueillies(planDeSecours.entite, planDeSecours.colonnes);
  const nColonnes = planDeSecours.colonnes.filter((c) => String(c.colonne ?? "").trim() !== "").length;
  if (planDeSecours.entite && verifie.entite !== planDeSecours.entite && typeNettementMeilleur(nPreuves, nIA, nColonnes)) {
    return {
      plan: {
        ...planDeSecours,
        explication: verifie.explication || planDeSecours.explication,
        corrections: [
          `type ${verifie.entite || "(aucun)"} propose par l'analyse remplace par ${planDeSecours.entite} : `
          + `${nPreuves} colonne(s) y trouvent un champ, contre ${nIA} pour ${verifie.entite || "(aucun)"}.`,
          ...(planDeSecours.corrections || []),
        ],
      },
      refus,
    };
  }

  // Fallback: override missing mappings from LLM with our deterministic rules & memory
  // Seulement vers un champ qui existe dans le type retenu : un champ d'une
  // autre entite (order_id dans une Transaction) n'a nulle part ou aller.
  const champsDuType = new Set(Object.keys(getSchema(verifie.entite || "")?.properties || {}));
  for (const col of verifie.colonnes) {
      if (!col.champ) {
          const secCol = planDeSecours.colonnes.find(c => c.colonne === col.colonne);
          if (secCol && secCol.champ && (champsDuType.size === 0 || champsDuType.has(secCol.champ))) {
              col.champ = secCol.champ;
              col.source = secCol.source;
              verifie.corrections.push(`colonne « ${col.colonne} » : rattrapage via memoire/reconnaissance -> ${col.champ}.`);
              verifie.origine = "ia+preuves";
          }
      }
  }

  return { plan: evaluerPlan(verifie, matrix, "ia"), refus };
}

// ---------------------------------------------------------------------------
// 6. Plan de secours : les regles deterministes, quand l'IA n'a pas repondu
// ---------------------------------------------------------------------------

/**
 * Un import ne doit jamais echouer parce qu'un service d'IA est en panne, lent
 * ou saturé. Ce plan reproduit le comportement historique : ligne d'en-tetes
 * trouvee par heuristique, entite deduite des colonnes, rattachement des
 * colonnes laisse a la table de synonymes de normalizeKeys (champ: null ici
 * signifie « le pipeline decidera », pas « colonne ignoree »).
 */
/**
 * Le meme concept porte un autre nom selon l'entite : la quantite en stock est
 * `inventory_level` sur Product mais `closing_stock` sur Inventory, la
 * description d'un article est le `product_name` d'une ligne de stock. Le plan
 * doit le savoir, sinon il declare « inconnue » une colonne que l'import lit.
 */
const ADAPTATIONS: Record<string, Record<string, string>> = {
  // Sur une feuille de stock, « Achats » / « Entrées » sont des quantites
  // entrees et « Unités vendues » / « Sorties » des quantites sorties ; la
  // relation stock initial + achats − ventes = stock final le verifie ensuite.
  Inventory: {
    inventory_level: "closing_stock", inventory_quantity: "closing_stock", description: "product_name",
    purchase_amount: "purchases", sales_quantity: "units_sold", cash_in: "purchases", cash_out: "units_sold",
  },
  Product: { description: "product_name" },
  Order: { transaction_id: "order_id" },
};
function adapterChamp(entite: string, champ: string): string {
  return ADAPTATIONS[entite]?.[champ] || champ;
}

/** Entite maitre -> [son identifiant, l'entite qui en est la serie]. */
const SERIE_DE: Record<string, [string, string]> = {
  Campaign: ["campaign_id", "CampaignDaily"],
  Employee: ["employee_id", "Payroll"],
  Customer: ["customer_id", "Order"],
  Supplier: ["supplier_id", "Purchase"],
  Product: ["product_id", "Inventory"],
};

export function planParRegles(
  matrix: any[][], 
  nomFichier: string, 
  entiteConnue?: string | null,
  mappingMemory: any[] = [],
  // Vocabulaire propre a l'entreprise (Company.company_dictionary, deja indexe) :
  // prioritaire sur toute reconnaissance generique, et c'est ce qui permet au
  // retraitement de recuperer des lignes des qu'un terme est appris.
  companyDictionary?: Record<string, string>,
): PlanImport {
  const ligne = matrix.length > 0 ? trouverLigneEntetes(matrix) : 0;
  const entetes = (matrix[ligne] || []).map((h: any) => String(h ?? "").trim()).filter((h: string) => h !== "");
  
  // Create sample rows for recognition and profiling
  const sampleRows: Record<string, any>[] = [];
  const lignes_ignorees: number[] = [];
  for(let i = ligne + 1; i < matrix.length; i++) {
    const rowObj: Record<string, any> = {};
    const row = matrix[i] || [];
    entetes.forEach((h: string, idx: number) => {
      rowObj[h] = row[idx];
    });
    // Detection automatique des lignes de total/synthese a ecarter
    if (isSummaryOrTotalRow(rowObj)) {
      lignes_ignorees.push(i);
    } else {
      if (sampleRows.length < 50) {
        sampleRows.push(rowObj);
      }
    }
  }

  // 1. Classification universelle de la feuille (Spec Section 9 & 14)
  const classification = classifyDocumentSheet({
    sheetName: nomFichier,
    headers: entetes,
    rows: sampleRows,
    matrix,
  });

  // 2. Détection de l'entité
  // Type de la feuille par preuves (preuves.ts) : couverture des colonnes, nom
  // de la feuille, colonnes cles, champs obligatoires. L'ancienne regle prenait
  // la PREMIERE signature trouvee — « ID Client » suffisait a faire d'une
  // feuille de ventes de 18 colonnes une feuille de clients.
  const classement = classerEntites(entetes, nomFichier, companyDictionary);
  const choix: { entite: string | null; ambigue: boolean; rivale?: string; incomplet?: string } = entiteConnue ? { entite: null, ambigue: false } : choisirEntite(classement);
  let entite = entiteConnue || choix.entite
    || (choix.incomplet ? null : detectEntityByHeaders(entetes) || detectEntityByFieldOverlap(entetes)) || null;
  if (!entite && classification.isAggregatedSummary) {
    entite = "ExecutiveSummary";
  }

  // Grain : une entite « maitre » (une ligne par campagne, par employe, par
  // client...) dont l'identifiant se repete est en realite une SERIE de cette
  // entite (une ligne par campagne et par semaine, par employe et par paie,
  // par client et par commande). La lire comme la liste maitre ne gardait
  // qu'une ligne par identifiant et rejetait les autres comme doublons (DS03 :
  // 78 semaines sur 85). Si la serie correspondante peut etre remplie, on
  // bascule, et on le dit.
  const correctionsGrain: string[] = [];
  if (entite && !entiteConnue && SERIE_DE[entite]) {
    const [idMaitre, serie] = SERIE_DE[entite];
    const candidatSerie = classement.find((c) => c.entite === serie && c.eligible);
    const brutEntetes = (matrix[ligne] || []).map((h: any) => String(h ?? "").trim());
    const lexMaitre = rattacherParLexique(entite, entetes);
    const colId = brutEntetes.findIndex((h: string) => h && (lexMaitre.get(h) === idMaitre || cleCanonique(h) === idMaitre || champProbable(h, companyDictionary) === idMaitre));
    if (candidatSerie && colId >= 0) {
      const valeurs = matrix.slice(ligne + 1, ligne + 2001).map((r) => String((r || [])[colId] ?? "").trim()).filter(Boolean);
      const distinctes = new Set(valeurs).size;
      if (valeurs.length >= 4 && distinctes / valeurs.length <= 0.9) {
        correctionsGrain.push(
          `type ${entite} remplace par ${serie} : l'identifiant « ${brutEntetes[colId]} » se repete `
          + `(${distinctes} valeurs distinctes sur ${valeurs.length} lignes), la feuille est une serie et non une liste de ${entite}.`,
        );
        entite = serie;
      }
    }
  }
  
  // Use Contextual Recognition (Sprint 2)
  let recognizedCols = new Map();
  try {
    recognizedCols = recognizeAllColumns({
      sheetName: nomFichier,
      headers: entetes,
      sampleRows,
      entityHint: entite || undefined,
      mappingMemory
    });
  } catch (e) {
    console.warn("Contextual recognition failed, falling back to basic mapping", e);
  }

  // Lexique par mots (registry/lexiqueChamps.ts) : reconnait un champ a sa
  // combinaison de mots, quelle que soit la forme de l'intitule. Les colonnes
  // qui portent deja exactement le nom d'un champ le gardent.
  const champsExacts = new Set<string>();
  const schemaEntite = entite ? getSchema(entite) : null;
  if (schemaEntite) {
    for (const c of entetes) {
      const k = c.toLowerCase().trim();
      if (schemaEntite.properties[c]) champsExacts.add(c);
      else if (schemaEntite.properties[k]) champsExacts.add(k);
    }
  }
  const lexique = entite ? rattacherParLexique(entite, entetes, champsExacts) : new Map<string, string>();

  const colonnes = entetes.map((c: string) => {
    const rec = recognizedCols.get(c);
    let champ = null;
    let source: SourceRattachement | undefined;
    const cleanC = c.toLowerCase().trim();
    const noAccentC = cleanC.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_");

    // 0. Le dictionnaire de l'entreprise l'emporte : c'est une decision humaine.
    if (entite && companyDictionary) {
      const schema = getSchema(entite);
      const terme = companyDictionary[cleCanonique(c)];
      const adapte = terme ? adapterChamp(entite, terme) : null;
      if (schema && adapte && Object.keys(schema.properties).includes(adapte)) {
        return { colonne: c, champ: adapte, source: "dictionnaire" as SourceRattachement };
      }
    }

    // Exact schema fields always win over semantic guesses
    if (entite) {
      const schema = getSchema(entite);
      if (schema) {
        const fields = Object.keys(schema.properties);
        if (fields.includes(c)) champ = c;
        else if (fields.includes(cleanC)) champ = cleanC;
        else if (fields.includes(noAccentC)) champ = noAccentC;
        if (champ) source = "schema";
      }
    }
    if (!champ && lexique.has(c)) { champ = lexique.get(c)!; source = "alias"; }
    
    // 1. Semantic contextual recognition (Ontologie Commerciale Universelle)
    if (!champ && rec && rec.confidence >= 0.5 && rec.canonicalKey !== 'unknown') {
       const k = rec.canonicalKey;
       if (k === 'revenue_amount' && entite === 'Order') champ = 'total';
       else if (k === 'revenue_amount' && entite === 'Campaign') champ = 'revenue';
       else if (k === 'expense_amount' && entite === 'Expense') champ = 'amount';
       else if (k === 'cash_balance' && entite === 'Cashflow') champ = 'closing_cash';
       else if (k === 'employee_identifier' && entite === 'Employee') champ = 'employee_id';
       else if (k === 'product_identifier' && entite === 'Product') champ = 'product_id';
       else if (k === 'identifier' && entite === 'Product') champ = 'product_id';
       else if (k === 'identifier' && entite === 'Employee') champ = 'employee_id';
       else champ = k;
       if (rec.targetField) {
          champ = rec.targetField;
       }
       source = "reconnaissance";
    }
    // Un concept reconnu qui n'est pas un champ du type retenu (« revenue » pour
    // une commande, « discount_rate ») etait jete plus loin sans que les
    // synonymes soient essayes : « Sales_Amount » restait non rattachee a
    // l'ecran, rattrapee en douce a l'ecriture sans IA, et perdue avec une
    // reponse de l'IA (CA recalcule sans la remise, +6,8 %, 25 sept. 2026).
    if (champ && entite && source === "reconnaissance") {
      const champsDuType = Object.keys(getSchema(entite)?.properties || {});
      if (!champsDuType.includes(champ) && !champsDuType.includes(adapterChamp(entite, champ))) { champ = null; source = "schema"; }
    }
    
    // 2. Fallback to schema fields so the UI doesn't show 'Ignorer' for valid columns
    if (!champ && entite) {
        const schema = getSchema(entite);
        if (schema) {
            const canon = cleCanonique(c);
            const brut = FIELD_ALIASES[cleanC] || FIELD_ALIASES[cleanC.replace(/[\s-]/g, "_")] || FIELD_ALIASES[noAccentC] || ALIAS_CANONIQUES[canon];
            const alias = brut ? adapterChamp(entite, brut) : brut;
            const reparti = alias === "name" && schema.properties.first_name && !schema.properties.name;
            if (alias && (Object.keys(schema.properties).includes(alias) || reparti)) { champ = alias; source = "alias"; }
            // Variantes de l'intitule (origin/main) quand aucun synonyme direct ne suffit.
            if (!champ) {
              const vars = variantesCanoniques(c);
              for (const vr of vars) {
                if (Object.keys(schema.properties).includes(vr)) {
                  champ = vr;
                  break;
                }
                const alias = FIELD_ALIASES[vr] || ALIAS_CANONIQUES[vr];
                if (alias && Object.keys(schema.properties).includes(alias)) {
                  champ = alias;
                  break;
                }
              }
              if (champ) source = "alias";
            }
        }
    }

    // 3. Adaptations ciblées par entité (Order, Product, Inventory, Customer, Campaign, Supplier, Employee, ExecutiveSummary)
    if (entite === 'Order') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if (champ === 'transaction_id') champ = 'order_id';
      if (champ === 'taxe_federale_tps' || normC.includes('taxe_fed') || normC.includes('tps')) champ = 'tax_federal';
      if (champ === 'taxe_provinciale_tvq_tvh' || normC.includes('taxe_prov') || normC.includes('tvq')) champ = 'tax_provincial';
      if (normC === 'succursale' || normC === 'store') champ = 'succursale';
      if (normC.includes('id_succursale') || normC.includes('succursale_id')) champ = 'location_id';
      if (normC.includes('livraison')) champ = 'fulfillment_status';
      if (normC.includes('nom') && normC.includes('employe')) champ = 'employee_name';
      if (normC.includes('departement')) champ = 'department';
      const mot = (s: string) => new RegExp(`(^|_)${s}(_|$)`).test(normC);
      if (mot("profit") || (mot("benefice") && mot("brut"))) champ = 'gross_profit';
      else if (mot("marge") || mot("margin") || mot("pct")) champ = 'gross_margin';
    }
    if (entite === 'Product') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if (champ === 'closing_stock' || champ === 'stock_quantity') champ = 'inventory_level';
      if (champ === 'unit_cost' || normC.includes('cout_d_achat')) champ = 'purchase_cost';
      if (champ === 'unit_price' || normC.includes('prix_de_vente')) champ = 'selling_price';
      if (champ === 'qte_en_stock' || champ === 'quantity_on_hand') champ = 'inventory_level';
      if (champ === 'description') champ = 'product_name';
      if (normC.includes('sous_cat') || normC.includes('subcat')) champ = 'subcategory';
    }
    if (entite === 'Inventory') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if (normC.includes('id_inventaire') || normC.includes('inventaire_id')) champ = 'inventory_id';
      if (normC.includes('id_entrepot') || normC.includes('entrepot_id')) champ = 'warehouse_id';
      if (normC.includes('nom') && normC.includes('entrepot')) champ = 'warehouse_name';
      if (champ === 'inventory_level' || champ === 'stock_quantity' || champ === 'qte_en_stock') champ = 'closing_stock';
      if (champ === 'valeur_stock_cout_cad' || champ === 'valeur_stock_cout' || champ === 'valeur_stock') champ = 'inventory_value';
      if (champ === 'unit_price' || normC.includes('prix_de_vente')) champ = 'selling_price';
      if (champ === 'seuil_d_alerte' || champ === 'seuil_alerte') champ = 'reorder_point';
      if (champ === 'fournisseur' || champ === 'supplier_name') champ = 'supplier_id';
      if (champ === 'description') champ = 'product_name';
    }
    if (entite === 'Customer') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if (champ === 'nom_complet' || champ === 'nom_client' || champ === 'client') champ = 'full_name';
      if (champ === 'code_postal') champ = 'postal_code';
      if (champ === 'points_fidelite') champ = 'loyalty_points';
      if (normC.includes('1er_achat') || normC.includes('premier_achat')) champ = 'first_purchase_date';
      if (normC.includes('dernier_achat')) champ = 'last_purchase_date';
      if (normC.includes('commandes_totales') || normC.includes('total_commandes')) champ = 'total_orders';
      if (normC.includes('risque') || normC.includes('depart') || normC.includes('churn')) champ = 'churn_risk';
    }
    if (entite === 'Supplier') {
      const normCol = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if ((normCol.includes('id') || normCol.includes('num') || normCol.includes('code')) && (normCol.includes('fourn') || normCol.includes('suppl'))) {
        champ = 'supplier_id';
      } else if (normCol.includes('nom') && (normCol.includes('fourn') || normCol.includes('suppl'))) {
        champ = 'supplier_name';
      } else if (champ === 'supplier' || champ === 'supplier_id') {
        champ = (normCol.includes('id') || normCol.includes('code')) ? 'supplier_id' : 'supplier_name';
      }
      if (champ === 'contact_principal' || champ === 'contact' || champ === 'nom_du_contact' || normCol.includes('contact')) champ = 'contact_name';
      if (champ === 'conditions_paiement' || champ === 'condition_paiement' || champ === 'termes_paiement' || normCol.includes('condition') || normCol.includes('paiement')) champ = 'payment_terms';
      if (champ === 'ville' || normCol === 'ville') champ = 'city';
      if (champ === 'pays' || normCol === 'pays') champ = 'country';
      if (champ === 'courriel' || normCol === 'email' || normCol === 'courriel') champ = 'email';
      if (normCol.includes('neq')) champ = 'neq_number';
      if (normCol.includes('tps') || normCol.includes('gst')) champ = 'gst_number';
      if (normCol.includes('tvq') || normCol.includes('qst')) champ = 'qst_number';
      if (normCol.includes('delai') || normCol.includes('livraison')) champ = 'average_delivery_days';
      if (normCol.includes('evolution') || normCol.includes('prix')) champ = 'price_change_last_12_months';
      if (normCol.includes('fiabilite')) champ = 'reliability_score';
      if (normCol.includes('qualite')) champ = 'quality_score';
      if (normCol.includes('esg')) champ = 'esg_score';
      if (normCol.includes('devise')) champ = 'purchase_currency';
      if (normCol.includes('volume')) champ = 'purchase_volume';
    }
    if (entite === 'Purchase') {
      const normCol = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if ((normCol.includes('id') || normCol.includes('num') || normCol.includes('code') || normCol.includes('no')) && normCol.includes('achat')) champ = 'purchase_id';
      if (normCol.includes('date') && !normCol.includes('livraison')) champ = 'date';
      if ((normCol.includes('id') || normCol.includes('num') || normCol.includes('code')) && (normCol.includes('fourn') || normCol.includes('suppl'))) champ = 'supplier_id';
      if ((normCol.includes('id') || normCol.includes('num') || normCol.includes('code') || normCol.includes('sku')) && (normCol.includes('prod') || normCol.includes('art'))) champ = 'product_id';
      if (normCol.includes('prevu') || (normCol.includes('livraison') && normCol.includes('attendu'))) champ = 'expected_delivery';
      if (normCol.includes('reel') || (normCol.includes('livraison') && normCol.includes('effectiv'))) champ = 'actual_delivery';
      if (normCol.includes('retard')) champ = 'delay_days';
      if (normCol.includes('cout_total') || normCol.includes('montant_total') || normCol.includes('total')) champ = 'total_cost';
      if (normCol.includes('cout_unit') || normCol.includes('prix_unit')) champ = 'unit_cost';
      if (normCol.includes('qte') || normCol.includes('quantite')) champ = 'quantity';
    }
    if (entite === 'Campaign') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if (champ === 'cout_clic' || champ === 'cout_par_clic' || champ === 'cost_per_click') champ = 'cpc';
      if (champ === 'budget_cad' || champ === 'budget_total') champ = 'budget';
      if (normC.includes('date_de_debut') || normC.includes('date_debut') || normC.includes('start_date')) champ = 'start_date';
      if (normC.includes('date_de_fin') || normC.includes('date_fin') || normC.includes('end_date')) champ = 'end_date';
      if (normC === 'depense' || normC === 'depenses' || champ === 'amount') champ = 'spend';
      if (normC.includes('nouveaux_clients') || normC.includes('new_customers')) champ = 'new_customers';
    }
    if (entite === 'Employee') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if (champ === 'store' || champ === 'location_id' || normC === 'emplacement') champ = 'location';
      if (normC === 'succursale') champ = 'branch';
      if (champ === 'category' || normC.includes('departement')) champ = 'department';
      if (champ === 'role_poste' || champ === 'poste' || champ === 'titre_poste') champ = 'role';
      if (champ === 'taux_commission') champ = 'commission_rate';
      if (normC.includes('heures_hebdo')) champ = 'weekly_hours';
      if (normC === 'salaire') champ = 'salary';
      if (normC.includes('salaire_annuel')) champ = 'annual_salary';
      if (normC.includes('rrq')) champ = 'cpp_employer';
      if (normC.includes('rqap')) champ = 'qpip_employer';
      if (normC.includes('charges_sociales')) champ = 'total_social_charges';
      if (normC.includes('cout_employeur')) champ = 'total_employer_cost';
    }
    if (entite === 'Expense') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if (normC.includes('departement')) champ = 'department';
      if (normC.includes('categorie')) champ = 'category';
      if (normC.includes('recurrent')) champ = 'recurring';
    }
    if (entite === 'Cashflow') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      if (normC.includes('entree')) champ = 'cash_in';
      if (normC.includes('sortie')) champ = 'cash_out';
      if (normC.includes('cloture')) champ = 'closing_cash';
      if (normC.includes('ouverture')) champ = 'opening_cash';
      if (normC.includes('flux_net')) champ = 'net_cash_flow';
    }
    if (entite === 'ExecutiveSummary') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      const mot = (s: string) => new RegExp(`(^|_)${s}(_|$)`).test(normC);
      if (mot("indicateur") || mot("kpi") || mot("performance") || mot("label")) champ = 'indicator_name';
      else if (mot("valeur") || mot("metrique")) champ = 'metric_value';
      else if (mot("unite") || mot("formule")) champ = 'unit_formula';
      else if (mot("commentaire") || mot("strategique") || mot("note") || mot("notes")) champ = 'notes';
      else if (mot("succursale") || mot("store") || mot("location") || mot("ville")) champ = 'location_id';
      else if (mot("transaction") || mot("transactions") || mot("commande") || mot("commandes") || mot("nb_transactions")) champ = 'total_orders';
      else if (mot("cout") || mot("cost") || mot("charge")) champ = 'total_cost';
      else if (mot("profit") || mot("benefice")) champ = 'gross_profit';
      else if (mot("marge") || mot("margin") || mot("pct")) champ = 'gross_margin';
      else if (mot("vente") || mot("ventes") || mot("revenue") || mot("ca")) champ = 'total_revenue';
    }
    if (entite === 'Asset') {
      const normC = stripAccents(c.toLowerCase()).replace(/[^a-z0-9]+/g, "_");
      const mot = (s: string) => new RegExp(`(^|_)${s}(_|$)`).test(normC);
      if (mot("cumule") || mot("accumule") || (mot("amortissement") && (mot("cumul") || !mot("taux")))) champ = 'accumulated_depreciation';
      else if (mot("taux") || (mot("dpa") && mot("taux")) || (mot("amortissement") && mot("taux"))) champ = 'dpa_rate';
      else if (mot("initial") || (mot("cout") && mot("acquisition")) || (mot("valeur") && mot("acquisition"))) champ = 'initial_cost';
      else if (mot("nette") || mot("comptable") || mot("vnc")) champ = 'net_book_value';
      else if (mot("classe") || (mot("dpa") && mot("classe"))) champ = 'dpa_class';
      else if (mot("commentaire") || mot("historique")) champ = 'historical_comment';
      else if (mot("succursale") || mot("store") || mot("magasin") || mot("location")) champ = 'location_id';
      else if (mot("immobilisation") || mot("actif_id") || (mot("id") && mot("actif"))) champ = 'asset_id';
      else if (mot("description") || (mot("actif") && !mot("id") && !mot("valeur"))) champ = 'description';
    }

    // Filet de sécurité général : la reconnaissance sémantique (étape 1,
    // ci-dessus) gagne souvent la course avant que FIELD_ALIASES/
    // ALIAS_CANONIQUES (étape 2) ne soit consultée, laissant `champ` sur le
    // nom d'en-tête canonicalisé brut ("cout_clic", "qte_en_stock"...) au
    // lieu du vrai champ du schéma ("cpc", "inventory_level"...) — c'est la
    // cause commune à la plupart des bugs de colonnes ignorées identifiés
    // (voir dictionnaire technique, section « Diagnostic des Rejets
    // d'Ingestion »). Les correctifs ciblés par entité ci-dessus couvrent
    // les cas déjà repérés ; ce filet rattrape génériquement tout champ final
    // qui n'existe pas dans le schéma cible mais que ces mêmes tables savent
    // pourtant traduire. Ne s'active que sur un champ déjà invalide : ne peut
    // pas dégrader un champ qui résolvait correctement.
    if (entite && champ) {
      const schema = getSchema(entite);
      if (schema && !Object.keys(schema.properties).includes(champ)) {
        const rescued = FIELD_ALIASES[champ] || ALIAS_CANONIQUES[champ];
        if (rescued && Object.keys(schema.properties).includes(rescued)) {
          champ = rescued;
        }
      }
    }

    // Un concept reconnu qui n'est pas un champ de l'entite ne doit pas
    // remplacer l'intitule d'origine : appliquerPlan ecrirait la valeur sous ce
    // nom, que normalizeKeys ne rattacherait ensuite a rien. « Montant »
    // devenait ainsi `total` sur Transaction (qui n'a que `amount`), et CHAQUE
    // transaction partait en quarantaine pour « amount manquant » des que
    // l'analyse IA etait indisponible. On retente la table de synonymes ; a
    // defaut, champ null rend la colonne au rattachement par synonymes.
    if (champ && entite) {
      const schema = getSchema(entite);
      // `name` n'est pas un champ des entites qui stockent prenom et nom, mais
      // l'import sait le repartir (normalizeRow) : c'est un rattachement valide.
      const champs = schema ? [...Object.keys(schema.properties), ...(schema.properties.first_name && !schema.properties.name ? ["name"] : [])] : [];
      if (champs.length > 0 && !champs.includes(champ)) {
        const canon = cleCanonique(c);
        const alias = FIELD_ALIASES[cleanC] || FIELD_ALIASES[cleanC.replace(/[\s-]/g, "_")] || FIELD_ALIASES[noAccentC] || ALIAS_CANONIQUES[canon];
        const adapte = alias ? adapterChamp(entite, alias) : alias;
        champ = adapte && champs.includes(adapte) ? adapte : null;
        source = champ ? "alias" : undefined;
      }
    }

    // Deux signaux independants qui concordent (reconnaissance semantique ET
    // table de synonymes) valent mieux qu'un seul : la preuve « nom » est
    // alors celle du synonyme connu.
    if (champ && source === "reconnaissance" && entite) {
      const canon = cleCanonique(c);
      const brut = FIELD_ALIASES[cleanC] || FIELD_ALIASES[cleanC.replace(/[\s-]/g, "_")] || FIELD_ALIASES[noAccentC] || ALIAS_CANONIQUES[canon];
      if (brut && adapterChamp(entite, brut) === champ) source = "alias";
    }

    return { colonne: c, champ, source };
  });

  // 3bis. Dédoublonnage des champs cibles : deux colonnes sources ne doivent
  // jamais écrire sur le même champ. appliquerPlan construit l'objet ligne en
  // affectant `obj[champ] = valeur` colonne par colonne — un deuxième
  // affectation au même champ écrase silencieusement la première, sans erreur
  // ni ligne de quarantaine, et l'utilisateur ne voit jamais qu'une colonne a
  // disparu. Repéré en testant Clients_CRM (ID_Client ET Nom_Client mappés
  // tous deux vers customer_id : l'identifiant réel se faisait remplacer par
  // le nom) et Stocks_MultiEntrepots (Quantite_En_Stock ET Quantite_Disponible
  // vers inventory_level). La colonne dont l'en-tête ressemble à un
  // identifiant (contient "id") gagne le champ. Le repli vers un champ "nom"
  // libre ne s'applique qu'au conflit sur un champ "_id" (le cas customer_id
  // / customer_name) : pour tout autre champ (une quantité, un montant...),
  // rediriger vers un champ "nom" du schéma choisi au hasard écrirait une
  // valeur numérique dans un champ texte sans rapport — la colonne perdante
  // est alors simplement ignorée plutôt que mal réaffectée.
  if (entite) {
    const schemaFields = Object.keys(getSchema(entite)?.properties || {});
    const claimedBy = new Map<string, { idx: number; looksLikeId: boolean }>();
    colonnes.forEach((c, idx) => {
      if (!c.champ) return;
      const looksLikeId = /\bid\b/i.test(c.colonne);
      const existing = claimedBy.get(c.champ);
      if (!existing) {
        claimedBy.set(c.champ, { idx, looksLikeId });
        return;
      }
      const loserIdx = (looksLikeId && !existing.looksLikeId) ? existing.idx : idx;
      if (loserIdx === existing.idx) claimedBy.set(c.champ, { idx, looksLikeId });
      const targetIsIdField = /_id$/.test(c.champ);
      const nameFieldPrefix = c.champ.replace(/_id$/, "_name");
      const freeNameField = targetIsIdField && schemaFields.includes(nameFieldPrefix) && !claimedBy.has(nameFieldPrefix)
        ? nameFieldPrefix
        : null;
      if (freeNameField) {
        colonnes[loserIdx].champ = freeNameField;
        claimedBy.set(freeNameField, { idx: loserIdx, looksLikeId: false });
      } else {
        colonnes[loserIdx].champ = null;
      }
    });
  }

  // 4. Calcul du profil de qualité et décision
  const avgConfidence = recognizedCols.size > 0
    ? Array.from(recognizedCols.values()).reduce((s: number, r: any) => s + (r.confidence || 0.8), 0) / recognizedCols.size
    : 0.85;

  const qualityProfile = calculateQualityProfile({
    headers: entetes,
    rows: sampleRows,
    mappedColumnsCount: colonnes.filter((c) => c.champ).length,
    totalColumnsCount: entetes.length,
    averageSemanticConfidence: avgConfidence,
    isAggregatedSummary: classification.isAggregatedSummary,
  });

  const decision = evaluateDecision(qualityProfile, avgConfidence);

  const explication = classification.isAggregatedSummary
    ? classification.explanation
    : (entite
        ? `Lecture sémantique de ${nomFichier} : reconnaissance de ${colonnes.filter((c) => c.champ).length}/${entetes.length} colonnes pour l'entité ${entite}.`
        : `Lecture automatique de ${nomFichier} : ${classification.explanation}`);

  const plan: PlanImport = {
    entite,
    ligne_entetes: ligne,
    lignes_ignorees,
    colonnes,
    // Un type de feuille dispute n'est jamais « haute » confiance.
    confiance: choix.ambigue ? "faible" : decision.confidenceScore >= 90 ? "haute" : decision.confidenceScore >= 70 ? "moyenne" : "faible",
    explication: choix.ambigue ? `${explication} Type à confirmer : ${choix.rivale} est presque aussi plausible.` : explication,
    origine: "regles",
    corrections: correctionsGrain,
    archetype: classification.archetype,
    grain: classification.grain.primaryGrain,
    isAggregatedSummary: classification.isAggregatedSummary,
    qualityProfile,
    decision,
    entite_preuves: classement.slice(0, 3),
    entite_rivale: choix.rivale,
  };
  return evaluerPlan(plan, matrix, "alias");
}

/** Le plan de secours laisse le mapping au pipeline historique. */
export function planSansRattachement(plan: PlanImport): boolean {
  // Dans un plan par règles, on autorise toujours le rattrapage par synonymes 
  // pour les colonnes dont le champ est resté à null.
  return plan.origine === "regles";
}

// ---------------------------------------------------------------------------
// 7. Application du plan
// ---------------------------------------------------------------------------

/**
 * Transforme la matrice brute en lignes exploitables, selon le plan.
 *
 * C'est ici que se materialise la separation : l'IA a decrit le fichier, le
 * code l'applique — a chaque ligne, de la meme facon, sans jamais redemander
 * son avis a personne. Deux imports du meme fichier donnent donc exactement le
 * meme resultat, ce qu'un appel par ligne ne pourrait pas garantir.
 *
 * Les valeurs illisibles ne sont PAS corrigees ni supprimees : elles passent
 * telles quelles a la normalisation, qui les mettra en quarantaine avec un
 * motif. Masquer une valeur douteuse serait exactement le defaut qu'on cherche
 * a eviter.
 */
/** Ligne du fichier que la lecture a ecartee, et pourquoi (directive §10 : exclue des faits, conservee dans l'audit). */
export interface LigneEcartee { ligne: number; motif: "ignoree_par_le_plan" | "ligne_de_total"; apercu: string; brut: Record<string, any> }

export function appliquerPlan(plan: PlanImport, matrix: any[][], journal?: LigneEcartee[]): Record<string, any>[] {
  const entetes = (matrix[plan.ligne_entetes] || []).map((h: any, i: number) => String(h ?? "").trim() || `col_${i + 1}`);
  const ignorees = new Set(plan.lignes_ignorees);
  const rattachement = new Map<number, PlanColonne>();
  plan.colonnes.forEach((col) => {
    const idx = entetes.indexOf(col.colonne);
    if (idx >= 0) rattachement.set(idx, col);
  });

  // Une colonne sans champ ne veut pas dire la meme chose selon l'origine du
  // plan : avec les regles, le rattachement n'a simplement pas ete tente et
  // c'est la table de synonymes qui s'en chargera ; avec l'analyse, cela
  // signifie « cette colonne ne correspond a rien » et la reproposer au
  // pipeline irait contre sa lecture. Le discriminant est donc l'origine du
  // PLAN, pas l'etat de la colonne.
  const rattacherParSynonymes = planSansRattachement(plan);

  // Conventions prouvees par chaque colonne entiere (dates, separateur
  // decimal), rattachee ou non : une colonne que les synonymes rattacheront
  // plus loin doit etre lue comme les autres. Une convention annoncee par le
  // plan reste prioritaire pour les dates.
  const donnees = matrix.slice(plan.ligne_entetes + 1).filter((_, k) => !ignorees.has(plan.ligne_entetes + 1 + k));
  const conventions = entetes.map((_, idx) => {
    const valeurs = donnees.map((r) => (r || [])[idx]);
    return { date: rattachement.get(idx)?.convention_date || conventionDateProuvee(valeurs), nombre: conventionNombreProuvee(valeurs) };
  });

  const rows: Record<string, any>[] = [];
  for (let i = plan.ligne_entetes + 1; i < matrix.length; i += 1) {
    const brute = matrix[i] || [];
    if (brute.every((c: any) => String(c ?? "").trim() === "")) continue;
    const apercu = () => brute.filter((c: any) => String(c ?? "").trim() !== "").slice(0, 4).join(" | ").slice(0, 80);
    // La ligne telle que dans le fichier, toutes colonnes comprises, pour
    // original_data (cf. LIGNE_BRUTE) : une colonne que le plan ne rattache a
    // rien sort de la ligne exploitable, pas des donnees conservees.
    const ligneBrute: Record<string, any> = {};
    entetes.forEach((entete, idx) => { ligneBrute[entete] = brute[idx] ?? ""; });
    // Une ligne que le plan ecarte PARCE QUE c'est un total est enregistree comme
    // telle (SUMMARY_ROW), pas comme une simple ligne ignoree : le registre doit
    // dire la vraie raison.
    if (ignorees.has(i)) { journal?.push({ ligne: i + 1, motif: isSummaryOrTotalRow(brute) ? "ligne_de_total" : "ignoree_par_le_plan", apercu: apercu(), brut: ligneBrute }); continue; }
    if (isSummaryOrTotalRow(brute)) { journal?.push({ ligne: i + 1, motif: "ligne_de_total", apercu: apercu(), brut: ligneBrute }); continue; }

    const obj: Record<string, any> = {};
    entetes.forEach((entete, idx) => {
      const col = rattachement.get(idx);
      let valeur = brute[idx] ?? "";

      // Traduction des codes maison ("D" -> expense) decidee par l'analyse.
      if (col?.valeurs) {
        const cle = String(valeur ?? "").trim();
        if (Object.prototype.hasOwnProperty.call(col.valeurs, cle)) valeur = col.valeurs[cle];
      }
      // Convention de date imposee a toute la colonne (annoncee par le plan
      // ou prouvee par ses valeurs : « 11/22/2016 » prouve le MM/JJ de
      // « 11/8/2016 », qui sinon devenait le 11 aout). Si la valeur reste
      // illisible on garde l'originale : la quarantaine dira pourquoi.
      const conv = conventions[idx];
      if (conv.date && typeof valeur === "string" && MOTIF_DATE_COURTE.test(valeur.trim())) {
        const d = parseDate(valeur, conv.date);
        if (d !== null) valeur = d;
      }
      if (conv.nombre) valeur = nombreSelonConvention(valeur, conv.nombre);

      if (col && col.champ) {
        obj[col.champ] = valeur;
      } else if (!col || (rattacherParSynonymes && !col.exclue)) {
        // Colonne jamais rattachée par le plan (ou plan par règles, qui
        // n'a pas tenté le rattachement) : on conserve l'entête d'origine
        // pour que le dictionnaire d'alias et la normalisation la rattrapent.
        obj[entete] = valeur;
      }
      // Sinon : l'analyse a explicitement jugé cette colonne sans
      // correspondance (col.champ === null) — on ne la réintroduit pas.
    });
    if (isSummaryOrTotalRow(obj)) { journal?.push({ ligne: i + 1, motif: "ligne_de_total", apercu: apercu(), brut: ligneBrute }); continue; }
    if (Object.keys(obj).length > 0) {
      Object.defineProperty(obj, LIGNE_BRUTE, { value: ligneBrute, enumerable: false, configurable: true });
      // configurable : le retraitement y remet le numero de ligne du fichier d'origine.
      Object.defineProperty(obj, NUMERO_LIGNE, { value: i + 1, enumerable: false, configurable: true });
      rows.push(obj);
    }
  }
  return rows;
}


// ---------------------------------------------------------------------------
// 8. Memoire : reconnaitre un fichier deja vu
// ---------------------------------------------------------------------------

/**
 * Empreinte d'un fichier, calculee sur ses seuls intitules de colonnes.
 *
 * Deux exports mensuels du meme logiciel ont les memes colonnes et des donnees
 * differentes : l'empreinte doit donc ignorer le contenu. Elle ignore aussi
 * l'ordre des colonnes, les accents, la casse et les espaces — un export qui
 * deplace une colonne reste le meme export.
 *
 * Sert a retrouver un plan que l'utilisateur a deja valide, pour ne pas lui
 * redemander le mois suivant ce qu'il a corrige une fois.
 */
export function signatureFichier(entetes: any[]): string {
  return entetes
    .map((h) => stripAccents(String(h ?? "").trim().toLowerCase()).replace(/\s+/g, " "))
    .filter((h) => h !== "")
    .sort()
    .join("|");
}

// ---------------------------------------------------------------------------
// Memoire d'apprentissage croise (lot 5.3, rapport du 25 sept. 2026)
// ---------------------------------------------------------------------------

const normMemoire = (s: string) => stripAccents(String(s || "").toLowerCase()).replace(/[^a-z0-9]/g, "");

/**
 * Plans confirmes -> entrees de memoire au format de la reconnaissance
 * (MappingMemoryEntry). Seules les colonnes rattachees par un humain sont
 * apprises : ce sont les vraies corrections ; le reste est deja trouve par les
 * regles. Tout plan mal forme est ignore.
 */
export function memoireDepuisPlans(plans: any[]): any[] {
  const out: any[] = [];
  for (const p of plans || []) {
    if (!p || !Array.isArray(p.colonnes)) continue;
    const freres = p.colonnes.map((c: any) => normMemoire(c?.colonne)).filter(Boolean).sort().join("|");
    for (const c of p.colonnes) {
      if (!c?.champ || c.source !== "humain" || typeof c.colonne !== "string") continue;
      out.push({
        columnName: normMemoire(c.colonne), sourceContext: normMemoire(p.entite || ""), siblingSignature: freres,
        resolvedCanonicalKey: c.champ, resolvedSemanticType: "unknown", confirmedBy: "user",
        usageCount: 1, lastUsed: new Date().toISOString(), confidence: 0.95,
      });
    }
  }
  return out;
}
