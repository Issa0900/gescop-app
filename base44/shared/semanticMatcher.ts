/**
 * GESCOP - Semantic Matcher
 * 
 * Etape 2 du Pipeline SǸmantique (Phase 1)
 * Rle : Associer chaque colonne profilǸe  un "Concept MǸtier" canonique
 * avec un score de confiance, au lieu de faire un simple mapping de nom de colonne.
 */

import type { ColumnProfile } from './dataProfiler.ts';
import { buildConceptMappingsFromRegistry } from './registry/generateAliases.ts';
import { CONCEPTS } from './registry/conceptRegistry.ts';

export type SemanticMatch = {
  concept: string;         // e.g. "finance.revenue", "temporal.date", "customer.id"
  confidence: number;      // 0.0 to 1.0
  method: string;          // "exact_match", "synonym+type", "ai_inference"
  requiresValidation: boolean;
};

// Genere depuis le registre unique (registry/conceptRegistry.ts, spec v2 section 3).
// Ne plus ajouter de concept ici : l'ajouter au registre, qui alimente aussi
// FIELD_ALIASES et contextualRecognition.ts pour que les trois couches ne
// puissent plus diverger comme elles l'ont fait pour "Facebook Ads".
const CONCEPT_MAPPINGS = buildConceptMappingsFromRegistry();

/**
 * Mots d'un intitule, sans accents ni ponctuation : « Chiffre d'affaires ($) »
 * -> [chiffre, d, affaires] ; « total_revenue » -> [total, revenue].
 *
 * La comparaison se fait mot a mot. Avant, l'intitule etait colle en un seul
 * bloc (« chiffredaffaires ») mais pas les mots-cles (« chiffre d affaires ») :
 * aucun mot-cle de plusieurs mots ne pouvait correspondre. Et la recherche
 * « contient » trouvait « ca » dans « cash_in » ou « categorie » : une
 * recette de caisse devenait du chiffre d'affaires.
 */
function mots(str: string): string[] {
  return String(str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** La suite de mots `cherche` apparait-elle, d'un seul tenant, dans `dans` ? */
function contientSuite(dans: string[], cherche: string[]): boolean {
  if (cherche.length === 0 || cherche.length > dans.length) return false;
  for (let i = 0; i + cherche.length <= dans.length; i++) {
    if (cherche.every((m, j) => dans[i + j] === m)) return true;
  }
  return false;
}

/**
 * Noms de champs des entites GESCOP -> concept. Les lignes passees au moteur
 * sont souvent deja rattachees (« total_cost », « spend ») : ces noms-la sont
 * sans ambiguite. Tenus ici plutot que dans le lexique du registre, qui
 * alimente aussi les synonymes de l'import (ALIAS_CANONIQUES) : y ajouter
 * « total_cost » aurait change le rattachement des colonnes « Coût total ».
 */
const CONCEPT_PAR_CHAMP: Record<string, string> = {
  // Chaque concept du registre sur son propre champ (quantity, unit_price,
  // closing_stock...) : le champ est toujours reconnu, meme quand son nom
  // n'a pas pu entrer dans le lexique parce qu'il y designait deja autre chose.
  ...Object.fromEntries(Object.values(CONCEPTS).map((c) => [c.canonicalKey, c.conceptId])),
  total_revenue: "finance.revenue",
  total_cost: "finance.cogs", cogs: "finance.cogs",
  gross_margin: "finance.grossMargin",
  closing_cash: "finance.cashBalance",
  spend: "marketing.spend",
  ctr: "marketing.ctr", cpc: "marketing.cpc", roas: "marketing.roas",
  customer_id: "customer.id",
  date: "temporal.date",
};

/**
 * Qualificatifs qui ne changent pas le sens d'un mot-cle d'un seul mot :
 * « CA HT », « Remise (CAD) », « Total Ventes ». Tout autre mot le change
 * (« Quantite_Reservee » n'est pas une quantite vendue) : un mot-cle d'un seul
 * mot ne correspond partiellement qu'entoure de ces qualificatifs.
 */
const QUALIFICATIFS_NEUTRES = new Set(["ligne", "line", "ht", "ttc", "brut", "brute", "net", "nette", "total", "totale", "cad", "usd", "eur", "dollars", "d", "de", "du", "des", "l", "la", "le", "les", "en"]);

/** Mots qui font d'une colonne une QUANTITE, jamais un montant (« Ventes (unités) »). */
const MARQUEURS_QUANTITE = new Set(["unite", "unites", "unit", "units", "qte", "qty", "quantite", "quantity", "nombre", "nb", "volume", "pieces"]);
/** Mots qui font d'une colonne un PRIX unitaire, jamais un flux (« Prix_Vente_CAD » n'est pas du chiffre d'affaires). */
const MARQUEURS_PRIX = new Set(["prix", "price", "tarif", "unitaire", "pu", "msrp"]);
/** Unites non monetaires : « Solde_Points_Fidelite » est un solde de POINTS, pas de tresorerie. */
const MARQUEURS_NON_MONETAIRES = new Set(["points", "point", "fidelite", "loyalty", "jours", "days", "heures", "hours", "score", "note", "rang", "taux", "rate", "pct", "pourcentage"]);

/**
 * Tente de relier un profil de colonne a un concept metier connu.
 */
export function matchConcept(profile: ColumnProfile): SemanticMatch | null {
  const motsColonne = mots(profile.columnName);
  const champ = motsColonne.join("_");
  if (CONCEPT_PAR_CHAMP[champ]) {
    return { concept: CONCEPT_PAR_CHAMP[champ], confidence: 1.0, method: "champ_entite", requiresValidation: false };
  }
  const estUneQuantite = motsColonne.some((m) => MARQUEURS_QUANTITE.has(m));
  const estUnPrix = motsColonne.some((m) => MARQUEURS_PRIX.has(m));
  const nonMonetaire = motsColonne.some((m) => MARQUEURS_NON_MONETAIRES.has(m));

  let bestMatch: SemanticMatch | null = null;

  for (const mapping of CONCEPT_MAPPINGS) {
    // 1. VǸrifier la compatibilitǸ des types
    const typeIsCompatible = Array.isArray(mapping.type) 
      ? mapping.type.includes(profile.inferredType)
      : mapping.type === profile.inferredType;

    if (!typeIsCompatible && profile.inferredType !== 'unknown') {
      continue; // Le type de donnee ne correspond pas du tout au concept
    }
    // Une quantite (« Ventes (unités) ») n'est jamais un montant.
    // Seulement pour un montant qui s'additionne ou se cumule (flux, solde) :
    // un prix unitaire ou un taux horaire SONT des prix ou des taux.
    const montantCumulable = mapping.type.includes("currency") && (mapping.kind === "FLOW" || mapping.kind === "STOCK");
    if ((estUneQuantite || estUnPrix || nonMonetaire) && montantCumulable) continue;

    // 2. Recherche par mots-clǸs (Scoring)
    let score = 0;
    for (const kw of mapping.keywords) {
      const motsCle = mots(kw);
      if (motsCle.length === 0) continue;
      if (motsCle.join(" ") === motsColonne.join(" ")) {
        score = 1.0; // Match exact
        break;
      } else if (contientSuite(motsColonne, motsCle)
        && (motsCle.length > 1 || motsColonne.every((m) => motsCle.includes(m) || QUALIFICATIFS_NEUTRES.has(m)))) {
        score = 0.7; // Match partiel, sur des mots entiers (« CA HT », « total_revenue »)
      }
    }

    // 3. Bonus si le type correspond parfaitement
    if (score > 0 && typeIsCompatible) {
      score = Math.min(1.0, score + 0.2);
    }

    if (score > 0.5 && (!bestMatch || score > bestMatch.confidence)) {
      bestMatch = {
        concept: mapping.concept,
        confidence: score,
        method: score === 1.0 ? 'exact_match' : 'synonym+type',
        requiresValidation: score < 0.8
      };
    }
  }

  return bestMatch;
}

