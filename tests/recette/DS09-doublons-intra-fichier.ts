// Regle revue le 22 sept 2026 (decision metier) : des lignes identiques SANS
// identifiant sont conservees et signalees, pas supprimees ; seul un
// identifiant ou un import precedent prouve le doublon.
// Cas non couvert par DS03 (qui teste la reimportation d'un fichier) :
// deux lignes STRICTEMENT identiques a l'interieur du MEME fichier, comme
// un export comptable avec une ligne dupliquee par erreur ou un copier-
// coller malheureux (sec3/sec8 de l'audit).
import { deduplicateRows } from "../../base44/shared/deduplication.ts";
import { normalizeRow } from "../../base44/shared/importUtils.ts";
import { getSchema } from "../../base44/shared/entitySchemas.ts";

let e = 0;
const t = (b: boolean, msg: string) => { if (!b) e++; console.log(`${b ? "ok  " : "KO  "} ${msg}`); };

const schema = getSchema("Transaction")!;

function magasinVide() {
  const table: any[] = [];
  return { entities: { Transaction: {
    list: async (_s: string, limit: number, offset: number) => table.slice(offset, offset + limit),
    create: async (d: any) => { table.push(d); return d; },
  } }, __table: table };
}

(async () => {
  const base44 = magasinVide();
  const importId = "imp-unique";
  const fichier = [
    { "Date": "2026-03-01", "Montant": "500", "Type": "Revenu", "Description": "Vente" },
    { "Date": "2026-03-01", "Montant": "500", "Type": "Revenu", "Description": "Vente" }, // copie exacte
    { "Date": "2026-03-01", "Montant": "500", "Type": "Revenu", "Description": "Vente" }, // triple
    { "Date": "2026-03-02", "Montant": "300", "Type": "Depense", "Description": "Fournitures" },
  ];
  const lignes = fichier.map((r) => normalizeRow("Transaction", r, importId, schema.properties, "csv", []));

  // Regle metier du 22 sept 2026 : sans identifiant, trois lignes identiques
  // peuvent etre trois ventes reelles. Elles sont TOUTES conservees, et les
  // deux repetitions signalees comme doublons potentiels a verifier — les
  // exclure d'office divisait les ventes par trois sans preuve.
  const res = await deduplicateRows(base44, "Transaction", lignes);
  t(res.newCount === 4 && res.duplicateCount === 0 && res.potentialDuplicates.length === 2,
    `4 lignes dont 3 identiques -> ${res.newCount} conservees, ${res.duplicateCount} exclues, ${res.potentialDuplicates.length} doublons potentiels signales (attendu 4 / 0 / 2)`);
  for (const r of res.newRows) await base44.entities.Transaction.create(r);
  t(base44.__table.length === 4, `table finale : ${base44.__table.length} lignes (attendu 4 : rien n'est perdu)`);

  // Reimporter le meme fichier reste idempotent : la k-ieme occurrence n'est
  // exclue que si la base en contient deja k (preuve : deja importee).
  const encore = await deduplicateRows(base44, "Transaction", fichier.map((r) => normalizeRow("Transaction", r, "imp-2", schema.properties, "csv", [])));
  t(encore.newCount === 0 && encore.duplicateCount === 4, `reimport du meme fichier -> ${encore.newCount} nouvelles, ${encore.duplicateCount} doublons (attendu 0 / 4)`);

  // Un fichier suivant qui contient UNE vente identique de plus : seule elle entre.
  const plus = [...fichier, { "Date": "2026-03-01", "Montant": "500", "Type": "Revenu", "Description": "Vente" }];
  const suite = await deduplicateRows(base44, "Transaction", plus.map((r) => normalizeRow("Transaction", r, "imp-3", schema.properties, "csv", [])));
  t(suite.newCount === 1, `fichier avec une 4e vente identique -> ${suite.newCount} nouvelle(s) (attendu 1)`);

  console.log("\ncas en echec :", e);
})();
