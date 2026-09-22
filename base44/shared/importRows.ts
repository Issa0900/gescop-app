// Traitement des lignes d'une feuille, partage par l'import (importMultiData)
// et le retraitement sans reimport (reprocessImport, directive §18) : les deux
// chemins appliquent exactement les memes regles, le retraitement n'est pas une
// seconde implementation qui divergerait.

import {
  normalizeRow, normalizeKeys, isSummaryOrTotalRow, deriveFallbackIdentity,
  LIGNE_BRUTE, NUMERO_LIGNE, type TraceNormalisation,
} from "./importUtils.ts";
import {
  ROW_STATUS, REASON, REASON_LABEL, RECOVERY, recoveryInitial, metriquesVides, motifChampManquant,
  type ImportIssueRecord, type ReasonCode, type RowStatus,
} from "./importStatus.ts";
import { planSansRattachement, type PlanImport, type LigneEcartee } from "./importPlan.ts";
import { insertRows, missingRequired } from "./bulkInsert.ts";
import { normalizeRow as normalizeRowForCore } from "./normalizationEngine.ts";
import { profileData } from "./dataProfiler.ts";
import { matchConcept } from "./semanticMatcher.ts";
import { detectGrain } from "./grainEngine.ts";
import { generateObservations } from "./observationEngine.ts";
import { deduplicateRows, LIGNE_SOURCE } from "./deduplication.ts";
import { resumeStatuts } from "./core/recognition/preuves.ts";
import { valeursInhabituelles } from "./core/recognition/relations.ts";
import { getSchema } from "./entitySchemas.ts";

/** Sur une ligne reconstruite depuis le registre : l'entree ImportIssue d'origine. */
export const ID_ISSUE = Symbol.for("gescop.issueSource");

/** Le registre d'un import : chaque ligne qui n'entre pas dans les donnees. */
export async function ecrireRegistre(base44: any, issues: ImportIssueRecord[]): Promise<{ ecrites: number; erreur?: string }> {
  let ecrites = 0;
  for (let i = 0; i < issues.length; i += 200) {
    try {
      await base44.entities.ImportIssue.bulkCreate(issues.slice(i, i + 200));
      ecrites += Math.min(200, issues.length - i);
    } catch (e: any) {
      // Le registre ne doit jamais faire echouer l'import lui-meme ; on dit
      // seulement qu'il est incomplet.
      return { ecrites, erreur: `registre des lignes écartées incomplet (${e?.message || e})` };
    }
  }
  return { ecrites };
}

export const json = (v: any) => { try { return JSON.stringify(v).slice(0, 20000); } catch { return ""; } };

/** Resume lisible des motifs : « 2 date illisible, 1 doublon ». */
export function resumeMotifs(reasons: Partial<Record<ReasonCode, number>>): string {
  return Object.entries(reasons)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .map(([code, n]) => `${n} ${REASON_LABEL[code as ReasonCode] || code}`)
    .join(", ");
}

export interface OptionsTraitement {
  /** Import auquel les lignes (et leurs entrees de registre) sont rattachees. */
  importId: string;
  entityName: string;
  rows: Record<string, any>[];
  sourceType: string;
  fileLabel: string;
  plan?: PlanImport | null;
  companyDictionary?: Record<string, string>;
  ecartees?: LigneEcartee[];
}

/** Ce qu'est devenue une ligne venue du registre (retraitement, Phase 3). */
export interface ResultatReprise {
  issueId: string;
  issue: ImportIssueRecord | null;
  recuperee: boolean;
}

/**
 * Le traitement des lignes d'une feuille, commun a l'import et au retraitement
 * (reprocessImport) : normalisation, validation, deduplication, ecriture, et
 * registre de tout ce qui n'entre pas dans les donnees. Une ligne qui vient du
 * registre (porte ID_ISSUE) ne cree pas de nouvelle entree : son sort est rendu
 * dans `reprises`, pour mettre a jour l'entree existante.
 */
export async function traiterLignes(base44: any, o: OptionsTraitement) {
  const { importId, entityName, rows, sourceType, fileLabel, companyDictionary } = o;
  const ecartees = o.ecartees || [];
  const memoire = o.plan ? { plan: o.plan } : undefined;
  const schema = getSchema(entityName);
  const properties = schema ? schema.properties : null;
  const required = schema ? schema.required : [];
  const reprises: ResultatReprise[] = [];

  // Chaque ligne du fichier finit dans exactement un statut (importStatus.ts),
  // et chaque ligne qui n'entre pas dans les donnees laisse une trace dans le
  // registre, avec son contenu brut et un motif precis.
  const metrics = metriquesVides();
  const issues: ImportIssueRecord[] = [];
  const noter = (
    rowStatus: RowStatus, reason: ReasonCode,
    source: { brut: any; ligne: number | null; mapped?: any; issueId?: string },
    extra: { field?: string; raw_value?: string; detail?: string } = {},
  ) => {
    metrics.reasons[reason] = (metrics.reasons[reason] || 0) + 1;
    const entree: ImportIssueRecord = {
      import_id: importId, file_name: fileLabel, entity_type: entityName,
      row_number: source.ligne, row_status: rowStatus, reason_code: reason,
      ...extra,
      raw_row: json(source.brut),
      mapped_row: source.mapped ? json(source.mapped) : undefined,
      recovery_status: recoveryInitial(reason),
    };
    // Ligne deja au registre (retraitement) : on met a jour son entree.
    if (source.issueId) reprises.push({ issueId: source.issueId, issue: entree, recuperee: false });
    else issues.push(entree);
  };
  const origine = (row: any) => ({
    brut: row?.[LIGNE_BRUTE] || row,
    ligne: (row?.[NUMERO_LIGNE] ?? null) as number | null,
    issueId: row?.[ID_ISSUE] as string | undefined,
  });

  // Lignes que la lecture du plan a deja ecartees (totaux, lignes ignorees).
  for (const e of ecartees) {
    if (e.motif === "ligne_de_total") {
      metrics.summary_rows++;
      noter(ROW_STATUS.SUMMARY_ROW, REASON.SUMMARY_ROW, { brut: e.brut, ligne: e.ligne });
    } else {
      metrics.ignored_rows++;
      noter(ROW_STATUS.IGNORED_ROW, REASON.IGNORED_BY_PLAN, { brut: e.brut, ligne: e.ligne });
    }
  }

  const toCreate: Record<string, any>[] = [];
  // D'ou vient chaque ligne normalisee : un doublon ou un refus a l'ecriture
  // doit pouvoir etre rattache a sa ligne du fichier.
  const sources = new Map<Record<string, any>, { brut: any; ligne: number | null; issueId?: string }>();
  // Observations de chaque ligne normalisee : elles ne sont enregistrees que
  // pour les lignes reellement ecrites (plus pour les doublons exclus ni les
  // refus a l'ecriture), et reliees a leur ligne (import_id + row_ref) pour
  // pouvoir etre retirees avec elle.
  const observationsDe = new Map<Record<string, any>, any[]>();
  const aControler: { valeurs: Record<string, any>; src: { brut: any; ligne: number | null; issueId?: string } }[] = [];
  const missingFields = new Set<string>();
  const samples: string[] = [];
  // Values present in the file but refused by the schema, counted per field and
  // per value so the report can name them instead of claiming the field is absent.
  const refusedValues: Record<string, Record<string, number>> = {};
  const allowedByField: Record<string, string[]> = {};
  // Colonnes du fichier qui n'ont pu être associées à aucun champ de
  // l'entité cible — un fichier peut "réussir" son import tout en ayant
  // silencieusement ignoré une colonne financière que personne n'a vue.
  const unmappedColumns = new Set<string>();
  // Colonnes que le plan (IA ou humain) a explicitement laissees sans champ :
  // appliquerPlan les retire de la ligne, normalizeKeys ne les voit donc
  // jamais et elles manquaient au rapport. Leur valeur brute reste dans
  // original_data (cf. LIGNE_BRUTE). Un plan par regles n'a rien decide : ses
  // colonnes sans champ passent par les synonymes et sont signalees la-bas.
  if (memoire?.plan) {
    const decide = !planSansRattachement(memoire.plan);
    memoire.plan.colonnes
      .filter((c) => !c.champ && (decide || c.exclue) && String(c.colonne || "").trim())
      .forEach((c) => unmappedColumns.add(c.colonne));
  }
  const trace: TraceNormalisation = { replis: [], derives: [] };

  // ── NOUVEAU PIPELINE SÉMANTIQUE (Phase 1) ──
  let profile, matchedConcepts, grain;
  try {
    profile = profileData(rows.slice(0, 50));
    matchedConcepts = {};
    for (const [col, p] of Object.entries(profile.columns)) {
      const match = matchConcept(p);
      if (match) matchedConcepts[col] = match;
    }
    grain = detectGrain(profile, matchedConcepts);
  } catch(e) { console.error("Semantic engine failed", e); }

  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") return;
    const src = origine(row);
    if (isSummaryOrTotalRow(row)) {
      metrics.summary_rows++;
      noter(ROW_STATUS.SUMMARY_ROW, REASON.SUMMARY_ROW, src);
      return;
    }
    const enumIssues: { field: string; value: string; allowed: string[] }[] = [];
    const normalized = normalizeRow(entityName, row, importId, properties, sourceType, enumIssues, unmappedColumns, companyDictionary, trace);
    if (Object.keys(normalized).filter((k) => k !== "import_id").length === 0) {
      // Rien dans cette ligne ne se rattache a un champ de l'entite : elle est
      // lisible, mais son sens est inconnu. Conservee, pas supprimee (§1, §2).
      metrics.unknown_rows++;
      noter(ROW_STATUS.UNKNOWN, REASON.UNKNOWN_CONCEPT, src, { detail: `aucune valeur rattachée à un champ de ${entityName}` });
      return;
    }
    deriveFallbackIdentity(entityName, normalized, index);
    // Reject up front rather than letting one row fail its whole batch.
    const missing = missingRequired(normalized, required);
    if (missing.length > 0) {
      const brutParChamp = normalizeKeys(row, properties || undefined, undefined, companyDictionary);
      missing.forEach((m) => {
        // Was the field actually absent, or present with a refused value?
        const refused = enumIssues.find((e) => e.field === m);
        if (refused) {
          if (!refusedValues[m]) refusedValues[m] = {};
          refusedValues[m][refused.value] = (refusedValues[m][refused.value] || 0) + 1;
          allowedByField[m] = refused.allowed;
        } else {
          missingFields.add(m);
        }
      });
      // Un seul motif par ligne (le premier champ en cause) : une ligne = une
      // entree du registre ; les autres champs sont cites dans le detail.
      const premier = missing[0];
      const motif = motifChampManquant(premier, brutParChamp[premier], properties?.[premier], enumIssues.find((e) => e.field === premier));
      metrics.quarantined_rows++;
      noter(ROW_STATUS.QUARANTINED, motif.reason, { ...src, mapped: normalized }, {
        field: premier, raw_value: motif.raw_value,
        detail: missing.length > 1 ? `champs en cause : ${missing.join(", ")}` : undefined,
      });
      if (samples.length < 2) samples.push(JSON.stringify(row).slice(0, 220));
      return;
    }
    toCreate.push(normalized);
    sources.set(normalized, src);
    // Valeurs du fichier par champ, pour reperer ensuite les valeurs
    // inhabituelles — avant toute correction (Transaction stocke |montant|).
    aControler.push({ valeurs: normalizeKeys(row, properties || undefined, undefined, companyDictionary), src });

    // Génération de l'Observation
    if (profile && matchedConcepts && grain) {
      const normalizedObs = normalizeRowForCore(row, profile.columns);
      const obsList = generateObservations(normalizedObs, matchedConcepts, fileLabel, grain);
      observationsDe.set(normalized, obsList);
    }
  });

  const messages: string[] = [];
  if (unmappedColumns.size > 0) {
    messages.push(
      `${unmappedColumns.size} colonne(s) non reconnue(s) et ignorée(s) pour ${entityName} : ${Array.from(unmappedColumns).slice(0, 10).join(", ")}` +
      (unmappedColumns.size > 10 ? "…" : "") +
      ". Leur contenu brut reste conservé dans original_data si besoin de le récupérer.",
    );
  }

  if (trace.replis.length > 0) {
    const parChamp: Record<string, Record<string, number>> = {};
    trace.replis.forEach(({ field, value }) => {
      parChamp[field] ||= {};
      parChamp[field][value] = (parChamp[field][value] || 0) + 1;
    });
    for (const [champ, valeurs] of Object.entries(parChamp)) {
      const liste = Object.entries(valeurs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v, n]) => `« ${v} » (${n})`).join(", ");
      messages.push(`${champ} : valeur(s) non reconnue(s) rangée(s) sous « autre » — ${liste}. La valeur d'origine reste dans original_data.`);
    }
  }
  if (trace.derives.length > 0) {
    const parChamp: Record<string, number> = {};
    trace.derives.forEach(({ field }) => { parChamp[field] = (parChamp[field] || 0) + 1; });
    for (const [champ, n] of Object.entries(parChamp)) {
      if (champ === "reference_date") {
        messages.push(`${n} ligne(s) d'inventaire sans date dans le fichier : date réelle inconnue (laissée vide). `
          + `La date d'import est conservée à part, comme simple référence technique — les calculs qui exigent la date réelle ne l'utilisent pas.`);
        continue;
      }
      messages.push(`${champ} absent du fichier pour ${n} ligne(s) : identifiant technique AUTO-… attribué (tiré du contenu de la ligne).`);
    }
  }

  // Valeurs inhabituelles (§8) : ni supprimees ni corrigees, signalees. La
  // ligne est importee ; une entree d'audit la rend retrouvable.
  const inhabituelles = valeursInhabituelles(aControler.map((l) => l.valeurs));
  metrics.anomalous_values = inhabituelles.length;
  for (const a of inhabituelles) {
    const { src } = aControler[a.indice];
    issues.push({
      import_id: importId, file_name: fileLabel, entity_type: entityName, row_number: src.ligne,
      row_status: ROW_STATUS.ANOMALOUS, reason_code: REASON.ANOMALOUS_VALUE,
      field: a.champ, raw_value: String(a.valeur), detail: a.motif,
      raw_row: json(src.brut), recovery_status: RECOVERY.NOT_APPLICABLE,
    });
  }
  if (inhabituelles.length > 0) {
    const exemples = inhabituelles.slice(0, 3).map((a) => {
      const ligne = aControler[a.indice].src.ligne;
      return `${a.champ} = ${a.valeur}${ligne ? ` (ligne ${ligne})` : ""} : ${a.motif}`;
    }).join(" ; ");
    messages.push(`${inhabituelles.length} valeur(s) inhabituelle(s) conservée(s), à vérifier — ${exemples}${inhabituelles.length > 3 ? "…" : ""}.`);
  }

  // GESCOP Phase 5 SSOT: Deduplication
  const { newRows, duplicateCount, duplicates, potentialDuplicates } = await deduplicateRows(base44, entityName, toCreate);
  // Lignes identiques a une autre du fichier, sans identifiant pour prouver
  // le doublon : conservees (elles sont dans newRows), signalees pour
  // verification. Les exclure d'office pouvait diviser des ventes par deux.
  metrics.potential_duplicates = potentialDuplicates.length;
  for (const { row, premiere } of potentialDuplicates) {
    const src = sources.get(row) || { brut: row, ligne: null };
    const ligneDeRef = sources.get(premiere)?.ligne;
    issues.push({
      import_id: importId, file_name: fileLabel, entity_type: entityName, row_number: src.ligne,
      row_status: ROW_STATUS.DUPLICATE_EXACT, reason_code: REASON.DUPLICATE_EXACT, review_status: "A_VERIFIER",
      detail: `strictement identique à ${ligneDeRef ? `la ligne ${ligneDeRef}` : "une autre ligne"} du fichier — conservée, vérification requise avant exclusion`,
      raw_row: json(src.brut), mapped_row: json(row), recovery_status: RECOVERY.NOT_APPLICABLE,
    });
  }
  if (potentialDuplicates.length > 0) {
    const lignes = potentialDuplicates.slice(0, 5).map(({ row }) => sources.get(row)?.ligne).filter(Boolean).join(", ");
    messages.push(`Doublon potentiel détecté — ${potentialDuplicates.length} ligne(s) strictement identique(s) à une autre du fichier${lignes ? ` (ligne(s) ${lignes})` : ""}. Conservée(s) pour préserver les données ; vérification requise avant exclusion.`);
  }
  for (const d of duplicates) {
    metrics.duplicate_rows++;
    noter(ROW_STATUS.DUPLICATE, REASON.DUPLICATE_RECORD, { ...(sources.get(d) || { brut: d, ligne: null }), mapped: d });
  }
  if (duplicateCount > 0) {
    messages.push(`${duplicateCount} doublon(s) détecté(s) et ignoré(s).`);
  }

  const { created, errors, failed } = await insertRows(base44, entityName, newRows);
  for (const f of failed) {
    const source = (f.row as any)[LIGNE_SOURCE] || f.row;
    metrics.quarantined_rows++;
    noter(ROW_STATUS.QUARANTINED, f.reason === "RATE_LIMITED" ? REASON.RATE_LIMITED : REASON.STORAGE_REJECTED,
      { ...(sources.get(source) || { brut: source, ligne: null }), mapped: source }, { detail: f.error.slice(0, 500) });
  }
  metrics.valid_rows = created;
  // Lignes du registre effectivement ecrites : recuperees.
  const refusees = new Set(failed.map((f) => (f.row as any)[LIGNE_SOURCE] || f.row));
  for (const r of newRows) {
    const source = (r as any)[LIGNE_SOURCE] || r;
    const id = sources.get(source)?.issueId;
    if (id && !refusees.has(source)) reprises.push({ issueId: id, issue: null, recuperee: true });
  }

  // Sauvegarde des Observations (Silencieuse pour ne pas bloquer l'import)
  const rawObservations: any[] = [];
  for (const r of newRows) {
    const source = (r as any)[LIGNE_SOURCE] || r;
    if (refusees.has(source)) continue;
    for (const o of observationsDe.get(source) || []) rawObservations.push({ ...o, import_id: importId, row_ref: r.fingerprint });
  }
  if (rawObservations.length > 0) {
    try {
      // On sauvegarde par lots de 100
      for (let i = 0; i < rawObservations.length; i += 100) {
        await base44.entities.Observation.bulkCreate(rawObservations.slice(i, i + 100));
      }
    } catch(e) { console.warn("Failed to save observations", e); }
  }

  // Refused values first: this is the actionable one, and it used to be
  // reported as a missing field, which sent users looking for a column that
  // was right there in their file.
  for (const [field, counts] of Object.entries(refusedValues)) {
    const listed = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([val, n]) => `« ${val} » (${n})`)
      .join(", ");
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    messages.push(
      `${field} : ${total} ligne(s) mise(s) en quarantaine pour cause de valeur non reconnue — ${listed}. `
      + `Valeurs acceptées : ${(allowedByField[field] || []).join(", ")}. `
      + `Ces lignes sont conservées dans le registre de l'import et pourront être retraitées sans réimporter le fichier.`,
    );
  }
  if (missingFields.size > 0) {
    messages.push(`champs obligatoires absents du fichier : ${Array.from(missingFields).join(", ")}`);
    if (samples.length > 0) messages.push(`exemple de ligne rejetée : ${samples[0]}`);
  }
  if (errors.length > 0) messages.push(errors[0]);

  const registre = await ecrireRegistre(base44, issues);
  if (registre.erreur) messages.push(registre.erreur);

  metrics.unknown_fields = Array.from(unmappedColumns);
  const evaluations = memoire?.plan?.evaluations || [];
  const ambigues = evaluations.filter((e) => e.statut === "AMBIGUOUS").map((e) => e.colonne);
  const dimensions = evaluations.filter((e) => e.dimension_potentielle).map((e) => e.colonne);
  metrics.fallback_values = trace.replis.length;
  metrics.derived_values = trace.derives.length;
  metrics.total_rows = metrics.valid_rows + metrics.quarantined_rows + metrics.duplicate_rows
    + metrics.summary_rows + metrics.ignored_rows + metrics.unknown_rows;

  // Qualite : part des lignes de donnees reellement utilisables. Les totaux et
  // lignes ignorees ne sont pas des donnees, ils ne comptent ni pour ni contre.
  const lignesDeDonnees = metrics.total_rows - metrics.summary_rows - metrics.ignored_rows;
  const quality = lignesDeDonnees > 0 ? Math.round((created / lignesDeDonnees) * 100) : 0;
  // Rien d'importe mais des lignes conservees et retraitables : c'est une
  // quarantaine, pas un echec — rien n'est perdu.
  const aRetraiter = issues.some((i) => i.recovery_status === RECOVERY.PENDING)
    || reprises.some((r) => r.issue?.recovery_status === RECOVERY.PENDING);
  const status = created > 0 ? "complete" : aRetraiter ? "quarantaine" : "echoue";
  // Compatibilite : "quarantined" compte toujours les lignes non ecrites, doublons compris.
  const quarantined = metrics.quarantined_rows + metrics.duplicate_rows + metrics.unknown_rows;

  const ecartes = resumeMotifs(metrics.reasons);
  const statuts = resumeStatuts(evaluations);
  const relationsTenues = (memoire?.plan?.relations || []).filter((r) => r.n >= 2 && r.taux >= 0.9);
  const relations = relationsTenues.length
    ? `Relations vérifiées : ${relationsTenues.map((r) => `${r.libelle} (${r.coherentes}/${r.n} lignes)`).join(" ; ")}.` : "";
  const typeDispute = memoire?.plan?.entite_rivale
    ? `Type retenu : ${entityName}, à confirmer — ${memoire.plan.entite_rivale} est presque aussi plausible.` : "";
  return {
    created,
    status,
    quality,
    quarantined,
    metrics: { ...metrics, ambiguous_fields: ambigues, potential_dimensions: dimensions },
    reprises,
    message: [typeDispute, ecartes ? `Lignes écartées : ${ecartes}.` : "", statuts, relations, ...(memoire?.plan?.corrections || []).slice(0, 3), ...messages]
      .filter(Boolean).join(" · ") || undefined,
    // Signals to the caller that the quota is exhausted, so the next sheet
    // should not be fired straight into the same wall.
    rateLimited: errors.some((e) => e.includes("limite de débit")),
  };
}

/** Les champs de l'Import qui decrivent le resultat d'un traitement (§20). */
export function champsImport(t: Awaited<ReturnType<typeof traiterLignes>>) {
  const m = t.metrics;
  return {
    status: t.status,
    quality_score: t.quality,
    rows_processed: t.created,
    rows_quarantined: t.quarantined,
    total_rows: m.total_rows,
    duplicate_rows: m.duplicate_rows,
    summary_rows: m.summary_rows,
    ignored_rows: m.ignored_rows,
    unknown_rows: m.unknown_rows,
    recovered_rows: 0,
    unknown_fields: m.unknown_fields,
    fallback_values: m.fallback_values,
    derived_values: m.derived_values,
    anomalous_values: m.anomalous_values,
    potential_duplicates: m.potential_duplicates,
    reasons: m.reasons,
    ambiguous_fields: m.ambiguous_fields,
    potential_dimensions: m.potential_dimensions,
  };
}

/**
 * Feuille lisible dont le type n'a pas ete reconnu.
 *
 * Elle etait simplement « ignoree » : rien n'etait stocke, et l'utilisateur ne
 * pouvait que reimporter apres avoir renomme ses colonnes. Chaque ligne est
 * maintenant conservee brute dans le registre (UNKNOWN_CONCEPT, retraitable)
 * sous un import en quarantaine : choisir le type plus tard suffit (§1, §2, §18).
 */
const LIGNES_BRUTES_MAX = 5000;

export async function conserverFeuilleInconnue(
  base44: any, label: string, matrix: any[][], ligneEntetes: number, sourceType: string, fileUrl: string,
) {
  const entetes = (matrix[ligneEntetes] || []).map((h: any, i: number) => String(h ?? "").trim() || `col_${i + 1}`);
  const importRec = await base44.entities.Import.create({
    source_type: sourceType, file_name: label, file_url: fileUrl, status: "quarantaine",
    rows_processed: 0, rows_quarantined: 0,
  });
  const issues: ImportIssueRecord[] = [];
  for (let i = ligneEntetes + 1; i < matrix.length && issues.length < LIGNES_BRUTES_MAX; i++) {
    const brute = matrix[i] || [];
    if (brute.every((c: any) => String(c ?? "").trim() === "")) continue;
    const brut: Record<string, any> = {};
    entetes.forEach((h: string, idx: number) => { brut[h] = brute[idx] ?? ""; });
    issues.push({
      import_id: importRec.id, file_name: label, entity_type: null, row_number: i + 1,
      row_status: ROW_STATUS.UNKNOWN, reason_code: REASON.UNKNOWN_CONCEPT,
      detail: "type de feuille non reconnu", raw_row: json(brut), recovery_status: RECOVERY.PENDING,
    });
  }
  const registre = await ecrireRegistre(base44, issues);
  const metrics = {
    ...metriquesVides(), total_rows: issues.length, unknown_rows: issues.length,
    unknown_fields: entetes, reasons: { UNKNOWN_CONCEPT: issues.length },
  };
  await base44.entities.Import.update(importRec.id, {
    rows_quarantined: issues.length, total_rows: issues.length, unknown_rows: issues.length,
    unknown_fields: entetes, reasons: metrics.reasons, quality_score: 0,
  });
  return { import_id: importRec.id, conservees: registre.ecrites, metrics, erreur: registre.erreur };
}

