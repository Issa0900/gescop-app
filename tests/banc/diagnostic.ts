// Diagnostic de l'import : chaque fichier du dossier ../DEMO passe par le VRAI
// point d'entree importMultiData, comme a l'ecran (1. analyser, 2. importer avec
// les plans confirmes), sous plusieurs comportements d'IA simules. On releve :
//   - les incoherences de chaque feuille (controles C1 a C5 ci-dessous) ;
//   - les KPI et nombres de lignes compares a la verite terrain (verite_demo.ts) ;
//   - le type retenu pour chaque feuille selon le comportement de l'IA.
// Principe : quel que soit ce que repond l'IA, le resultat final doit etre juste.
// Aucune vraie IA n'est appelee, rien n'est ecrit ailleurs qu'en memoire.
//
// Usage : node tests/banc/lancer-demo.cjs diagnostic [filtre-fichier] [modes]

import handler from "../../base44/functions/importMultiData/entry.ts";
import { getSchema } from "../../base44/shared/entitySchemas.ts";
import { detectEntityByName } from "../../base44/shared/importUtils.ts";
import { computeKpiBatch } from "../../src/lib/core/kpiEngine.js";
import { buildKpiDataset, ENTITES_KPI } from "../../src/lib/core/kpiDataset.js";
import { KPI_REGISTRY } from "../../src/lib/core/kpiRegistry.js";
import { VERITE_DEMO } from "./verite_demo.ts";

declare const require: any;
declare const process: any;
const fs = require("fs");
const path = require("path");
const DEMO = path.resolve("..", "DEMO");

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
const champsDe = (entite: string | null) => new Set(Object.keys(getSchema(entite || "")?.properties || {}));

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
function client(repondre: ((prompt: string) => any) | null) {
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

async function appeler(c: any, contenu: ArrayBuffer, nom: string, corps: any) {
  (globalThis as any).__BASE44_STUB = c;
  (globalThis as any).fetch = async () => new Response(contenu);
  const req = new Request("http://banc/importMultiData", {
    method: "POST",
    body: JSON.stringify({ files: [{ file_uri: "private/" + nom, file_name: nom }], ...corps }),
  });
  const rep = await (handler as any)(req);
  return rep.json();
}

function kpiPage(tables: Record<string, any[]>, extra: string[] = []) {
  const data: Record<string, any[]> = {};
  for (const [cle, ent] of ENTITES_KPI) if (tables[ent]) data[cle] = tables[ent];
  const { records, semantics } = buildKpiDataset(data);
  for (const o of tables.Observation || []) records.push(o);
  const res = computeKpiBatch([...new Set([...Object.keys(KPI_REGISTRY), ...extra])], records, semantics);
  const out: Record<string, number | null> = {};
  for (const [k, l] of res as any) out[k] = l.value == null ? null : Math.round(l.value * 100) / 100;
  return out;
}
const proche = (app: number | null, att: number | null) =>
  att === null ? app === null : app !== null && Number.isFinite(app) && Math.abs(app - att) <= Math.max(0.011, Math.abs(att) * 0.002);

const accueil = (entite: string | null, colonnes: any[]) => {
  const p = champsDe(entite);
  return (colonnes || []).filter((c) => c?.champ && p.has(c.champ)).length;
};

// ---------------------------------------------------------------------------
// Controles de coherence d'une feuille (analyse + ce qui a ete ecrit).
// ---------------------------------------------------------------------------
function controlerFeuille(r: any, ri: any, tables: Record<string, any[]>, planRegles: any) {
  const constats: { code: string; detail: string }[] = [];
  const plan = r.plan || {};
  const ent = plan.entite || null;
  if (!ent) return constats;
  const props = getSchema(ent)?.properties || {};

  // C1 : chaque colonne rattachee a un champ qui existe dans le type retenu.
  const hors = (plan.colonnes || []).filter((c: any) => c.champ && !(c.champ in props)).map((c: any) => `${c.colonne}→${c.champ}`);
  if (hors.length) constats.push({ code: "C1 champ hors du type", detail: `${ent} : ${hors.slice(0, 6).join(", ")}${hors.length > 6 ? ` (+${hors.length - 6})` : ""}` });

  // C2 : le type retenu accueille au moins autant de colonnes que celui des regles.
  if (planRegles?.entite && planRegles.entite !== ent) {
    const n = accueil(ent, plan.colonnes), n0 = accueil(planRegles.entite, planRegles.colonnes);
    if (n0 >= n + 3 && n0 >= 1.5 * n) constats.push({ code: "C2 type moins adapte que les regles", detail: `${ent} accueille ${n} colonne(s), ${planRegles.entite} en accueillerait ${n0}` });
  }

  // C3 : l'apercu montre ce qui sera ecrit (dates converties).
  const datesBrutes: string[] = [];
  for (const ligne of r.apercu || []) {
    for (const [k, v] of Object.entries(ligne || {})) {
      if ((props as any)[k]?.format === "date" && v !== "" && v != null && !/^\d{4}-\d{2}-\d{2}/.test(String(v))) datesBrutes.push(`${k}=${String(v).slice(0, 20)}`);
    }
  }
  if (datesBrutes.length) constats.push({ code: "C3 apercu different de l'ecrit", detail: `dates non converties : ${[...new Set(datesBrutes)].slice(0, 3).join(", ")}` });

  // C4 : les lignes annoncees sont ecrites, ou conservees au registre avec un motif.
  const annoncees = r.quality?.total_rows ?? r.rows_read ?? 0;
  const id = ri?.import_id;
  const ecrites = id ? (tables[ri.entity || ent] || []).filter((x) => x.import_id === id).length : 0;
  const registre = id ? (tables.ImportIssue || []).filter((x) => x.import_id === id).length : 0;
  const perdues = annoncees - ecrites - registre;
  if (perdues > 0) constats.push({ code: "C4 lignes perdues sans motif", detail: `${annoncees} annoncee(s), ${ecrites} ecrite(s), ${registre} au registre : ${perdues} sans trace` });

  // C5 : le score et les « lignes valides » annonces correspondent a ce qui est ecrit.
  const valides = r.quality?.valid_rows;
  if (typeof valides === "number" && valides !== ecrites) constats.push({ code: "C5 annonce differente de l'ecrit", detail: `${valides} ligne(s) valides annoncees, ${ecrites} ecrite(s)` });

  // C6 : le type ecrit est celui qui a ete montre et confirme.
  if (ri?.entity && ri.entity !== ent) constats.push({ code: "C6 type ecrit different du type confirme", detail: `confirme ${ent}, ecrit ${ri.entity}` });
  return constats;
}

(async () => {
  const filtre = process.argv[3] || "";
  const modesDemandes = (process.argv[4] || Object.keys(MODES).join(",")).split(",");
  const log = console.log;
  const bruit = [console.warn, console.error, console.log];
  const taire = () => { console.warn = () => {}; console.error = () => {}; console.log = () => {}; };
  const parler = () => { [console.warn, console.error, console.log] = bruit; };

  const fichiers = fs.readdirSync(DEMO).filter((f: string) => /\.(xlsx|xls|csv|tsv)$/i.test(f) && (!filtre || filtre.split(",").some((x: string) => f.includes(x))));
  const rapport: any[] = [];
  for (const nom of fichiers) {
    const buf = fs.readFileSync(path.join(DEMO, nom));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const verite = VERITE_DEMO.find((v) => v.fichier === nom);

    // Plans des regles (reference pour les modes IA et pour C2).
    taire();
    const ref = client(null);
    const analyseRegles = await appeler(ref.client, ab, nom, { mode: "analyser" });
    parler();
    const plansRegles: Record<string, any> = {};
    for (const r of analyseRegles.results || []) if (r.plan) plansRegles[r.file_name] = r.plan;
    const etiquettes = Object.keys(plansRegles).sort((a, b) => b.length - a.length);

    for (const mode of modesDemandes) {
      const comportement = MODES[mode];
      if (comportement === undefined) continue;
      const repondre = comportement
        ? (prompt: string) => {
          const etiq = etiquettes.find((e) => prompt.includes(e));
          if (!etiq) throw new Error("feuille introuvable dans le prompt");
          const feuille = (/\[([^\]]+)\]$/.exec(etiq) || [])[1] || etiq;
          return comportement(plansRegles[etiq], feuille);
        }
        : null;
      const t0 = Date.now();
      taire();
      let analyse: any, importe: any, env: any;
      try {
        const a = client(repondre);
        analyse = await appeler(a.client, ab, nom, { mode: "analyser" });
        // Comme l'ecran : les plans montres sont renvoyes tels quels a la confirmation.
        const plans: Record<string, any> = {};
        for (const r of analyse.results || []) if (r.plan && r.plan.entite) plans[r.file_name] = r.plan;
        env = client(repondre);
        importe = await appeler(env.client, ab, nom, { plans });
        env.appelsAnalyse = a.appels();
      } catch (e: any) {
        parler();
        rapport.push({ fichier: nom, mode, erreur: String(e?.message || e) });
        continue;
      }
      parler();

      const feuilles = (analyse.results || []).map((r: any) => {
        const ri = (importe.results || []).find((x: any) => x.file_name === r.file_name);
        return {
          feuille: r.file_name, type: r.plan?.entite || r.entity || null, origine: r.plan?.origine || null,
          annoncees: r.quality?.total_rows ?? r.rows_read ?? 0, ecrites: ri?.rows ?? 0,
          constats: controlerFeuille(r, ri, env.tables, plansRegles[r.file_name]),
        };
      });
      const controles: any[] = [];
      if (verite) {
        const kpi = kpiPage(env.tables, Object.keys(verite.kpi || {}));
        for (const [k, att] of Object.entries(verite.kpi || {})) controles.push({ id: `kpi ${k}`, attendu: att, app: kpi[k] ?? null, ok: proche(kpi[k] ?? null, att as any) });
        for (const [e, n] of Object.entries(verite.lignes || {})) { const app = (env.tables[e] || []).length; controles.push({ id: `lignes ${e}`, attendu: n, app, ok: app === n }); }
      }
      rapport.push({ fichier: nom, mode, ms: Date.now() - t0, appelsIA: env.appelsAnalyse, feuilles, controles });
    }
  }

  // --- Synthese -------------------------------------------------------------
  log(`\n=== Diagnostic de l'import — ${fichiers.length} fichier(s), modes : ${modesDemandes.join(", ")} ===`);
  const parMode: Record<string, { ok: number; total: number; constats: Record<string, number>; appels: number; erreurs: number }> = {};
  for (const r of rapport) {
    const m = (parMode[r.mode] ||= { ok: 0, total: 0, constats: {}, appels: 0, erreurs: 0 });
    if (r.erreur) { m.erreurs++; continue; }
    m.appels += r.appelsIA || 0;
    m.ok += r.controles.filter((c: any) => c.ok).length; m.total += r.controles.length;
    for (const f of r.feuilles) for (const c of f.constats) m.constats[c.code] = (m.constats[c.code] || 0) + 1;
  }
  log("\nMode                 KPI/lignes justes   appels IA   erreurs   constats de coherence");
  for (const [mode, m] of Object.entries(parMode)) {
    const cs = Object.entries(m.constats).sort().map(([k, n]) => `${k.split(" ")[0]}×${n}`).join(" ") || "aucun";
    log(`${mode.padEnd(20)} ${`${m.ok}/${m.total}`.padStart(9)}          ${String(m.appels).padStart(5)}      ${String(m.erreurs).padStart(4)}     ${cs}`);
  }
  const legende = new Set<string>();
  for (const m of Object.values(parMode)) for (const k of Object.keys(m.constats)) legende.add(k);
  if (legende.size) log("\nLegende : " + [...legende].sort().join(" · "));

  // Types qui changent selon l'IA : la lecture ne devrait pas en dependre.
  log("\n--- Feuilles dont le type depend de la reponse de l'IA ---");
  const types: Record<string, Record<string, string>> = {};
  for (const r of rapport) if (!r.erreur) for (const f of r.feuilles) ((types[f.feuille] ||= {})[r.mode] = f.type || "(aucun)");
  let instables = 0;
  for (const [feuille, t] of Object.entries(types)) {
    if (new Set(Object.values(t)).size > 1) { instables++; log(`  ${feuille}\n     ${Object.entries(t).map(([m, e]) => `${m}=${e}`).join("  ")}`); }
  }
  if (!instables) log("  aucune");

  log("\n--- Detail des constats et des controles faux ---");
  for (const r of rapport) {
    if (r.erreur) { log(`\n[${r.mode}] ${r.fichier} : ERREUR ${r.erreur}`); continue; }
    const faux = r.controles.filter((c: any) => !c.ok);
    const avec = r.feuilles.filter((f: any) => f.constats.length);
    if (!faux.length && !avec.length) continue;
    log(`\n[${r.mode}] ${r.fichier}`);
    for (const f of avec) for (const c of f.constats) log(`   ${c.code} — ${f.feuille.split(" [").pop()?.replace("]", "")} : ${c.detail}`);
    for (const c of faux) log(`   ✗ ${c.id} : app ${c.app}, attendu ${c.attendu}`);
  }

  const dossier = path.join("tests", "banc", "resultats");
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, "diagnostic.json"), JSON.stringify(rapport, null, 1));
  log(`\nDetail complet : tests/banc/resultats/diagnostic.json`);
})();
