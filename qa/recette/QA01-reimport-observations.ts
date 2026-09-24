// QA01 : réimporter exactement le même fichier ne doit PAS doubler les KPI.
// Passe par la vraie fonction d'import partagée (traiterLignes) avec une base
// Base44 simulée en mémoire, puis calcule le CA avec le vrai moteur KPI du front.
import { traiterLignes } from "../../base44/shared/importRows.ts";
import { computeKpi } from "../../src/lib/core/kpiEngine.js";

function baseEnMemoire() {
  const tables: Record<string, any[]> = {};
  let n = 0;
  const table = (e: string) => (tables[e] ||= []);
  const entite = (e: string) => ({
    list: async (_s?: string, limit = 1e9, skip = 0) => table(e).slice(skip, skip + limit),
    filter: async (q: any = {}) => table(e).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)),
    get: async (id: string) => table(e).find((r) => r.id === id),
    create: async (r: any) => { const x = { id: `${e}-${++n}`, ...r }; table(e).push(x); return x; },
    bulkCreate: async (rs: any[]) => rs.map((r) => { const x = { id: `${e}-${++n}`, ...r }; table(e).push(x); return x; }),
    update: async (id: string, p: any) => Object.assign(table(e).find((r) => r.id === id) || {}, p),
    deleteMany: async () => ({ deleted: 0 }),
  });
  const entities = new Proxy({}, { get: (_t, e: string) => entite(e) });
  return { base44: { entities, asServiceRole: { entities } }, tables };
}

const fichier = [
  { "Date": "2026-03-01", "Revenue": 1000, "Transaction ID": "A1", "Type": "Revenu" },
  { "Date": "2026-03-02", "Revenue": 2000, "Transaction ID": "A2", "Type": "Revenu" },
  { "Date": "2026-03-03", "Revenue": 3000, "Transaction ID": "A3", "Type": "Revenu" },
];

const { base44, tables } = baseEnMemoire();
const importer = (id: string) => traiterLignes(base44, { importId: id, entityName: "Transaction", rows: fichier.map((r) => ({ ...r })), sourceType: "csv", fileLabel: "ventes.csv" });

let ko = 0;
const verif = (ok: boolean, msg: string) => { if (!ok) ko++; console.log(`${ok ? "ok  " : "KO  "} ${msg}`); };

await importer("imp-1");
const obs1 = (tables.Observation || []).length, tx1 = (tables.Transaction || []).length;
const ca1 = computeKpi({ kpiId: "total_revenue", records: [...(tables.Observation || []), ...(tables.Transaction || []).map((r) => ({ ...r, _entity: "Transaction" }))], fieldSemantics: new Map() })?.value;
await importer("imp-2");
const obs2 = (tables.Observation || []).length, tx2 = (tables.Transaction || []).length;
const ca2 = computeKpi({ kpiId: "total_revenue", records: [...(tables.Observation || []), ...(tables.Transaction || []).map((r) => ({ ...r, _entity: "Transaction" }))], fieldSemantics: new Map() })?.value;

console.log(`Transactions ${tx1} -> ${tx2} | Observations ${obs1} -> ${obs2} | CA ${ca1} -> ${ca2}`);
verif(tx2 === tx1, "le réimport ne crée aucune transaction en double");
verif(obs2 === obs1, "le réimport ne crée aucune Observation en double");
verif(ca1 === ca2, "le chiffre d'affaires est identique après réimport");
verif((tables.Observation || []).every((o) => o.import_id), "chaque Observation porte son import_id");
console.log(ko ? `cas en echec : ${ko}` : "tous les cas passent");
if (ko) Deno.exit(1);
