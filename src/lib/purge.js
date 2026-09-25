// « Tout supprimer » (page Importer).
//
// Constat du 24 sept. 2026 (base en ligne, lecture seule) : après une purge,
// 1 608 ventes et 6 100 observations restaient, orphelines d'un import déjà
// supprimé, et le message disait « Toutes les données ont été purgées ». Causes :
// une seule suppression par table sans vérification, une table oubliée
// (Payment), une erreur au milieu qui arrêtait tout, et un import encore en
// cours qui continuait d'écrire après la purge (voir importRows.ts :
// l'import s'arrête désormais si sa fiche a disparu).

/** Tables qui ne sont jamais purgées : le compte, la fiche entreprise, la facturation GESCOP. */
export const ENTITES_CONSERVEES = ["Company", "User", "Invoice", "Subscription"];

/**
 * Tables purgées, dans cet ordre. `Import` en premier : un import encore en
 * cours voit sa fiche disparaître et s'arrête avant son lot suivant.
 * tests/purge.test.js vérifie que chaque entité de base44/entities est ici ou
 * dans ENTITES_CONSERVEES : une nouvelle table ne peut plus être oubliée.
 */
export const ENTITES_PURGEES = [
  "Import", "ImportIssue",
  "Transaction", "Order", "Customer", "Product", "Inventory", "Supplier", "Purchase",
  "Campaign", "CampaignDaily", "Employee", "Payroll", "Expense", "Cashflow", "Asset", "Payment",
  "ExecutiveSummary", "Observation", "Interaction", "Competitor", "Goal", "Event",
  "Kpi", "Anomaly", "Risk", "Opportunity", "Recommendation", "Alert", "Task", "Decision",
  "ExternalSignal", "Report", "AnalysisRun",
];

const PASSES_MAX = 200;

async function reste(entite) {
  const l = typeof entite.filter === "function" ? await entite.filter({}, null, 1) : await entite.list(null, 1);
  return (l || []).length;
}

/**
 * Vide une table : supprimer, relire, recommencer tant qu'il en reste (le
 * serveur peut plafonner le nombre de lignes supprimées par appel).
 * @returns {Promise<{ supprimees: number, reste: boolean, erreur?: string }>}
 */
export async function viderTable(entite) {
  let supprimees = 0;
  try {
    for (let passe = 0; passe < PASSES_MAX; passe += 1) {
      const res = await entite.deleteMany({});
      const n = Number(res?.deleted) || 0;
      supprimees += n;
      if ((await reste(entite)) === 0) return { supprimees, reste: false };
      // Rien de supprimé à ce passage : recommencer n'y changera rien.
      if (n === 0) return { supprimees, reste: true };
    }
    return { supprimees, reste: (await reste(entite)) > 0 };
  } catch (e) {
    return { supprimees, reste: true, erreur: String(e?.message || e) };
  }
}

/**
 * Purge toutes les tables de données. Une table en erreur n'empêche pas les
 * suivantes. Le bilan dit exactement ce qui reste.
 * @param {Record<string, any>} entities  base44.entities
 * @param {{ company?: any, onTable?: (nom: string, i: number, n: number) => void }} [options]
 * @returns {Promise<{ complet: boolean, supprimees: number, restantes: string[], erreurs: Record<string, string>, entreprise?: string }>}
 */
export async function purgerTout(entities, options = {}) {
  const restantes = [];
  const erreurs = {};
  let supprimees = 0;
  for (let i = 0; i < ENTITES_PURGEES.length; i += 1) {
    const nom = ENTITES_PURGEES[i];
    options.onTable?.(nom, i, ENTITES_PURGEES.length);
    const r = await viderTable(entities[nom]);
    supprimees += r.supprimees;
    if (r.reste) restantes.push(nom);
    if (r.erreur) erreurs[nom] = r.erreur;
  }
  // Le score de santé n'est plus mesuré : null (« non mesuré »), jamais 0.
  let entreprise;
  if (options.company?.id) {
    try {
      await entities.Company.update(options.company.id, { health_score: null, dimension_scores: {}, last_analysis_date: null });
    } catch (e) {
      entreprise = String(e?.message || e);
    }
  }
  return { complet: restantes.length === 0, supprimees, restantes, erreurs, entreprise };
}
