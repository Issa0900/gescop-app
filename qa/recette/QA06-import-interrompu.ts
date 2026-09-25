// QA06 : un import dont la fiche est supprimée pendant l'écriture (« Tout
// supprimer » lancé pendant un import) s'arrête au lot suivant, sans créer de
// lignes orphelines. Une erreur passagère de lecture ne l'interrompt pas.
import { traiterLignes, importToujoursPresent } from "../../base44/shared/importRows.ts";

let ko = 0;
const verif = (ok: boolean, msg: string) => { if (!ok) ko++; console.log(`${ok ? "ok  " : "KO  "} ${msg}`); };

function base(presence: () => any) {
  const tables: Record<string, any[]> = {};
  let n = 0;
  const table = (e: string) => (tables[e] ||= []);
  const entite = (e: string) => ({
    list: async () => [], filter: async () => [],
    get: async (id: string) => (e === "Import" ? presence() : table(e).find((r) => r.id === id)),
    create: async (r: any) => { const x = { id: `${e}-${++n}`, ...r }; table(e).push(x); return x; },
    bulkCreate: async (rs: any[]) => rs.map((r) => { const x = { id: `${e}-${++n}`, ...r }; table(e).push(x); return x; }),
    update: async (_id: string, p: any) => p,
  });
  const entities = new Proxy({}, { get: (_t, e: string) => entite(e) });
  return { base44: { entities, asServiceRole: { entities } }, tables };
}
const lignes = Array.from({ length: 2500 }, (_, i) => ({ date: "2026-03-01", montant: 100 + i, type: "revenu", description: `vente ${i}` }));

// 1. Fiche supprimée avant l'écriture : rien n'est écrit.
{
  const { base44, tables } = base(() => null);
  const t: any = await traiterLignes(base44, { importId: "imp-1", entityName: "Transaction", rows: lignes.map((r) => ({ ...r })), sourceType: "csv", fileLabel: "t.csv" });
  verif(t.status === "annule", `statut « annule » (obtenu ${t.status})`);
  verif((tables.Transaction || []).length === 0, "aucune transaction écrite");
  verif((tables.Observation || []).length === 0, "aucune observation écrite");
  verif((tables.ImportIssue || []).length === 0, "aucun registre écrit pour un import supprimé");
}

// 2. Fiche supprimée après le premier lot de 1 000 : l'import s'arrête là.
{
  let appels = 0;
  const { base44, tables } = base(() => (++appels <= 1 ? { id: "imp-2" } : null));
  const t: any = await traiterLignes(base44, { importId: "imp-2", entityName: "Transaction", rows: lignes.map((r) => ({ ...r })), sourceType: "csv", fileLabel: "t.csv" });
  const ecrites = (tables.Transaction || []).length;
  verif(t.status === "annule" && ecrites < 2500, `arrêt en cours de route (${ecrites} écrites sur 2 500)`);
  verif((tables.Observation || []).length === 0, "pas d'observations après l'arrêt");
}

// 3. Fiche présente : import normal.
{
  const { base44, tables } = base(() => ({ id: "imp-3" }));
  const t: any = await traiterLignes(base44, { importId: "imp-3", entityName: "Transaction", rows: lignes.map((r) => ({ ...r })), sourceType: "csv", fileLabel: "t.csv" });
  verif(t.status === "complete" && (tables.Transaction || []).length === 2500, `import complet (${(tables.Transaction || []).length} écrites)`);
}

// 4. Lecture de la fiche en panne passagère : on continue ; introuvable : on s'arrête.
const panne = { entities: { Import: { get: async () => { throw Object.assign(new Error("Network Error"), { status: 503 }); } } } };
verif(await importToujoursPresent(panne, "x") === true, "erreur passagère : l'import continue");
const absent = { entities: { Import: { get: async () => { throw Object.assign(new Error("Entity not found"), { status: 404 }); } } } };
verif(await importToujoursPresent(absent, "x") === false, "fiche introuvable (404) : l'import s'arrête");
verif(await importToujoursPresent({ entities: { Import: {} } }, "x") === true, "client sans get : on ne peut pas savoir, l'import continue");

console.log(ko ? `cas en echec : ${ko}` : "tous les cas passent");
if (ko) Deno.exit(1);
