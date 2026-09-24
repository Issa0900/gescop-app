// Dictionnaire de l'entreprise (Company.company_dictionary) côté écran.
//
// Deux formes existent en base : { "Terme": "champ" } (écrite par
// l'apprentissage à l'import) et [{ term, maps_to, description }] (écrite par
// Paramètres). Le serveur lit les deux (buildCompanyDictionaryIndex).
// Lot 6 (24 sept. 2026) :
//  - plus aucun terme d'exemple n'est affiché ni enregistré comme s'il était
//    celui de l'entreprise (ils étaient ensuite imposés à chaque import) ;
//  - un terme ajouté dans Paramètres est écrit avec `maps_to` (il était écrit
//    avec `concept`, que l'import ne lisait pas : il n'était jamais appliqué) ;
//  - l'apprentissage à l'import complète le dictionnaire sans effacer une
//    forme liste existante.

/** Exemples d'aide à la saisie : jamais des données. */
export const EXEMPLES_DICTIONNAIRE = [
  { term: "Succursale", maps_to: "location_id" },
  { term: "Coût Total ($)", maps_to: "total_cost" },
  { term: "Date Transaction", maps_to: "date" },
];

/**
 * Les 5 termes que Paramètres enregistrait d'office avant le 24 sept. 2026.
 * Un dictionnaire qui les contient tous vient très probablement de là.
 */
export const EXEMPLES_ENREGISTRES_AVANT = [
  { term: "Succursale", maps_to: "location_id" },
  { term: "Coût Total ($)", maps_to: "total_cost" },
  { term: "Profit Brut ($)", maps_to: "gross_profit" },
  { term: "% Marge", maps_to: "gross_margin" },
  { term: "Date Transaction", maps_to: "date" },
];

/** Forme liste uniforme : [{ id, term, maps_to, description }]. */
export function lireDictionnaire(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item, idx) => ({
        id: item?.id || `dict_${idx}`,
        term: String(item?.term || item?.source || item?.key || ""),
        maps_to: String(item?.maps_to || item?.concept || item?.target || ""),
        description: String(item?.description || ""),
      }))
      .filter((x) => x.term || x.maps_to);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([term, val], idx) => ({
      id: `dict_${idx}`,
      term,
      maps_to: typeof val === "object" && val ? String(val.maps_to || val.concept || "") : String(val ?? ""),
      description: typeof val === "object" && val ? String(val.description || "") : "",
    }));
  }
  return [];
}

/** Ce qui est enregistré : la forme liste, avec `maps_to` que lit l'import. */
export function versEnregistrement(items) {
  return (items || [])
    .filter((x) => String(x?.term || "").trim() && String(x?.maps_to || "").trim())
    .map((x) => ({ term: String(x.term).trim(), maps_to: String(x.maps_to).trim(), description: String(x.description || "") }));
}

const cle = (t) => String(t || "").trim().toLowerCase();

/**
 * Ajoute des correspondances apprises ({ colonne: champ }) en gardant la forme
 * existante. Rend null si rien ne change.
 */
export function ajouterTermes(raw, appris) {
  const entrees = Object.entries(appris || {}).filter(([k, v]) => String(k).trim() && String(v || "").trim());
  if (entrees.length === 0) return null;
  if (Array.isArray(raw)) {
    const liste = lireDictionnaire(raw);
    let change = false;
    for (const [term, champ] of entrees) {
      const i = liste.findIndex((x) => cle(x.term) === cle(term));
      if (i >= 0 && liste[i].maps_to === champ) continue;
      change = true;
      if (i >= 0) liste[i] = { ...liste[i], maps_to: champ };
      else liste.push({ id: `dict_${liste.length}`, term, maps_to: champ, description: "Appris lors d'un import" });
    }
    return change ? versEnregistrement(liste) : null;
  }
  const actuel = raw && typeof raw === "object" ? raw : {};
  const nouveaux = Object.fromEntries(entrees.filter(([k, v]) => actuel[k] !== v));
  return Object.keys(nouveaux).length ? { ...actuel, ...nouveaux } : null;
}

/** Vrai si le dictionnaire contient les 5 exemples enregistrés d'office avant le lot 6. */
export function contientExemplesAvant(raw) {
  const items = lireDictionnaire(raw);
  return EXEMPLES_ENREGISTRES_AVANT.every((e) => items.some((x) => cle(x.term) === cle(e.term) && x.maps_to === e.maps_to));
}

/** Retire exactement ces 5 exemples (même terme ET même champ), rien d'autre. */
export function retirerExemplesAvant(raw) {
  const estExemple = (x) => EXEMPLES_ENREGISTRES_AVANT.some((e) => cle(x.term) === cle(e.term) && x.maps_to === e.maps_to);
  return versEnregistrement(lireDictionnaire(raw).filter((x) => !estExemple(x)));
}
