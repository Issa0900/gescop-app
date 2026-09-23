// Sonde : importe un fichier quelconque par le vrai importMultiData et montre
// ce que GESCOP a compris (entite, champs, exemples, registre, KPI page).
// Usage : node tests/banc/lancer-sonde.cjs <chemin-fichier>
import { importer } from "./outils.ts";
import { computeKpiBatch } from "../../src/lib/core/kpiEngine.js";
import { buildKpiDataset, ENTITES_KPI } from "../../src/lib/core/kpiDataset.js";
import { KPI_REGISTRY } from "../../src/lib/core/kpiRegistry.js";
declare const require: any; declare const process: any;
const fs = require("fs"); const path = require("path");
(async () => {
  const f = process.argv[2];
  const buf = fs.readFileSync(f);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const log = console.log; const bruit = [console.warn, console.error];
  if (!process.env.BRUIT) { console.warn = () => {}; console.error = () => {}; }
  const t0 = Date.now();
  const { tables, results, erreur } = await importer(path.basename(f), ab);
  const ms = Date.now() - t0;
  [console.warn, console.error] = bruit;
  log("erreur:", erreur, "  duree import s:", ms / 1000, " memoire Mo:", Math.round(process.memoryUsage().rss / 1e6));
  for (const r of results) log("FEUILLE", JSON.stringify({ f: r.file_name, e: r.entity, lues: r.rows_read, imp: r.rows, quar: r.quarantined, map: r.mapping || r.field_mapping, notes: r.warnings?.slice?.(0, 12) }));
  for (const [n, rs] of Object.entries(tables)) log("TABLE", n, (rs as any[]).length);
  for (const n of Object.keys(tables)) if (!["Import", "ImportIssue", "Observation"].includes(n)) { const x = { ...(tables[n] as any[])[0] }; delete x.original_data; log("EX", n, JSON.stringify(x).slice(0, 1500)); }
  const motifs: Record<string, number> = {};
  for (const i of tables.ImportIssue || []) motifs[i.reason_code] = (motifs[i.reason_code] || 0) + 1;
  log("MOTIFS", JSON.stringify(motifs));
  const imp = (tables.Import || [])[0]; if (imp) { const y = { ...imp }; log("IMPORT", JSON.stringify(y).slice(0, 4000)); }
  const data: Record<string, any[]> = {};
  for (const [cle, entite] of ENTITES_KPI) if (tables[entite]) data[cle] = tables[entite];
  const { records, semantics } = buildKpiDataset(data);
  for (const o of tables.Observation || []) records.push(o);
  const res = computeKpiBatch(Object.keys(KPI_REGISTRY), records, semantics);
  const out: any = {};
  for (const [k, l] of res as any) if (l.value != null) out[k] = [Math.round(l.value * 100) / 100, l.status, l.meta?.warnings?.[0] || l.warnings?.[0] || ""];
  log("KPI", JSON.stringify(out, null, 0));
  if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify({ Order: (tables.Order || []).map((r: any) => { const { original_data, ...x } = r; return x; }), ImportIssue: (tables.ImportIssue || []).slice(0, 3000) }));
  // Toutes les tables du moteur, pour rejouer les calculs des ecrans hors navigateur.
  if (process.env.DUMP_TOUT) fs.writeFileSync(process.env.DUMP_TOUT, JSON.stringify(Object.fromEntries(Object.entries(data).map(([cle, rs]) => [cle, (rs as any[]).map((r: any) => { const { original_data, ...x } = r; return x; })]))));
  if (process.env.SORTIE) fs.writeFileSync(process.env.SORTIE, JSON.stringify({ ms, results, motifs, kpi: out, lignes: Object.fromEntries(Object.entries(tables).map(([n, r]) => [n, (r as any[]).length])) }, null, 1));
})();
