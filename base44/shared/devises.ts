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

/**
 * Devise d'une ligne brute du fichier : colonne devise d'abord, sinon colonne
 * pays. Une colonne « ville » ou « region » ne suffit pas (Paris, Texas...).
 */
export function deviseDeLigne(brut: Record<string, any> | null | undefined): string | null {
  if (!brut) return null;
  let parPays: string | null = null;
  for (const [k, v] of Object.entries(brut)) {
    const cle = sansAccents(String(k)).toLowerCase();
    if (/(^|[^a-z])(devise|currency|monnaie)([^a-z]|$)/.test(cle)) {
      const c = codeDevise(v);
      if (c) return c;
    }
    if (!parPays && /(^|[^a-z])(pays|country)([^a-z]|$)/.test(cle)) parPays = deviseDePays(v);
  }
  return parPays;
}
