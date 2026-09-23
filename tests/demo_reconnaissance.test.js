// Reconnaissance generale (audit du dossier DEMO, 23 sept 2026) : les regles
// doivent tenir sur des intitules jamais vus, pas seulement sur ceux des 27
// fichiers. Le banc de robustesse (npm run test:robustesse) le verifie en
// grand ; ces tests fixent les regles une par une.
import test from "node:test";
import assert from "node:assert/strict";
import { champParLexique, rattacherParLexique, motsDe } from "../base44/shared/registry/lexiqueChamps.ts";
import { planParRegles } from "../base44/shared/importPlan.ts";
import { cleCanonique } from "../base44/shared/importUtils.ts";
import { deduplicateRows } from "../base44/shared/deduplication.ts";
import { estDictionnaireDeDonnees } from "../base44/shared/sheetDetect.ts";
import { runCoherenceChecks } from "../src/lib/dataAudit.js";
import { baseCA, commandesDistinctes } from "../src/lib/core/kpiRecords.js";

test("Mots d'un intitule : casse chameau, unites, accents et pluriels", () => {
  assert.deepEqual(motsDe("OrderID"), ["order", "id"]);
  assert.deepEqual(motsDe("Budget (CAD)"), ["budget"]);
  assert.deepEqual(motsDe("amount_ht_cad"), ["amount", "ht"]);
  assert.deepEqual(motsDe("Nouveaux clients"), ["nouveau", "client"]);
  assert.equal(cleCanonique("IdTransaction"), "id_transaction");
});

test("Un meme champ reconnu sous des formes differentes, en francais et en anglais", () => {
  for (const h of ["Nom du fournisseur", "Raison_Sociale", "vendor_name", "SupplierName", "NOM FOURNISSEUR"]) {
    assert.equal(champParLexique("Supplier", h), "supplier_name", h);
  }
  for (const h of ["Dépense", "spend", "daily_cost_cad", "budget_depense", "Coût campagne ($)"]) {
    assert.equal(champParLexique("Campaign", h), "spend", h);
  }
  for (const h of ["ID Client", "customer_id", "CustomerID", "Code client"]) {
    assert.equal(champParLexique("Customer", h), "customer_id", h);
  }
  assert.equal(champParLexique("Campaign", "Coût / Clic ($)"), null, "un cout par clic n'est pas une depense");
  assert.equal(champParLexique("Expense", "Dépense"), "amount", "sur une depense, « depense » est le montant");
});

test("Taxes, HT et TTC : chaque montant dans son champ", () => {
  assert.equal(champParLexique("Order", "Sous_Total_HT"), "subtotal");
  assert.equal(champParLexique("Order", "Total_TTC_CAD"), "total");
  assert.equal(champParLexique("Order", "montant_ttc"), "total");
  assert.equal(champParLexique("Order", "Taxe fédérale"), "tax_federal");
  assert.equal(champParLexique("Order", "tvq_9_975pct_cad"), "tax_provincial");
  assert.equal(champParLexique("Order", "Montant_Taxes_Total"), "tax");
});

test("Identifiant de ligne : Transaction_ID a cote d'un Order_ID ; seul, c'est le numero de commande", () => {
  const avec = rattacherParLexique("Order", ["Transaction_ID", "Order_ID", "Product_ID"]);
  assert.equal(avec.get("Transaction_ID"), "line_id");
  assert.equal(avec.get("Order_ID"), "order_id");
  const seul = rattacherParLexique("Order", ["IdTransaction", "Date", "IdClient"]);
  assert.equal(seul.get("IdTransaction"), "order_id");
});

test("Plusieurs colonnes pour un champ : la plus generale (« total ») l'emporte", () => {
  const m = rattacherParLexique("Cashflow", ["cash_outflows_payroll_cad", "cash_outflows_marketing_cad", "total_cash_outflows_cad"]);
  assert.equal(m.get("total_cash_outflows_cad"), "cash_out");
  assert.equal(m.get("cash_outflows_payroll_cad"), undefined);
});

test("Grain : une campagne qui se repete semaine apres semaine est une serie (CampaignDaily)", () => {
  const m = [["campaign_id", "nom_campagne", "budget_depense", "clics", "semaine_du"]];
  for (let s = 1; s <= 4; s++) for (const c of ["M-1", "M-2"]) m.push([c, `Campagne ${c}`, 100 * s, 10 * s, `2026-03-0${s}`]);
  assert.equal(planParRegles(m, "marketing.xlsx").entite, "CampaignDaily");
});

test("Meme identifiant avec d'autres valeurs : conflit a trancher, pas doublon", async () => {
  const table = [];
  const client = { entities: new Proxy({}, { get: () => ({ list: async (_s, l, o) => table.slice(o, o + l) }) }) };
  const res = await deduplicateRows(client, "Product", [
    { product_id: "P-1", product_name: "Tente", selling_price: 450 },
    { product_id: "P-1", product_name: "Tente", selling_price: 450 },
    { product_id: "P-1", product_name: "Casque", selling_price: 90 },
  ]);
  assert.equal(res.newCount, 1);
  assert.equal(res.duplicateCount, 1);
  assert.equal(res.conflits.length, 1);
});

test("Deux articles d'une meme commande et d'un meme produit, identifiants de ligne distincts : gardes tous les deux", async () => {
  const client = { entities: new Proxy({}, { get: () => ({ list: async () => [] }) }) };
  const res = await deduplicateRows(client, "Order", [
    { order_id: "O-1", line_id: "T-1", product_id: "P-1", quantity: 1 },
    { order_id: "O-1", line_id: "T-2", product_id: "P-1", quantity: 3 },
  ]);
  assert.equal(res.newCount, 2);
});

test("Un dictionnaire de donnees est reconnu comme tel", () => {
  assert.equal(estDictionnaireDeDonnees(["Column_Name", "Description", "Data_Type", "Example_Value"]), true);
  assert.equal(estDictionnaireDeDonnees(["Champ", "Définition", "Format"]), true);
  assert.equal(estDictionnaireDeDonnees(["order_id", "date", "description", "type"]), false);
});

test("Controles croises : fiche client, catalogue, succursale, budget, devises", () => {
  const checks = runCoherenceChecks({
    orders: [
      { order_id: "C1", customer_id: "K1", product_id: "P1", unit_price: 10, subtotal: 100, employee_id: "E1", location_id: "Laval", original_data: JSON.stringify({ Country: "Canada" }) },
      { order_id: "C2", customer_id: "K1", product_id: "P1", unit_price: 12, subtotal: 50, employee_id: "E1", location_id: "Lévis", original_data: JSON.stringify({ Country: "France" }) },
    ],
    customers: [{ customer_id: "K1", total_revenue: 999 }],
    products: [{ product_id: "P1", selling_price: 10, purchase_cost: 5, product_name: "Tente" }],
    inventory: [{ product_id: "P1", unit_cost: 7, product_name: "Article #1" }],
    employees: [{ employee_id: "E1", location: "Laval" }],
    campaigns: [{ campaign_id: "M1", budget: 100, spend: 150 }],
  });
  const statut = (l) => checks.find((c) => c.label === l)?.status;
  assert.equal(statut("Revenu de chaque fiche client vs ses commandes"), "warn");
  assert.equal(statut("Prix des commandes vs prix du catalogue"), "warn");
  assert.equal(statut("Inventaire vs catalogue produits (coût et nom)"), "warn");
  assert.equal(statut("Succursale des ventes vs succursale du vendeur"), "warn");
  assert.equal(statut("Dépense des campagnes vs budget"), "warn");
  assert.equal(statut("Devises et pays des ventes"), "warn");
});

test("Base du CA affichee : HT, TTC ou inconnue", () => {
  assert.equal(baseCA([{ subtotal: 100, total: 115 }]), "HT");
  assert.equal(baseCA([{ total: 115, original_data: JSON.stringify({ montant_ttc: "115" }) }]), "TTC");
  assert.equal(baseCA([{ total: 115, original_data: JSON.stringify({ Sales: "115" }) }]), null);
  assert.equal(commandesDistinctes([{ order_id: "A", subtotal: 1 }, { order_id: "A", subtotal: 2 }, { order_id: "B", subtotal: 3 }]).length, 2);
});

test("Devises : devise de la ligne lue ou deduite du pays", async () => {
  const { codeDevise, deviseDeLigne } = await import("../base44/shared/devises.ts");
  assert.equal(codeDevise("usd"), "USD");
  assert.equal(codeDevise("€"), "EUR");
  // Le pays ne donne la devise que s'il situe la VENTE (magasin, succursale).
  assert.equal(deviseDeLigne({ Country: "United Kingdom", Store_Name: "London Central" }), "GBP");
  assert.equal(deviseDeLigne({ "Pays du magasin": "France", City: "Paris" }), "EUR");
  assert.equal(deviseDeLigne({ Devise: "EUR", Pays: "Canada" }), "EUR");
  assert.equal(deviseDeLigne({ City: "Paris" }), null);
  // Pays du client seul (UCI Online Retail : un detaillant britannique facture
  // en livres ses clients de 38 pays) : aucune devise deduite.
  assert.equal(deviseDeLigne({ Country: "France", City: "Paris" }), null);
  assert.equal(deviseDeLigne({ "Customer Country": "France", Store_Name: "London Central" }), null);
});

test("Devises : converties avec le taux fourni, exclues sans taux (KPI partiel), jamais additionnees brutes", async () => {
  const { normaliserDevises } = await import("../src/lib/core/kpiRecords.js");
  const { computeKpiBatch } = await import("../src/lib/core/kpiEngine.js");
  const { buildKpiDataset } = await import("../src/lib/core/kpiDataset.js");
  const orders = [
    { order_id: "A", date: "2026-01-01", subtotal: 100, currency: "CAD" },
    { order_id: "B", date: "2026-01-02", subtotal: 100, currency: "CAD" },
    { order_id: "C", date: "2026-01-03", subtotal: 100, currency: "USD" },
    { order_id: "D", date: "2026-01-04", subtotal: 100, currency: "EUR" },
  ];
  const n = normaliserDevises(orders, { base: "CAD", taux: { USD: 1.37 } });
  assert.equal(n.base, "CAD");
  assert.equal(n.converties, 1);
  assert.deepEqual(n.sansTaux, ["EUR"]);
  assert.equal(normaliserDevises(n.rows, {}).rows, n.rows, "idempotent");
  const { records, semantics } = buildKpiDataset({ orders, devises: { base: "CAD", taux: { USD: 1.37 } } });
  const ca = computeKpiBatch(["total_revenue"], records, semantics).get("total_revenue");
  assert.equal(Math.round(ca.value * 100) / 100, 337);
  assert.equal(ca.status, "UNKNOWN");
});

test("Dictionnaire de donnees : apprend le sens d'une colonne inconnue, jamais un champ deja couvert", async () => {
  const { apprendreDictionnaire } = await import("../base44/shared/dictionnaireDonnees.ts");
  const m = [
    ["Column_Name", "Description", "Data_Type"],
    ["Order_ID", "Unique order number", "Text"],
    ["Order_Date", "Date of the order", "Date"],
    ["Customer_ID", "Customer identifier", "Text"],
    ["Nb_Art", "Quantité d'articles vendus", "Integer"],
    ["Order_Year", "Year derived from Order_Date", "Integer"],
    ["Discount_Percentage", "Discount applied", "Decimal"],
  ];
  const appris = apprendreDictionnaire(m, 0);
  assert.deepEqual(appris.map((a) => `${a.terme}:${a.champ}`), ["Nb_Art:quantity"]);
  assert.deepEqual(apprendreDictionnaire(m, 0, { nb_art: "quantity" }), [], "un terme deja defini par l'entreprise n'est pas reecrit");
});

test("Dictionnaire de l'entreprise : les deux formes enregistrees sont lues", async () => {
  const { buildCompanyDictionaryIndex } = await import("../base44/shared/importUtils.ts");
  assert.deepEqual(buildCompanyDictionaryIndex({ "Profit Brut ($)": "gross_profit" }), { profit_brut: "gross_profit" });
  assert.deepEqual(buildCompanyDictionaryIndex([{ term: "Profit Brut ($)", maps_to: "gross_profit" }]), { profit_brut: "gross_profit" });
});
