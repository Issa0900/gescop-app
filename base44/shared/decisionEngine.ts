/**
 * GESCOP - AI Decision Engine
 * 
 * Phase 6 du Pipeline d'Intelligence
 * Rle : Point d'entrǸe sǸcurisǸ pour le LLM. Il structure le contexte (Evidences, KPIs, Signaux)
 * et formate la rǸponse sous forme d'actions claires (Classification d'Insight).
 */

import { InsightWithEvidence } from './evidenceEngine.ts';

export type AIResponseClass = 'FACT' | 'CALCULATION' | 'OBSERVATION' | 'INFERENCE' | 'HYPOTHESIS' | 'RECOMMENDATION';

export type StructuredAIDecision = {
  classification: AIResponseClass;
  text: string;
  confidence: number;
  based_on: InsightWithEvidence[];
};

/**
 * Wrapper simulant la prǸparation du prompt pour le LLM.
 * Le LLM reoit ces donnǸes structurǸes et retourne un objet `StructuredAIDecision`.
 */
export function prepareDecisionContext(
  question: string,
  insights: InsightWithEvidence[]
): any {
  return {
    system_prompt: "You are GESCOP AI. Base your answers ONLY on the provided evidence.",
    user_intent: question,
    facts: insights.filter(i => i.evidence.some(e => e.type === 'quantitative')),
    qualitative_signals: insights.filter(i => i.evidence.some(e => e.type === 'qualitative')),
    external_signals: insights.filter(i => i.evidence.some(e => e.type === 'external')),
    limitations: "Do not state causality unless supported by an external event and qualitative consensus."
  };
}

/**
 * Parse la rǸponse du LLM (mock) pour s'assurer qu'elle respecte le format dǸcisionnel.
 */
export function parseDecisionResponse(llmOutput: any): StructuredAIDecision {
  // En production, valider le JSON renvoyǸ par le LLM
  return {
    classification: llmOutput.classification || 'INFERENCE',
    text: llmOutput.text || 'Analyse en cours...',
    confidence: llmOutput.confidence || 0.5,
    based_on: llmOutput.based_on || []
  };
}

/**
 * Garde-fou serveur (audit du 23 sept) : chatAssistant/entry.ts et
 * generateReport/entry.ts demandent au LLM de classifier chaque affirmation
 * (FACT/CALCULATION/OBSERVATION/INFERENCE/HYPOTHESIS/RECOMMENDATION) avec une
 * confidence et des sources, mais rien ne verifiait cote serveur que le LLM a
 * reellement respecte cette consigne avant de renvoyer la reponse au client.
 * Cette fonction est ce controle. Elle n'attend pas le format mock
 * StructuredAIDecision (based_on: InsightWithEvidence[]) ci-dessus -- c'est le
 * format REEL produit par ces deux fonctions (classification/text/confidence/
 * sources en chaines) qu'elle valide, sans reecrire l'existant.
 */
export type RawClassifiedResponse = {
  classification?: string;
  text: string;
  confidence?: number;
  sources?: string[];
};

export type ValidationResult = {
  valid: boolean;
  reason: string | null;
};

const VALID_CLASSIFICATIONS = ['FACT', 'CALCULATION', 'OBSERVATION', 'INFERENCE', 'HYPOTHESIS', 'RECOMMENDATION'];

// Confidence minimale tolerable pour une affirmation classee FACT ou
// CALCULATION : ces deux classes pretendent etre directement verifiables, une
// confidence basse dessus est le signe que le LLM a mal classe sa reponse.
const STRICT_CLASS_MIN_CONFIDENCE = 0.6;

// Marqueurs d'incertitude en francais : leur presence dans le texte est
// incompatible avec une classification FACT/CALCULATION (qui ne devrait
// jamais se couvrir de reserves).
const HEDGE_WORDS = [
  'peut-être', 'peut etre', 'probablement', 'pourrait', 'pourraient', 'semble',
  'semblerait', 'hypothèse', 'hypothese', 'il est possible', 'vraisemblablement',
  'incertain', 'à confirmer', 'a confirmer', 'sous réserve', 'sous reserve',
];

export function validateStructuredResponse(input: RawClassifiedResponse): ValidationResult {
  const classification = (input.classification || '').toUpperCase();
  const text = (input.text || '').toLowerCase();
  const confidenceRaw = input.confidence;

  if (!classification || !VALID_CLASSIFICATIONS.includes(classification)) {
    return { valid: false, reason: `classification absente ou inconnue ("${input.classification ?? ''}")` };
  }
  if (confidenceRaw === undefined || confidenceRaw === null || Number.isNaN(Number(confidenceRaw))) {
    return { valid: false, reason: 'confidence manquante' };
  }

  // confidence est parfois exprimee en 0..100 (voir confidence_pct ailleurs
  // dans le pipeline) plutot qu'en 0..1 : on normalise avant de comparer.
  const confidence = Number(confidenceRaw) > 1 ? Number(confidenceRaw) / 100 : Number(confidenceRaw);
  if (confidence < 0 || confidence > 1) {
    return { valid: false, reason: `confidence hors intervalle (${confidenceRaw})` };
  }

  const isStrictClass = classification === 'FACT' || classification === 'CALCULATION';

  if (isStrictClass && confidence < STRICT_CLASS_MIN_CONFIDENCE) {
    return { valid: false, reason: `confidence trop basse (${confidence}) pour une affirmation classée ${classification}` };
  }

  const hasHedge = HEDGE_WORDS.some((w) => text.includes(w));
  if (isStrictClass && hasHedge) {
    return { valid: false, reason: `le texte contient des marqueurs d'incertitude incompatibles avec la classification ${classification}` };
  }

  if (isStrictClass && (!input.sources || input.sources.length === 0)) {
    return { valid: false, reason: `classification ${classification} sans sources citées` };
  }

  return { valid: true, reason: null };
}

