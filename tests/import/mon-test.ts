// Test bout-en-bout avec les fichiers Ventes.csv / Depenses.csv de Pelletier Deco Surfaces
// (chiffres calcules a la main, comme le ferait un utilisateur qui verifie son propre fichier source)
import { detectEntityByHeaders, detectEntityByFieldOverlap } from "../../base44/shared/sheetDetect.ts";
import { normalizeRow } from "../../base44/shared/importUtils.ts";
import { getSchema } from "../../base44/shared/entitySchemas.ts";
import { missingRequired } from "../../base44/shared/bulkInsert.ts";

let echecs = 0;
const verif = (obtenu: any, attendu: any, libelle: string) => {
  const ok = Math.abs(Number(obtenu) - Number(attendu)) < 0.01;
  if (!ok) echecs++;
  console.log(`${ok ? "ok  " : "KO  "} ${libelle.padEnd(50)} obtenu ${obtenu}   attendu ${attendu}`);
};

// ---- Ventes.csv : export "tableur" typique d'un petit commerce, SANS colonne numero de commande ----
const entetesVentes = ["Date", "Client", "Produit", "Categorie", "Quantite", "Prix_unitaire", "Total"];
const ventes = [
  { Date: "2026-01-05", Client: "Boutique Nordik", Produit: "Tapis Scandinave", Categorie: "Decoration", Quantite: "3", Prix_unitaire: "89.99", Total: "269.97" },
  { Date: "2026-01-08", Client: "Residence Tremblay", Produit: "Rideaux Lin", Categorie: "Textile", Quantite: "5", Prix_unitaire: "45.50", Total: "227.50" },
  { Date: "2026-01-12", Client: "Cafe Central", Produit: "Coussins Deco", Categorie: "Textile", Quantite: "10", Prix_unitaire: "22.00", Total: "220.00" },
  { Date: "2026-01-15", Client: "Boutique Nordik", Produit: "Lampe Bois", Categorie: "Eclairage", Quantite: "2", Prix_unitaire: "129.00", Total: "258.00" },
  { Date: "2026-01-20", Client: "Studio Yoga Zen", Produit: "Tapis Scandinave", Categorie: "Decoration", Quantite: "4", Prix_unitaire: "89.99", Total: "359.96" },
  { Date: "2026-01-22", Client: "Residence Tremblay", Produit: "Miroir Mural", Categorie: "Decoration", Quantite: "1", Prix_unitaire: "175.00", Total: "175.00" },
  { Date: "2026-02-03", Client: "Cafe Central", Produit: "Etagere Murale", Categorie: "Mobilier", Quantite: "3", Prix_unitaire: "65.00", Total: "195.00" },
  { Date: "2026-02-10", Client: "Boutique Nordik", Produit: "Coussins Deco", Categorie: "Textile", Quantite: "15", Prix_unitaire: "22.00", Total: "330.00" },
  { Date: "2026-02-14", Client: "Studio Yoga Zen", Produit: "Rideaux Lin", Categorie: "Textile", Quantite: "6", Prix_unitaire: "45.50", Total: "273.00" },
  { Date: "2026-02-18", Client: "Residence Tremblay", Produit: "Lampe Bois", Categorie: "Eclairage", Quantite: "3", Prix_unitaire: "129.00", Total: "387.00" },
];

// ---- Depenses.csv ----
const entetesDepenses = ["Date", "Fournisseur", "Categorie", "Montant", "Description"];
const depenses = [
  { Date: "2026-01-03", Fournisseur: "Meubles Quebec Inc", Categorie: "Achat marchandise", Montant: "850.00", Description: "Achat tapis et coussins" },
  { Date: "2026-01-10", Fournisseur: "Hydro-Quebec", Categorie: "Electricite", Montant: "210.45", Description: "Facture electricite boutique" },
  { Date: "2026-01-18", Fournisseur: "Location Commerciale XYZ", Categorie: "Loyer", Montant: "1800.00", Description: "Loyer janvier" },
  { Date: "2026-02-01", Fournisseur: "Meubles Quebec Inc", Categorie: "Achat marchandise", Montant: "620.00", Description: "Reapprovisionnement lampes" },
  { Date: "2026-02-15", Fournisseur: "Location Commerciale XYZ", Categorie: "Loyer", Montant: "1800.00", Description: "Loyer fevrier" },
];

console.log("===== 1. Detection du type d'entite =====");
const entiteVentes = detectEntityByHeaders(entetesVentes) || detectEntityByFieldOverlap(entetesVentes);
const entiteDepenses = detectEntityByHeaders(entetesDepenses) || detectEntityByFieldOverlap(entetesDepenses);
console.log(`Ventes.csv   ${JSON.stringify(entetesVentes)} -> ${entiteVentes}`);
console.log(`Depenses.csv ${JSON.stringify(entetesDepenses)} -> ${entiteDepenses}`);

console.log("\n===== 2. Normalisation + validation des champs obligatoires =====");
function traiter(nomFichier: string, entite: string | null, lignes: any[]) {
  if (!entite) { console.log(`${nomFichier}: AUCUNE entite detectee, fichier illisible pour l'app`); return { acceptees: [], quarantaine: lignes.length }; }
  const schema = getSchema(entite);
  if (!schema) { console.log(`${nomFichier}: entite '${entite}' detectee mais sans schema connu`); return { acceptees: [], quarantaine: lignes.length }; }
  const acceptees: any[] = [];
  let quarantaine = 0;
  for (const ligne of lignes) {
    const n = normalizeRow(entite, ligne, "imp-test", schema.properties, "csv", []);
    const manquants = missingRequired(n, schema.required);
    if (manquants.length > 0) {
      console.log(`  QUARANTAINE (${nomFichier}) champs manquants [${manquants.join(",")}] pour ligne:`, JSON.stringify(ligne));
      quarantaine++;
      continue;
    }
    acceptees.push(n);
  }
  return { acceptees, quarantaine };
}

const resVentes = traiter("Ventes.csv", entiteVentes, ventes);
const resDepenses = traiter("Depenses.csv", entiteDepenses, depenses);

verif(resVentes.acceptees.length, 10, "Ventes.csv : lignes acceptees");
verif(resVentes.quarantaine, 0, "Ventes.csv : lignes en quarantaine");
verif(resDepenses.acceptees.length, 5, "Depenses.csv : lignes acceptees");
verif(resDepenses.quarantaine, 0, "Depenses.csv : lignes en quarantaine");

console.log("\n===== 3. Chiffres calcules a la main sur le fichier source =====");
const champMontantVentes = entiteVentes === "Order" ? "total" : "amount";
const totalVentesCalc = resVentes.acceptees.reduce((s, r) => s + (Number(r[champMontantVentes]) || 0), 0);
const totalDepensesCalc = resDepenses.acceptees.reduce((s, r) => s + (Number(r.amount) || 0), 0);
verif(totalVentesCalc, 2695.43, "Total Ventes apres normalisation (attendu: somme manuelle du CSV)");
verif(totalDepensesCalc, 5280.45, "Total Depenses apres normalisation (attendu: somme manuelle du CSV)");

console.log("\ncas en echec :", echecs);
