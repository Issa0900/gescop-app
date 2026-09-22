import { createFixedClientFromRequest as createClientFromRequest } from "../../shared/client.ts";
import { generateFingerprint } from "../../shared/fingerprint.ts";
import { ROW_STATUS } from "../../shared/importStatus.ts";

/**
 * Decision humaine sur un doublon potentiel (regle du 22 sept 2026).
 *
 * Une ligne strictement identique a une autre du meme fichier, sans identifiant
 * pour le prouver, est importee et signalee (ImportIssue DUPLICATE_EXACT,
 * review_status A_VERIFIER). Apres verification, l'utilisateur tranche :
 *
 *   exclure   c'est bien un doublon : UNE copie est retiree des donnees et de
 *             leurs observations (donc des KPI). La ligne brute reste dans le
 *             registre, la decision est tracee — rien n'est perdu.
 *   conserver ce sont des faits reels (deux ventes identiques) : la ligne reste,
 *             le signalement est clos.
 *
 * Corps : { issue_id, decision: "exclure" | "conserver" }
 */

async function premier(base44: any, entite: string, requete: any) {
  const r = await base44.entities[entite].filter(requete);
  return Array.isArray(r) && r.length > 0 ? r[0] : null;
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non autorisé" }, { status: 401 });

    const { issue_id, decision } = await req.json();
    if (!issue_id || !["exclure", "conserver"].includes(decision)) {
      return Response.json({ error: "issue_id et decision (exclure | conserver) requis" }, { status: 400 });
    }

    const issue = await premier(base44, "ImportIssue", { id: issue_id });
    if (!issue) return Response.json({ error: "Signalement introuvable" }, { status: 404 });
    if (issue.row_status !== ROW_STATUS.DUPLICATE_EXACT || (issue.review_status && issue.review_status !== "A_VERIFIER")) {
      return Response.json({ error: "Ce doublon potentiel a déjà été traité." }, { status: 409 });
    }
    const imp = await premier(base44, "Import", { id: issue.import_id });
    const entite = issue.entity_type || imp?.entity_type;
    if (!entite || !base44.entities[entite]) return Response.json({ error: "Type de données inconnu pour ce signalement" }, { status: 422 });
    const maintenant = new Date().toISOString();

    if (decision === "conserver") {
      await base44.entities.ImportIssue.update(issue.id, {
        review_status: "CONSERVE", reviewed_at: maintenant,
        detail: `${issue.detail || ""} — confirmée comme ligne réelle après vérification`.slice(0, 1000),
      });
      if (imp) await base44.entities.Import.update(imp.id, { potential_duplicates: Math.max(0, Number(imp.potential_duplicates || 0) - 1) });
      return Response.json({ decision, conservee: true });
    }

    // Exclure : retrouver les copies de cette ligne dans l'import. Elles sont
    // identiques, donc en retirer une seule suffit — et il doit en rester une.
    let ligne: Record<string, any> = {};
    try { ligne = JSON.parse(issue.mapped_row || "{}"); } catch { /* traite ci-dessous */ }
    const empreinte = generateFingerprint(entite, ligne);
    const copies = empreinte ? await base44.entities[entite].filter({ import_id: issue.import_id, fingerprint: empreinte }) : [];
    if (!Array.isArray(copies) || copies.length < 2) {
      return Response.json({
        error: "Impossible d'exclure : la ligne d'origine n'a plus de copie identique dans les données (déjà retirée, ou modifiée depuis).",
      }, { status: 409 });
    }
    const retiree = copies[copies.length - 1];
    await base44.entities[entite].delete(retiree.id);

    // Ses observations (une par concept) sortent avec elle des KPI.
    let observationsRetirees = 0;
    try {
      const obs = await base44.entities.Observation.filter({ import_id: issue.import_id, row_ref: empreinte });
      const parConcept = new Map<string, any>();
      for (const o of Array.isArray(obs) ? obs : []) parConcept.set(o.concept, o);
      for (const o of parConcept.values()) { await base44.entities.Observation.delete(o.id); observationsRetirees++; }
    } catch { /* imports anterieurs a row_ref : pas d'observation reliee */ }

    await base44.entities.ImportIssue.update(issue.id, {
      row_status: ROW_STATUS.DUPLICATE, review_status: "EXCLU", reviewed_at: maintenant,
      recovered_record_id: retiree.id,
      detail: `${issue.detail || ""} — exclue après vérification : copie retirée des données, ligne brute conservée ici`.slice(0, 1000),
    });
    if (imp) {
      await base44.entities.Import.update(imp.id, {
        rows_processed: Math.max(0, Number(imp.rows_processed || 0) - 1),
        duplicate_rows: Number(imp.duplicate_rows || 0) + 1,
        rows_quarantined: Number(imp.rows_quarantined || 0) + 1,
        potential_duplicates: Math.max(0, Number(imp.potential_duplicates || 0) - 1),
      });
    }
    return Response.json({ decision, exclue: true, record_id: retiree.id, observations_retirees: observationsRetirees });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
