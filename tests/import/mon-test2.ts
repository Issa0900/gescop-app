import { normalizeRow } from "../../base44/shared/importUtils.ts";
import { getSchema } from "../../base44/shared/entitySchemas.ts";
import { missingRequired } from "../../base44/shared/bulkInsert.ts";

const ventes = [
  { Date: "2026-01-05", Client: "Boutique Nordik", Produit: "Tapis Scandinave", Categorie: "Decoration", Quantite: "3", Prix_unitaire: "89.99", Total: "269.97" },
  { Date: "2026-01-08", Client: "Residence Tremblay", Produit: "Rideaux Lin", Categorie: "Textile", Quantite: "5", Prix_unitaire: "45.50", Total: "227.50" },
];

const schema = getSchema("Order")!;
for (const ligne of ventes) {
  const n = normalizeRow("Order", ligne, "imp-test", schema.properties, "csv", []);
  const manquants = missingRequired(n, schema.required);
  console.log(JSON.stringify({ ligne, normalise: n, manquants }, null, 0));
}
