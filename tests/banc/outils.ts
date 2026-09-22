// Outils communs du banc : un faux client Base44 en memoire (le vrai point
// d'entree de production s'execute contre lui) et la fabrication de classeurs.

import * as XLSX from "npm:xlsx@0.18.5";
import handler from "../../base44/functions/importMultiData/entry.ts";

export function fauxClient(reponseIA?: (feuille: string) => any, depart: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = JSON.parse(JSON.stringify(depart));
  let seq = 0;
  const table = (nom: string) => (tables[nom] ||= []);
  const ajouter = (nom: string, r: any) => {
    const rec = { id: `${nom}-${++seq}`, created_date: new Date().toISOString(), ...r };
    table(nom).push(rec);
    return rec;
  };
  const entite = (nom: string) => ({
    create: async (r: any) => ajouter(nom, r),
    bulkCreate: async (rs: any[]) => rs.map((r) => ajouter(nom, r)),
    update: async (id: string, patch: any) => Object.assign(table(nom).find((r) => r.id === id) || {}, patch),
    delete: async (id: string) => { const t = table(nom); const i = t.findIndex((r) => r.id === id); if (i >= 0) t.splice(i, 1); return {}; },
    filter: async (q: any) => table(nom).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)),
    list: async (_tri?: string, limite = 500, depart = 0) => table(nom).slice(depart, depart + limite),
  });
  const entities = new Proxy({}, { get: (_t, nom: string) => entite(nom) });
  return {
    tables,
    client: {
      auth: { me: async () => ({ id: "banc" }) },
      entities,
      asServiceRole: {
        entities,
        integrations: {
          Core: {
            InvokeLLM: async ({ prompt }: any) => {
              if (!reponseIA) throw new Error("IA indisponible (banc)");
              const m = /\[([^\]]+)\]/.exec(prompt);
              return reponseIA(m ? m[1] : "");
            },
          },
        },
      },
    },
  };
}

export function classeur(feuilles: Record<string, any[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [nom, m] of Object.entries(feuilles)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(m), nom);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer;
}

export async function importer(
  nomFichier: string, contenu: ArrayBuffer, typeManuel?: string, reponseIA?: (f: string) => any,
  existant?: ReturnType<typeof fauxClient>,
) {
  const { tables, client } = existant || fauxClient(reponseIA);
  (globalThis as any).__BASE44_STUB = client;
  (globalThis as any).fetch = async () => new Response(contenu);
  const req = new Request("http://banc/importMultiData", {
    method: "POST",
    body: JSON.stringify({ files: [{ file_url: "mem://" + nomFichier, file_name: nomFichier }], entity_override: typeManuel }),
  });
  const res = await (handler as any)(req);
  const corps = await res.json();
  return { tables, results: (corps.results || []) as any[], erreur: corps.error as string | undefined };
}

