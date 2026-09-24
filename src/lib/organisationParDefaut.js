// Structure organisationnelle d'une entreprise qui n'en a pas encore saisi.
//
// Seul endroit où elle est définie (Paramètres et OrganizationPanel l'importent).
// Elle est VIDE : les exemples (Grand Montréal, Succursale Laval…) s'affichaient
// comme les régions et succursales de l'entreprise et étaient enregistrés au
// premier « Enregistrer » (agent QA, 24 sept. 2026). Les exemples restent en
// texte d'aide (placeholder) dans OrganizationPanel, jamais en données.

export const NIVEAUX_PAR_DEFAUT = ["entreprise", "region", "succursale", "departement", "employe"];

/** Nouvelle structure vide (jamais partagée : chaque appel rend un objet neuf). */
export function organisationVide() {
  return { active_levels: [...NIVEAUX_PAR_DEFAUT], regions: [], branches: [], departments: [] };
}

/** Structure lue en base, complétée par la structure vide pour ce qui manque. */
export function structureOrganisation(brute) {
  const org = brute && typeof brute === "object" ? brute : {};
  const vide = organisationVide();
  return {
    ...org,
    active_levels: Array.isArray(org.active_levels) ? org.active_levels : vide.active_levels,
    regions: Array.isArray(org.regions) ? org.regions : vide.regions,
    branches: Array.isArray(org.branches) ? org.branches : vide.branches,
    departments: Array.isArray(org.departments) ? org.departments : vide.departments,
  };
}
