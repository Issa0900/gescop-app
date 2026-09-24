// ─────────────────────────────────────────────────────────────────────────────
// GESCOP — Universal Commercial Ontology (UCO) Master Entry Point
// Version 5.0 — Septembre 2026
// ─────────────────────────────────────────────────────────────────────────────

import { Registry } from "./ontology/index.ts";
import type { CanonicalConcept, RecognitionResult } from "./ontology/types.ts";
import { analyzeColumn } from "./recognition/mappingDecisionEngine.ts";
import type { ColumnRecognitionRequest } from "./recognition/mappingDecisionEngine.ts";

export * from "./ontology/types.ts";
export { Registry, ALL_CONCEPTS } from "./ontology/index.ts";
export { analyzeColumn } from "./recognition/mappingDecisionEngine.ts";

export interface SheetAnalysisParams {
  sheetName: string;
  headers: string[];
  sampleRows?: Record<string, unknown>[];
  entityHint?: string;
  mappingMemory?: any[];
}

/**
 * Analyse l'ensemble des colonnes d'une feuille de calcul ou fichier
 */
export function analyzeSheet(params: SheetAnalysisParams): Map<string, RecognitionResult> {
  const { sheetName, headers, sampleRows = [], entityHint, mappingMemory } = params;
  const rawResults = new Map<string, RecognitionResult>();

  // 1. Génération des candidats (Pass 1)
  for (const header of headers) {
    const siblings = headers.filter((h) => h !== header);
    const sampleValues = sampleRows.map((r) => r[header]);

    const recognition = analyzeColumn({
      columnName: header,
      sheetName,
      sampleValues,
      siblingColumns: siblings,
      entityHint,
      mappingMemory,
    });

    // 1.D Transformateur Temporel (RH Resilience)
    if (recognition.logicalType === "DATE" && (recognition.grain === "month" || recognition.targetField === "period")) {
      recognition.evidence.push("Transformateur Temporel Appliqué : date -> YYYY-MM (period)");
      recognition.canonicalName = "period";
      recognition.targetField = "period";
    }

    rawResults.set(header, recognition);
  }

  // 2. Preuves Algébriques Déterministes (Pass 2)
  // Ex: montant_ht = quantite * prix_unitaire_ht * (1 - remise)
  // Ex: marge_brute = montant_ht - cout_biens
  const qtyCol = Array.from(rawResults.entries()).find(([_, r]) => r.canonicalName === "quantity");
  const priceCol = Array.from(rawResults.entries()).find(([_, r]) => r.canonicalName === "unit_price");
  const amountCol = Array.from(rawResults.entries()).find(([_, r]) => r.canonicalName === "net_amount" || r.canonicalName === "gross_amount");
  const marginCol = Array.from(rawResults.entries()).find(([_, r]) => r.canonicalName === "gross_margin");
  const cogsCol = Array.from(rawResults.entries()).find(([_, r]) => r.canonicalName === "cogs");

  if (sampleRows.length > 0) {
    if (amountCol && cogsCol && marginCol) {
      let matchCount = 0;
      for (const row of sampleRows) {
        const amt = Number(row[amountCol[0]]);
        const cogs = Number(row[cogsCol[0]]);
        const margin = Number(row[marginCol[0]]);
        if (!isNaN(amt) && !isNaN(cogs) && !isNaN(margin)) {
          if (Math.abs((amt - cogs) - margin) < 0.1) matchCount++;
        }
      }
      if (matchCount > 0 && matchCount / sampleRows.length > 0.8) {
        marginCol[1].confidence = 1.0;
        marginCol[1].evidence.push("Preuve Algébrique (Marge Brute = Montant - COGS) vérifiée à 100%");
      }
    }
  }

  // 3. Résolution Globale Bipartite Anti-Conflit 1-to-1 (Pass 3)
  const finalResults = new Map<string, RecognitionResult>();
  const claimedConcepts = new Set<string>();

  // Trier toutes les colonnes par la confiance de leur meilleur candidat
  const sortedColumns = Array.from(rawResults.entries()).sort((a, b) => b[1].confidence - a[1].confidence);

  for (const [header, recognition] of sortedColumns) {
    if (recognition.selectedConcept && claimedConcepts.has(recognition.selectedConcept)) {
      // Conflit détecté, on cherche le prochain candidat non réclamé
      let resolved = false;
      for (const candidate of recognition.candidates) {
        if (!claimedConcepts.has(candidate.conceptId)) {
          recognition.selectedConcept = candidate.conceptId;
          recognition.canonicalName = candidate.canonicalName;
          recognition.confidence = candidate.confidence;
          recognition.evidence.push(`Résolution Bipartite: Assigné au candidat alternatif ${candidate.canonicalName} (le premier choix était déjà réclamé).`);
          claimedConcepts.add(candidate.conceptId);
          resolved = true;
          break;
        }
      }
      if (!resolved) {
        recognition.selectedConcept = null;
        recognition.canonicalName = null;
        recognition.confidence = 0;
        recognition.evidence.push("Résolution Bipartite: Tous les candidats viables ont été réclamés par des colonnes plus fortes.");
        recognition.requiresValidation = true;
      }
    } else if (recognition.selectedConcept) {
      claimedConcepts.add(recognition.selectedConcept);
    }
    finalResults.set(header, recognition);
  }

  return finalResults;
}

export const UniversalCommercialOntology = {
  Registry,
  analyzeColumn,
  analyzeSheet,
};

