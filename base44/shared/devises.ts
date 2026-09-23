// Devise d'une ligne importee.
//
// Un fichier multi-pays (Sales_transactions : Etats-Unis, Royaume-Uni, Canada,
// Allemagne, France, Australie) additionnait des dollars US, des livres et des
// euros comme des dollars canadiens. On note donc la devise de chaque vente,
// lue dans une colonne devise, ou deduite du pays quand il n'y a qu'un pays
// par ligne. Rien n'est converti ici : la conversion depend des taux que
// l'entreprise fournit (Parametres), jamais d'un taux invente.

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

const PAYS: Record<string, string> = {
  canada: "CAD", "united states": "USD", usa: "USD", us: "USD", "etats unis": "USD", "etats-unis": "USD", america: "USD",
  "united kingdom": "GBP", uk: "GBP", "royaume uni": "GBP", "royaume-uni": "GBP", england: "GBP", "great britain": "GBP",
  france: "EUR", germany: "EUR", allemagne: "EUR", spain: "EUR", espagne: "EUR", italy: "EUR", italie: "EUR",
  belgium: "EUR", belgique: "EUR", netherlands: "EUR", "pays bas": "EUR", ireland: "EUR", irlande: "EUR",
  portugal: "EUR", austria: "EUR", autriche: "EUR", luxembourg: "EUR", finland: "EUR", finlande: "EUR",
  australia: "AUD", australie: "AUD", switzerland: "CHF", suisse: "CHF", japan: "JPY", japon: "JPY",
  mexico: "MXN", mexique: "MXN", "new zealand": "NZD", "nouvelle zelande": "NZD", india: "INR", inde: "INR",
  china: "CNY", chine: "CNY", brazil: "BRL", bresil: "BRL", morocco: "MAD", maroc: "MAD", senegal: "XOF",
  "cote d ivoire": "XOF", "burkina faso": "XOF", mali: "XOF", tunisia: "TND", tunisie: "TND", algeria: "DZD", algerie: "DZD",
};
const CODES = new Set(["CAD", "USD", "EUR", "GBP", "AUD", "CHF", "JPY", "MXN", "NZD", "INR", "CNY", "BRL", "MAD", "XOF", "TND", "DZD"]);

/** Code devise d'une valeur de colonne devise (« USD », « € », « euro ») ou null. */
export function codeDevise(v: any): string | null {
  const t = sansAccents(String(v ?? "")).trim().toUpperCase();
  if (!t) return null;
  if (CODES.has(t)) return t;
  if (t === "€" || /^EUROS?$/.test(t)) return "EUR";
  if (t === "£" || /^(LIVRES?|POUNDS?)( STERLING)?$/.test(t)) return "GBP";
  if (/^(DOLLARS? )?(CANADIENS?|CANADIAN)$/.test(t) || t === "CA$" || t === "C$") return "CAD";
  if (/^(DOLLARS? )?(US|AMERICAINS?|AMERICAN)$/.test(t) || t === "US$") return "USD";
  return null;
}

/** Devise d'un pays (« United States » -> USD), ou null. */
export function deviseDePays(v: any): string | null {
  const t = sansAccents(String(v ?? "")).toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  return PAYS[t] ?? null;
}

// Mots d'une colonne qui situe la VENTE (magasin, succursale...) et non le client.
const POINT_DE_VENTE = /(store|magasin|succursale|boutique|branch|agence|outlet|shop|point.?de.?vente|pos)/;
const PAYS_DU_CLIENT = /(client|customer|acheteur|buyer|livraison|shipping|ship|delivery|billing|facturation|destination)/;

/**
 * Devise d'une ligne brute du fichier : colonne devise d'abord, sinon le pays
 * du POINT DE VENTE. Le pays du client ne dit rien de la devise : un
 * detaillant britannique facture en livres ses clients francais ou japonais
 * (UCI Online Retail : 38 pays, un seul prix par article, en livres). Le pays
 * ne sert donc que si la ligne situe la vente (colonne magasin, succursale...)
 * ou si l'intitule le dit (« Pays du magasin »), jamais s'il designe le client
 * ou la livraison. Une colonne « ville » ou « region » ne suffit pas.
 */
export function deviseDeLigne(brut: Record<string, any> | null | undefined): string | null {
  if (!brut) return null;
  let parPays: string | null = null;
  let paysDeVente = false;
  let pointDeVente = false;
  for (const [k, v] of Object.entries(brut)) {
    const cle = sansAccents(String(k)).replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
    if (/(^|[^a-z])(devise|currency|monnaie)([^a-z]|$)/.test(cle)) {
      const c = codeDevise(v);
      if (c) return c;
    }
    const estPays = /(^|[^a-z])(pays|country)([^a-z]|$)/.test(cle);
    if (estPays && PAYS_DU_CLIENT.test(cle)) continue;
    if (estPays && !parPays) { parPays = deviseDePays(v); paysDeVente = POINT_DE_VENTE.test(cle); }
    else if (!estPays && POINT_DE_VENTE.test(cle) && v !== null && v !== undefined && String(v).trim() !== "") pointDeVente = true;
  }
  return parPays && (paysDeVente || pointDeVente) ? parPays : null;
}
