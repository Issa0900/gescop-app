// Outils partages des bancs d'import sous IA simulee (diagnostic.ts, vert_quebec.ts) :
// comportements d'IA simules, faux client Base44 en memoire (tables + IA),
// appel du vrai point d'entree importMultiData, KPI comme la page Indicateurs.

import handler from "../../base44/functions/importMultiData/entry.ts";
import { getSchema } from "../../base44/shared/entitySchemas.ts";
import { detectEntityByName } from "../../base44/shared/importUtils.ts";
import { computeKpiBatch } from "../../src/lib/core/kpiEngine.js";
import { buildKpiDataset, ENTITES_KPI } from "../../src/lib/core/kpiDataset.js";
import { KPI_REGISTRY } from "../../src/lib/core/kpiRegistry.js";

// ---------------------------------------------------------------------------
// Comportements d'IA simules. Chacun recoit le plan que trouvent les regles
// (le meme que « sans IA ») et la feuille ; il rend une reponse au format de
// l'IA (SCHEMA_REPONSE), ou leve une erreur (IA indisponible).
// ---------------------------------------------------------------------------
type Reponse = (plan: any, feuille: string) => any;
const versReponse = (plan: any, entite: string | null, champ: (c: any) => string | null, decalage = 0) => ({
  entite,
  ligne_entetes: (plan.ligne_entetes || 0) + decalage,
  lignes_ignorees: [],
  confiance: "haute",
  explication: "reponse simulee par le banc de diagnostic",
  colonnes: (plan.colonnes || []).map((c: any) => ({ colonne: c.colonne, champ: champ(c) })),
});
export const champsDe = (entite: string | null) => new Set(Object.keys(getSchema(entite || "")?.properties || {}));

export const MODES: Record<string, Reponse | null> = {
  // IA en panne : c'est ce que teste le banc DEMO depuis toujours.
  "sans-ia": null,
  // IA parfaite : elle rend exactement ce que trouvent les regles.
  "ia-fidele": (p) => versReponse(p, p.entite, (c) => c.champ || null),
  // IA trompee par le nom de la feuille (cas reel du 24 sept. : « Ventes_Transactions »
  // lu comme Transaction). Elle ne rattache que les colonnes qui existent dans ce type.
  "ia-nom": (p, feuille) => {
    const parNom = detectEntityByName(feuille) || p.entite;
    const ok = champsDe(parNom);
    return versReponse(p, parNom, (c) => (c.champ && ok.has(c.champ) ? c.champ : null));
  },
  // IA qui reconnait le type mais ne rattache aucune colonne.
  "ia-sans-colonnes": (p) => versReponse(p, p.entite, () => null),
  // IA qui se trompe d'une ligne sur les en-tetes.
  "ia-decalee": (p) => versReponse(p, p.entite, (c) => c.champ || null, 1),
};

// ---------------------------------------------------------------------------
// Faux client Base44 : tables en memoire, IA simulee.
// ---------------------------------------------------------------------------
export function client(repondre: ((prompt: string) => any) | null) {
  const tables: Record<string, any[]> = {};
  let seq = 0;
  const table = (n: string) => (tables[n] ||= []);
  const ajouter = (n: string, r: any) => { const x = { id: `${n}-${++seq}`, created_date: new Date().toISOString(), ...r }; table(n).push(x); return x; };
  const entite = (n: string) => ({
    create: async (r: any) => ajouter(n, r),
    bulkCreate: async (rs: any[]) => rs.map((r) => ajouter(n, r)),
    update: async (id: string, p: any) => Object.assign(table(n).find((r) => r.id === id) || {}, p),
    delete: async (id: string) => { const t = table(n); const i = t.findIndex((r) => r.id === id); if (i >= 0) t.splice(i, 1); return {}; },
    filter: async (q: any) => table(n).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)),
    list: async (_t?: string, limite = 500, depart = 0) => table(n).slice(depart, depart + limite),
  });
  const entities = new Proxy({}, { get: (_t, n: string) => entite(n) });
  let appelsIA = 0;
  const c = {
    auth: { me: async () => ({ id: "diag" }) },
    entities,
    integrations: { Core: { CreateFileSignedUrl: async () => ({ signed_url: "https://banc.invalid/f" }) } },
    asServiceRole: { entities, integrations: { Core: { InvokeLLM: async ({ prompt }: any) => {
      appelsIA++;
      if (!repondre) throw new Error("IA indisponible (diagnostic)");
      return repondre(prompt);
    } } } },
  };
  return { tables, client: c, appels: () => appelsIA };
}

export async function appeler(c: any, contenu: ArrayBuffer, nom: string, corps: any) {
  (globalThis as any).__BASE44_STUB = c;
  (globalThis as any).fetch = async () => new Response(contenu);
  const req = new Request("http://banc/importMultiData", {
    method: "POST",
    body: JSON.stringify({ files: [{ file_uri: "private/" + nom, file_name: nom }], ...corps }),
  });
  const rep = await (handler as any)(req);
  return rep.json();
}

export function kpiPage(tables: Record<string, any[]>, extra: string[] = []) {
  const data: Record<string, any[]> = {};
  for (const [cle, ent] of ENTITES_KPI) if (tables[ent]) data[cle] = tables[ent];
  const { records, semantics } = buildKpiDataset(data);
  for (const o of tables.Observation || []) records.push(o);
  const res = computeKpiBatch([...new Set([...Object.keys(KPI_REGISTRY), ...extra])], records, semantics);
  const out: Record<string, number | null> = {};
  for (const [k, l] of res as any) out[k] = l.value == null ? null : Math.round(l.value * 100) / 100;
  return out;
}
export const proche = (app: number | null, att: number | null) =>
  att === null ? app === null : app !== null && Number.isFinite(app) && Math.abs(app - att) <= Math.max(0.011, Math.abs(att) * 0.002);

export const accueil = (entite: string | null, colonnes: any[]) => {
  const p = champsDe(entite);
  return (colonnes || []).filter((c) => c?.champ && p.has(c.champ)).length;
};

