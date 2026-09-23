// Jeu de donnees unique du moteur KPI : quelles entites entrent dans le calcul
// et avec quelles semantiques. Partage par useKpiEngine (les pages) et par le
// banc de mesure (tests/banc), pour que le banc mesure exactement ce que
// l'utilisateur voit.

import { getEntitySemantics } from "./entityFieldMap";
import { normaliserDevises } from "./kpiRecords";

// [cle dans l'objet `data` des pages, entite Base44]
export const ENTITES_KPI = [
  ["transactions", "Transaction"],
  ["cashflow", "Cashflow"],
  ["orders", "Order"],
  ["expenses", "Expense"],
  ["employees", "Employee"],
  ["payrolls", "Payroll"],
  ["customers", "Customer"],
  ["products", "Product"],
  // Campaign and CampaignDaily both roll up to the same canonicalKeys
  // (marketing_spend, campaign_revenue...) by design - pass only one to
  // avoid the entity filter picking whichever happens to be seen first
  // and silently ignoring the other's rows.
  ["campaignDaily", "CampaignDaily"],
  // Campagnes sans suivi journalier (un tableau recapitulatif par campagne) :
  // seulement quand AUCUN suivi journalier n'est fourni, pour la meme raison.
  ["campaigns", "Campaign"],
  // Valeur du stock (BFR) : dernier releve de chaque produit.
  ["inventory", "Inventory"],
];

/**
 * Aplatit les enregistrements des entites en un seul tableau, chaque ligne
 * etiquetee par son entite, et construit les semantiques par entite.
 *
 * Two entities can share a raw field name (Transaction.amount and
 * Expense.amount, Transaction.date and Cashflow.date...). The semantics key is
 * namespaced by entity so the second entity cannot overwrite the first; each
 * row is tagged with `_entity` so the engine only aggregates the rows of the
 * entity a field belongs to.
 *
 * `data.devises` = { base, taux } (Company.currency, Company.exchange_rates).
 */
export function buildKpiDataset(data) {
  const records = [];
  const semantics = new Map();
  for (const [cle, entite] of ENTITES_KPI) {
    let rows = data?.[cle];
    if (!rows || rows.length === 0) continue;
    // Ventes en plusieurs devises : converties (taux de l'entreprise) ou
    // exclues, jamais additionnees telles quelles.
    if (entite === "Order") rows = normaliserDevises(rows, data.devises).rows;
    if (entite === "Campaign" && data.campaignDaily?.length) continue;
    // Boucle, pas push(...tableau) : au-dela d'environ 100 000 lignes, l'etalement
    // depasse la taille de pile et le calcul de TOUS les KPI plantait.
    for (const r of rows) records.push({ ...r, _entity: entite });
    const sem = getEntitySemantics(entite);
    if (sem) sem.forEach((v, k) => semantics.set(`${entite}:${k}`, v));
  }
  return { records, semantics };
}
