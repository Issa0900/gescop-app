// Suppression d'un import et de tout ce qu'il a produit.
//
// Sortie de Import.jsx pour pouvoir être testée (tests/supprimer_import.test.js).
// Deux défauts corrigés le 24 sept. 2026 (agent QA, lot 2) :
//  - les Observations de l'import restaient en base : le moteur KPI s'en sert
//    en repli, un chiffre d'affaires supprimé pouvait donc rester affiché ;
//  - TOUTES les alertes anomalie/risque/opportunité du compte étaient effacées,
//    y compris celles des autres imports. Une alerte d'analyse porte sur
//    l'ensemble des données, aucun champ ne la relie à un import
//    (Alert.link_id, quand il existe, désigne une anomalie ou un risque) :
//    aucune alerte n'est donc supprimée ici, l'utilisateur est invité à
//    relancer l'analyse.

export const MESSAGE_ALERTES = "Relancez l'analyse pour mettre les alertes à jour.";

/**
 * Supprime les lignes d'une entité rattachées à l'import, puis relit pour
 * vérifier : le serveur peut plafonner le nombre de lignes effacées par appel.
 * @returns {Promise<{ supprimes: number, restants: number }>}
 */
async function viderParImport(entite, importId) {
  let supprimes = 0;
  let restants = 0;
  for (let passe = 0; passe < 10; passe += 1) {
    const res = await entite.deleteMany({ import_id: importId });
    supprimes += Number(res?.deleted) || 0;
    const reste = await entite.filter({ import_id: importId }, null, 1);
    restants = (reste || []).length;
    if (restants === 0) break;
    // Aucun progrès à ce passage : recommencer n'y changera rien.
    if (!res?.deleted) break;
  }
  return { supprimes, restants };
}

/**
 * @param {Record<string, any>} entities  base44.entities
 * @param {{ id: string, entity_type?: string, status?: string }} imp
 * @returns {Promise<{ statut: "supprime" | "incomplet" | "type_invalide", entite?: string,
 *   supprimes: number, restants: number, observationsSupprimees: number, observationsRestantes: number }>}
 */
export async function supprimerImport(entities, imp) {
  const entityName = imp.entity_type;
  const vide = { supprimes: 0, restants: 0, observationsSupprimees: 0, observationsRestantes: 0 };

  // Feuille au type non reconnu : aucune donnée métier, seulement ses lignes
  // brutes dans le registre.
  if (!entityName && imp.status === "quarantaine") {
    await entities.ImportIssue.deleteMany({ import_id: imp.id });
    await entities.Import.delete(imp.id);
    return { statut: "supprime", ...vide };
  }
  if (!entityName || !entities[entityName]) return { statut: "type_invalide", entite: entityName, ...vide };

  const lignes = await viderParImport(entities[entityName], imp.id);
  const obs = await viderParImport(entities.Observation, imp.id);
  const bilan = {
    entite: entityName,
    supprimes: lignes.supprimes,
    restants: lignes.restants,
    observationsSupprimees: obs.supprimes,
    observationsRestantes: obs.restants,
  };
  // Il reste des lignes ou des observations : l'import est conservé pour
  // qu'elles restent atteignables et supprimables.
  if (lignes.restants > 0 || obs.restants > 0) return { statut: "incomplet", ...bilan };

  // Le registre des lignes écartées n'a plus de sens sans l'import.
  await entities.ImportIssue.deleteMany({ import_id: imp.id });
  await entities.Import.delete(imp.id);
  return { statut: "supprime", ...bilan };
}
