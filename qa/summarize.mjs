// Regroupe les constats (findings.jsonl) par gravité pour le rapport.
import fs from 'node:fs';
const f = 'qa/out/findings.jsonl';
if (!fs.existsSync(f)) { console.log('aucun constat'); process.exit(0); }
const rows = fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
  .filter((r) => r.gravite !== 'info' && r.type !== 'lenteur');
const cle = (r) => `${r.gravite}|${r.type}|${r.route}`;
const uniq = [...new Map(rows.map((r) => [cle(r), r])).values()];
const ordre = { critique: 0, majeur: 1, moyen: 2, mineur: 3 };
uniq.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
for (const r of uniq) console.log(`${r.gravite.padEnd(8)} ${r.route.padEnd(30)} ${r.type} — ${String(r.detail).slice(0, 140).replace(/\n/g, ' ')}`);
fs.writeFileSync('qa/out/findings-summary.json', JSON.stringify(uniq, null, 1));
