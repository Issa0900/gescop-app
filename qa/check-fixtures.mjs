// Vérifie que chaque champ des données de test existe dans le schéma Base44 de l'entité.
import fs from 'node:fs';
import { RICH } from './e2e/fixtures.js';
let bad = 0;
for (const [ent, rows] of Object.entries(RICH)) {
  const f = `base44/entities/${ent}.jsonc`;
  if (!fs.existsSync(f)) { console.log(`?? ${ent}: pas de schéma`); continue; }
  const schema = JSON.parse(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''));
  const props = new Set(Object.keys(schema.properties || {}));
  const inconnus = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => k !== 'id' && k !== 'created_date' && !props.has(k));
  if (inconnus.length) { bad++; console.log(`${ent}: champs hors schéma -> ${inconnus.join(', ')}  | schéma: ${[...props].join(', ')}`); }
}
process.exit(bad ? 1 : 0);
