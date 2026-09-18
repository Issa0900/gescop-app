import { detectEntityByHeaders, detectEntityByFieldOverlap } from "../../base44/shared/sheetDetect.ts";

const entetesVentes = ["Date", "Client", "Produit", "Categorie", "Quantite", "Prix_unitaire", "Total"];
const entetesDepenses = ["Date", "Fournisseur", "Categorie", "Montant", "Description"];

console.log("Ventes   - byHeaders:", detectEntityByHeaders(entetesVentes), " byFieldOverlap:", detectEntityByFieldOverlap(entetesVentes));
console.log("Depenses - byHeaders:", detectEntityByHeaders(entetesDepenses), " byFieldOverlap:", detectEntityByFieldOverlap(entetesDepenses));
