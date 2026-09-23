import { createFixedClientFromRequest as createClientFromRequest } from "../../shared/client.ts";
import { buildCompanyDictionaryIndex, NUMERO_LIGNE } from "../../shared/importUtils.ts";
import { appliquerPlan, planParRegles, evaluerPlan, type PlanImport, type LigneEcartee } from "../../shared/importPlan.ts";
import { traiterLignes, ID_ISSUE } from "../../shared/importRows.ts";
import { RECOVERY, ROW_STATUS, REASON } from "../../shared/importStatus.ts";
import { ENTITY_SCHEMAS } from "../../shared/entitySchemas.ts";

/**
 * Retraitement sans reimport (directives §17, §18).
 *
 * Les lignes qu'un import n'a pas pu integrer sont conservees dans le registre
 * ImportIssue avec leur contenu brut. Quand la reconnaissance progresse — le
 * dictionnaire de l'entreprise apprend un terme, l'utilisateur choisit enfin le
 * type d'une feuille inconnue, une regle est amelioree — ces lignes sont
 * relues ici, par le MEME traitement que l'import (traiterLignes). Rien n'est
 * redemande a l'utilisateur, aucun fichier n'est reimporte.
 *
 * Corps : { import_id?, entity_type?, tous?, mode? }
 *   import_id    l'import a retraiter ;
 *   entity_type  le type a appliquer (obligatoire pour une feuille non reconnue) ;
 *   tous         retraiter tous les imports qui ont des lignes en attente ;
 *   mode         "simuler" : rend ce qui serait recupere, n'ecrit rien.
 */

const LIGNES_MAX_PAR_APPEL = 2000;

/**
 * Client dont les ecritures ne font rien : le mode "simuler" execute exactement
 * le traitement reel (memes regles, meme deduplication contre la base), sans
 * rien enregistrer.
 */
function clientSimulation(base44: any) {
  const entites = new Proxy({}, {
    get: (_t, nom: string) => {
      const reelle = base44.entities[nom];
      return {
        list: (...a: any[]) => reelle.list(...a),
        filter: (...a: any[]) => reelle.filter(...a),
        create: async (r: any) => r,
        bulkCreate: async (rs: any[]) => rs,
        update: async () => ({}),
      };
    },
  });
  return { ...base44, entities: entites };
}

/**
 * Le plan pour relire les lignes : celui de l'import d'origine s'il vise le meme
 * type (il porte les choix valides par l'utilisateur), complete par les regles
 * ACTUELLES pour chaque colonne qu'il laissait sans champ — c'est la que la
 * reconnaissance a pu progresser depuis. Sinon, les regles actuelles seules.
 */
function planDeReprise(
  stocke: PlanImport | null, matrix: any[][], nom: string, entite: string, companyDictionary: Record<string, string>,
): PlanImport {
  const regles = planParRegles(matrix, nom, entite, [], companyDictionary);
  if (!stocke || stocke.entite !== entite || !Array.isArray(stocke.colonnes)) return regles;
  const colonnes = stocke.colonnes.map((c) => {
    if (c.source === "humain") return c;
    const r = regles.colonnes.find((x) => x.colonne === c.colonne);
    // Un terme du dictionnaire appris depuis l'import prime sur l'ancienne lecture.
    if (r?.source === "dictionnaire") return { ...c, champ: r.champ, source: r.source, exclue: false };
    if (c.champ) return c;
    return r?.champ ? { ...c, champ: r.champ, source: r.source, exclue: false } : c;
  });
  const plan: PlanImport = { ...stocke, colonnes, ligne_entetes: 0, lignes_ignorees: [], corrections: [] };
  return evaluerPlan(plan, matrix, "alias");
}

async function toutes(base44: any, entite: string, requete: any): Promise<any[]> {
  const res = await base44.entities[entite].filter(requete);
  return Array.isArray(res) ? res : [];
}

async function retraiterImport(base44: any, ecriture: any, imp: any, typeDemande: string | null, companyDictionary: Record<string, string>) {
  const entite = typeDemande || imp.entity_type;
  if (!entite || !ENTITY_SCHEMAS[entite]) {
    return { import_id: imp.id, file_name: imp.file_name, statut: "type_requis", message: "Choisissez le type de ces données pour les intégrer." };
  }
  // Conflits enregistres avant qu'ils ne deviennent recuperables (statut
  // NOT_APPLICABLE) et jamais tranches : relus eux aussi, sinon une ligne
  // ecartee par une ancienne regle d'identification le restait pour toujours.
  const enAttenteBrut = [
    ...(await toutes(base44, "ImportIssue", { import_id: imp.id, recovery_status: RECOVERY.PENDING })),
    ...(await toutes(base44, "ImportIssue", { import_id: imp.id, reason_code: REASON.CONFLICTING_RECORD, recovery_status: RECOVERY.NOT_APPLICABLE }))
      .filter((i: any) => !i.review_status || i.review_status === "A_VERIFIER"),
  ];
  const vus = new Set<string>();
  const enAttente = enAttenteBrut.filter((i: any) => (vus.has(i.id) ? false : (vus.add(i.id), true))).slice(0, LIGNES_MAX_PAR_APPEL);
  if (enAttente.length === 0) {
    return { import_id: imp.id, file_name: imp.file_name, entity: entite, statut: "rien_a_retraiter", candidates: 0, recovered: 0 };
  }

  // Matrice reconstruite depuis les lignes brutes du registre.
  const lignesBrutes = enAttente.map((i) => { try { return JSON.parse(i.raw_row || "{}"); } catch { return {}; } });
  const entetes: string[] = [];
  for (const l of lignesBrutes) for (const k of Object.keys(l)) if (!entetes.includes(k)) entetes.push(k);
  const matrix = [entetes, ...lignesBrutes.map((l) => entetes.map((h) => l[h] ?? ""))];

  const plan = planDeReprise(imp.read_plan || null, matrix, imp.file_name || "", entite, companyDictionary);
  const journal: LigneEcartee[] = [];
  const rows = appliquerPlan(plan, matrix, journal);
  for (const r of rows) {
    const issue = enAttente[(r as any)[NUMERO_LIGNE] - 2];
    Object.defineProperty(r, ID_ISSUE, { value: issue.id, enumerable: false });
    Object.defineProperty(r, NUMERO_LIGNE, { value: issue.row_number ?? null, enumerable: false, configurable: true });
  }

  const t = await traiterLignes(ecriture, {
    importId: imp.id, entityName: entite, rows, sourceType: imp.source_type || "csv",
    fileLabel: imp.file_name || "", plan, companyDictionary,
  });

  // Mise a jour du registre : chaque entree retraitee dit ce qu'elle est devenue.
  const maintenant = new Date().toISOString();
  const precedente = new Map(enAttente.map((i) => [i.id, i]));
  let recuperees = 0;
  const recupereesParAncienStatut: Record<string, number> = {};
  const recupereesParAncienMotif: Record<string, number> = {};
  for (const r of t.reprises) {
    const avant = precedente.get(r.issueId);
    if (r.recuperee) {
      recuperees++;
      if (avant) {
        recupereesParAncienStatut[avant.row_status] = (recupereesParAncienStatut[avant.row_status] || 0) + 1;
        recupereesParAncienMotif[avant.reason_code] = (recupereesParAncienMotif[avant.reason_code] || 0) + 1;
      }
      await ecriture.entities.ImportIssue.update(r.issueId, {
        recovery_status: RECOVERY.RECOVERED, recovered_at: maintenant, entity_type: entite,
      });
    } else if (r.issue) {
      const { import_id: _i, file_name: _f, row_number: _n, raw_row: _r, ...motif } = r.issue;
      await ecriture.entities.ImportIssue.update(r.issueId, { ...motif, entity_type: entite });
    }
  }
  // Lignes que la relecture classe totaux ou lignes ignorees : rien a recuperer.
  for (const e of journal) {
    const issue = enAttente[e.ligne - 2];
    if (!issue) continue;
    await ecriture.entities.ImportIssue.update(issue.id, {
      row_status: e.motif === "ligne_de_total" ? ROW_STATUS.SUMMARY_ROW : ROW_STATUS.IGNORED_ROW,
      reason_code: e.motif === "ligne_de_total" ? REASON.SUMMARY_ROW : REASON.IGNORED_BY_PLAN,
      recovery_status: RECOVERY.NOT_APPLICABLE,
    });
  }

  // L'import reflete maintenant la recuperation (§20 : RECOVERED_ROWS).
  const raisons = { ...(imp.reasons || {}) };
  for (const [code, n] of Object.entries(recupereesParAncienMotif)) raisons[code] = Math.max(0, (raisons[code] || 0) - n);
  const traitees = Number(imp.rows_processed || 0) + recuperees;
  await ecriture.entities.Import.update(imp.id, {
    entity_type: entite,
    read_plan: imp.entity_type ? imp.read_plan : plan,
    rows_processed: traitees,
    rows_quarantined: Math.max(0, Number(imp.rows_quarantined || 0) - recuperees),
    recovered_rows: Number(imp.recovered_rows || 0) + recuperees,
    unknown_rows: Math.max(0, Number(imp.unknown_rows || 0) - (recupereesParAncienStatut[ROW_STATUS.UNKNOWN] || 0)),
    reasons: raisons,
    status: traitees > 0 ? "complete" : imp.status,
    quality_score: imp.total_rows ? Math.round((traitees / Math.max(1, Number(imp.total_rows) - Number(imp.summary_rows || 0) - Number(imp.ignored_rows || 0))) * 100) : imp.quality_score,
  });

  return {
    import_id: imp.id, file_name: imp.file_name, entity: entite, statut: "retraite",
    candidates: enAttente.length, recovered: recuperees,
    still_pending: enAttente.length - recuperees - journal.length - t.metrics.duplicate_rows,
    duplicates: t.metrics.duplicate_rows,
    message: t.message,
  };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non autorisé" }, { status: 401 });

    const { import_id, entity_type, tous, mode } = await req.json();
    const simuler = mode === "simuler";
    const ecriture = simuler ? clientSimulation(base44) : base44;

    let companyDictionary: Record<string, string> = {};
    try {
      const companies = await base44.entities.Company.list();
      companyDictionary = buildCompanyDictionaryIndex(companies?.[0]?.company_dictionary);
    } catch { /* retraiter sans dictionnaire reste utile */ }

    let imports: any[] = [];
    if (import_id) {
      imports = await toutes(base44, "Import", { id: import_id });
      if (imports.length === 0) return Response.json({ error: "Import introuvable" }, { status: 404 });
    } else if (tous) {
      imports = (await base44.entities.Import.list("-created_date", 200) || [])
        .filter((i: any) => Number(i.rows_quarantined || 0) > 0 || i.status === "quarantaine");
    } else {
      return Response.json({ error: "import_id ou tous requis" }, { status: 400 });
    }

    const results: any[] = [];
    for (const imp of imports) {
      // Un type impose n'a de sens que pour un import designe explicitement.
      results.push(await retraiterImport(base44, ecriture, imp, import_id ? (entity_type || null) : null, companyDictionary));
    }
    const recuperees = results.reduce((s, r) => s + (r.recovered || 0), 0);
    return Response.json({ mode: simuler ? "simuler" : "appliquer", recovered: recuperees, results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
