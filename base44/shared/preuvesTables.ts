// Preuves entre tables (directive §4 niveau 5, §5 : « VENTES.client_ref peut
// correspondre a CLIENTS.code_client meme si les noms sont differents »).
//
// Les valeurs d'une colonne sont comparees aux cles deja connues : celles de la
// base, et celles des feuilles deja lues dans le meme envoi (une feuille Clients
// placee avant la feuille Ventes du meme classeur compte). Deux usages :
//   - une colonne deja rattachee a une cle etrangere (customer_id...) gagne une
//     preuve si ses codes existent bien dans la table visee ;
//   - une colonne NON rattachee dont presque tous les codes existent dans une
//     table est rattachee a la cle correspondante — avec cette preuve affichee.

import { getSchema } from "./entitySchemas.ts";
import type { PlanImport } from "./importPlan.ts";
import { ajouterPreuve, statutDepuisConfiance, type EvaluationColonne } from "./core/recognition/preuves.ts";
import { CLES_ETRANGERES, recouvrement, ajouterClesConnues, type ClesConnues } from "./core/recognition/relations.ts";

const LIGNES_COMPAREES = 500;

export interface ContexteRelations { cles: ClesConnues; chargees: Set<string> }

export function nouveauContexteRelations(): ContexteRelations {
  return { cles: new Map(), chargees: new Set() };
}

async function charger(base44: any, ctx: ContexteRelations, entite: string, champ: string) {
  const k = `${entite}.${champ}`;
  if (ctx.chargees.has(k)) return;
  ctx.chargees.add(k);
  try {
    const rs = await base44.entities[entite].list("-created_date", 2000);
    ajouterClesConnues(ctx.cles, entite, champ, (rs || []).map((r: any) => r?.[champ]));
  } catch { /* une table illisible n'apporte simplement pas de preuve */ }
}

export async function appliquerPreuvesEntreTables(
  base44: any, plan: PlanImport, matrix: any[][], ctx: ContexteRelations,
): Promise<PlanImport> {
  if (!plan.entite) return plan;
  const props = getSchema(plan.entite)?.properties || {};
  const entetes = (matrix[plan.ligne_entetes] || []).map((h: any) => String(h ?? "").trim());
  const ignorees = new Set(plan.lignes_ignorees || []);
  const lignes = matrix.slice(plan.ligne_entetes + 1).filter((_, i) => !ignorees.has(plan.ligne_entetes + 1 + i)).slice(0, LIGNES_COMPAREES);
  const valeursDe = (colonne: string) => { const i = entetes.indexOf(colonne); return i < 0 ? [] : lignes.map((r) => (r || [])[i]); };

  const colonnes = plan.colonnes.map((c) => ({ ...c }));
  const evaluations: EvaluationColonne[] = (plan.evaluations || []).map((e) => ({ ...e, preuves: [...e.preuves] }));
  const evalDe = (colonne: string) => evaluations.find((e) => e.colonne === colonne);
  const corrections: string[] = [];

  // a) Cles etrangeres deja rattachees : leurs codes existent-ils ?
  for (const c of colonnes) {
    if (!c.champ || !CLES_ETRANGERES[c.champ]) continue;
    for (const ref of CLES_ETRANGERES[c.champ]) {
      if (ref.entite === plan.entite) continue; // la cle propre de la feuille n'a pas a exister ailleurs
      await charger(base44, ctx, ref.entite, ref.champ);
      const r = recouvrement(valeursDe(c.colonne), ctx.cles.get(`${ref.entite}.${ref.champ}`));
      const e = evalDe(c.colonne);
      if (e && r.trouvees > 0 && r.taux >= 0.8) {
        ajouterPreuve(e, { type: "RELATION", detail: `${r.trouvees}/${r.distinctes} codes existent dans les ${ref.libelle}`, points: 10 }, c.source === "humain");
        break;
      }
    }
  }

  // b) Colonnes non rattachees dont les codes sont ceux d'une autre table.
  const libres = Object.keys(CLES_ETRANGERES).filter((fk) => props[fk] && !colonnes.some((c) => c.champ === fk));
  for (const fk of libres) {
    let meilleure: { c: any; r: ReturnType<typeof recouvrement>; libelle: string } | null = null;
    for (const ref of CLES_ETRANGERES[fk]) {
      if (ref.entite === plan.entite) continue;
      await charger(base44, ctx, ref.entite, ref.champ);
      const connues = ctx.cles.get(`${ref.entite}.${ref.champ}`);
      for (const c of colonnes) {
        if (c.champ || c.exclue) continue;
        const r = recouvrement(valeursDe(c.colonne), connues);
        if (r.distinctes >= 2 && r.taux >= 0.8 && (!meilleure || r.taux > meilleure.r.taux || (r.taux === meilleure.r.taux && r.distinctes > meilleure.r.distinctes))) {
          meilleure = { c, r, libelle: ref.libelle };
        }
      }
    }
    if (!meilleure) continue;
    const { c, r, libelle } = meilleure;
    c.champ = fk;
    c.source = "relation";
    c.exclue = false;
    const e: EvaluationColonne = {
      colonne: c.colonne, champ: fk, statut: "PROBABLE", confiance: 0,
      preuves: [
        { type: "NOM", detail: "intitulé non reconnu", points: 0 },
        { type: "RELATION", detail: `${r.trouvees}/${r.distinctes} codes existent dans les ${libelle}`, points: 60 },
        { type: "CONTEXTE", detail: `champ déclaré par ${plan.entite}`, points: 10 },
      ],
    };
    e.confiance = Math.min(100, e.preuves.reduce((s, p) => s + p.points, 0));
    e.statut = statutDepuisConfiance(e);
    const i = evaluations.findIndex((x) => x.colonne === c.colonne);
    if (i >= 0) evaluations[i] = e; else evaluations.push(e);
    corrections.push(`« ${c.colonne} » rattachée à ${fk} : ${r.trouvees}/${r.distinctes} de ses codes existent dans les ${libelle}.`);
  }

  // c) Les cles de cette feuille servent aux feuilles suivantes du meme envoi.
  for (const c of colonnes) {
    if (!c.champ) continue;
    const estCleDeLaFeuille = Object.values(CLES_ETRANGERES).some((refs) => refs.some((r) => r.entite === plan.entite && r.champ === c.champ));
    if (estCleDeLaFeuille) ajouterClesConnues(ctx.cles, plan.entite, c.champ, valeursDe(c.colonne));
  }

  return { ...plan, colonnes, evaluations, corrections: [...(plan.corrections || []), ...corrections] };
}
