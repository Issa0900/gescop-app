// Lexique des champs par MOTS, et non par intitules exacts.
//
// L'audit du dossier DEMO (22 sept 2026) a montre que la reconnaissance par
// table de synonymes echoue sur chaque nouvelle variante d'un meme intitule :
// « Nom du fournisseur », « Raison_Sociale », « vendor_name », « Budget (CAD) »,
// « amount_ht_cad », « OrderID »... Ajouter un synonyme par fichier ne ferait
// que deplacer le probleme au fichier suivant. Ici un champ se reconnait a une
// COMBINAISON de mots, en francais et en anglais, quelle que soit la forme de
// l'intitule :
//   - « OrderID » / « order_id » / « Order Id » / « ID Commande » -> {order, id}
//   - unites et devises retirees : « Budget (CAD) », « budget_cad », « Budget $ »
//   - pluriels ramenes au singulier : « Nouveaux clients » -> {nouveau, client}
// Chaque regle est propre a une entite (« depense » est la depense d'une
// campagne sur Campaign, une charge sur Expense) et peut interdire des mots
// (« cout par clic » n'est pas une depense).
//
// Quand plusieurs colonnes d'une feuille visent le meme champ, la plus
// generale gagne (« total_cash_outflows » contre « cash_outflows_payroll ») ;
// les autres restent non rattachees, leur contenu demeure dans original_data.

import { getSchema, ENTITY_SCHEMAS } from "../entitySchemas.ts";
const ENTITY_SCHEMAS_POUR_LEXIQUE = () => ENTITY_SCHEMAS;

// Pas d'import de importUtils : il consulte ce lexique (normalizeKeys).
const stripAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

const MOTS_VIDES = new Set(["de", "du", "des", "la", "le", "les", "d", "l", "of", "the", "a", "en", "au", "aux", "et", "and", "on", "for", "pour"]);
const UNITES = new Set(["cad", "usd", "eur", "euro", "euros", "dollar", "dollars", "chf", "gbp", "j", "jr", "jrs"]);
// Mots terminés par « s » qui ne sont pas des pluriels.
const INVARIABLES = new Set(["status", "sous", "vers", "dans", "pays", "prix", "mois", "poids", "process", "business", "address", "ads", "gross", "plus", "fois", "cours", "hors", "taux", "roas", "sms", "bus"]);

const singulier = (m: string) => {
  const s = m.length > 3 && m.endsWith("s") && !INVARIABLES.has(m) ? m.slice(0, -1) : m;
  return s.length > 4 && s.endsWith("x") && /eaux$/.test(s) ? s.slice(0, -1) : s;
};

/** Mots d'un intitule : casse chameau decoupee, mots colles separes, accents et unites retires, singulier. */
export function motsDe(entete: string): string[] {
  const brut = String(entete ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return stripAccents(brut.toLowerCase())
    .split(/[^a-z0-9]+/)
    .flatMap(decoller)
    .filter((m) => m && !MOTS_VIDES.has(m) && !UNITES.has(m))
    .map(singulier);
}

// Mots colles sans separateur ni casse (« INVOICENO », « unitprice »,
// « CUSTOMERID », « codeclient ») : exports d'ERP en majuscules, colonnes
// renommees en minuscules. Decoupes en mots du VOCABULAIRE DU LEXIQUE lui-meme
// (tous les mots de ses regles et des noms de champs), jamais par une liste
// propre a un fichier. Un mot deja connu n'est jamais decoupe ; morceaux de
// 3 lettres au moins, sauf quelques abreviations sures (id, no, nb, ht, pu).
const COURTS_SURS = new Set(["id", "no", "nb", "ht", "pu"]);
let VOCABULAIRE: Set<string> | null = null;
function vocabulaire(): Set<string> {
  if (VOCABULAIRE) return VOCABULAIRE;
  const v = new Set<string>();
  GENEREES ||= reglesGenerees();
  for (const r of [...REGLES, ...GENEREES]) for (const g of r.groupes) for (const m of g) v.add(m);
  for (const sch of Object.values(ENTITY_SCHEMAS_POUR_LEXIQUE())) for (const f of Object.keys(sch.properties)) for (const m of f.split("_")) if (m.length >= 3) v.add(m);
  for (const m of [...v]) if (m.length < 3 && !COURTS_SURS.has(m)) v.delete(m);
  return (VOCABULAIRE = v);
}
function decoller(mot: string): string[] {
  if (mot.length < 5 || /\d/.test(mot)) return [mot];
  const v = vocabulaire();
  if (v.has(mot) || v.has(singulier(mot))) return [mot];
  // Decoupage en un minimum de mots connus (programmation dynamique).
  const n = mot.length;
  const meilleur: (string[] | null)[] = Array(n + 1).fill(null);
  meilleur[0] = [];
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - 20); j < i; j++) {
      if (!meilleur[j]) continue;
      const morceau = mot.slice(j, i);
      if (!(v.has(morceau) || v.has(singulier(morceau)))) continue;
      const essai = [...meilleur[j]!, morceau];
      if (!meilleur[i] || essai.length < meilleur[i]!.length) meilleur[i] = essai;
    }
  }
  return meilleur[n] && meilleur[n]!.length > 1 ? meilleur[n]! : [mot];
}

interface Regle {
  champ: string;
  entites: string[];
  /** Chaque groupe doit etre represente par au moins un mot de l'intitule. */
  groupes: string[][];
  /** Mots qui interdisent la regle. */
  sauf?: string[];
  /** Mots qu'une AUTRE colonne de la feuille doit porter pour que la regle s'applique. */
  siAutreColonne?: string[];
  /** Mots qu'AUCUNE autre colonne ne doit porter pour que la regle s'applique. */
  siAucuneAutreColonne?: string[];
}

const ID = ["id", "no", "num", "numero", "number", "code", "ref", "reference", "identifiant", "nr", "n"];
const DATE = ["date", "jour", "day"];
const MONTANT = ["montant", "amount", "valeur", "value", "somme", "sum"];
const COUT = ["cout", "cost", "couts", "costs", "frais"];
const TAXES_PRECISES = ["tps", "gst", "tvq", "qst", "tvh", "hst", "pst", "tvp", "federale", "federal", "provinciale", "provincial", "itc", "itr", "cti", "rti"];
const COMMANDE = ["commande", "order", "cde", "cmd", "facture", "invoice"];
const VENTE = ["vente", "sale", "revenue", "revenu", "ca", "chiffre"];

const R = (champ: string, entites: string[], groupes: string[][], sauf?: string[], siAutreColonne?: string[], siAucuneAutreColonne?: string[]): Regle => ({ champ, entites, groupes, sauf, siAutreColonne, siAucuneAutreColonne });

export const REGLES: Regle[] = [
  // ── Commandes / ventes ──────────────────────────────────────────────────
  R("order_id", ["Order", "Payment"], [COMMANDE, ID], ["ligne", "line", "client", "customer", "produit", "product", "paiement", "payment"]),
  R("line_id", ["Order"], [["ligne", "line", "row", "transaction"], ID], ["client", "customer", "produit", "product"], COMMANDE),
  // Sans colonne « commande », le numero de transaction / vente / ticket EST le numero de commande.
  R("order_id", ["Order"], [["transaction", "vente", "sale", "ticket", "recu", "receipt"], ID], ["ligne", "line", "client", "customer", "produit", "product"], undefined, COMMANDE),
  // Factures et mandats de services : « Invoice # », « Mandate No », « No facture »
  // (jeux generes, 25 sept. : la feuille de factures devenait des Clients).
  R("order_id", ["Order"], [["invoice", "facture", "mandat", "mandate", "engagement", "contrat", "contract"]], ["date", "client", "customer", "montant", "amount", "total", "statut", "status", "ligne", "line"]),
  R("total", ["Order"], [["honoraire", "fee", "billed", "invoiced"]], ["cout", "cost", "unitaire", "unit", "taxe", "tax", "date", "statut", "status"]),
  R("line_id", ["Order"], [["ligne", "line", "row"], ID], ["client", "customer", "produit", "product", "commande", "order"]),
  R("date", ["Order"], [COMMANDE, DATE]),
  // Horodatage d'achat (« order_purchase_timestamp ») : la date de la commande, jamais celle de livraison.
  R("date", ["Order"], [COMMANDE, ["timestamp", "datetime", "horodatage"]], ["livraison", "delivery", "delivered", "shipping", "expedition", "approved", "approbation", "estimated", "estime", "carrier"]),
  R("shipping", ["Order"], [["livraison", "shipping", "freight", "fret", "port", "transport"]], ["date", "statut", "status", "mode", "methode", "method", "id", "adresse", "address", "ville", "city", "delai", "delay"]),
  R("subtotal", ["Order"], [["ht", "subtotal", "hors", "soustotal", "net"]], ["prix", "price", "unitaire", "unit", "marge", "margin", "profit", "benefice", "ttc", "quantite", "quantity", "qte"]),
  R("subtotal", ["Order"], [["sous"], ["total"]], ["ttc"]),
  R("total", ["Order"], [["ttc", "tvac", "taxe_incluse", "gross"]], ["taxe", "tax", "tps", "tvq", "cout", "cost", "unitaire", "unit", "prix", "price"]),
  // Une personne (« Sales_Representative ») n'est jamais un montant : a egalite avec
  // « Sales_Amount », aucune des deux colonnes n'etait rattachee (25 sept. 2026).
  R("total", ["Order"], [VENTE, MONTANT], ["cout", "cost", "unitaire", "unit", "prix", "price", "canal", "channel", "representative", "representant", "vendeur", "agent"]),
  // « Sales » seul sur une ligne de vente : son montant.
  R("total", ["Order"], [["vente", "sale", "ventes"]], ["cout", "cost", "unitaire", "unit", "prix", "price", "canal", "channel", "date", "id", "rep", "representant", "representative", "representatives", "vendeur", "vendeuse", "agent", "associate", "manager", "person", "quantite", "quantity", "qty", "nombre", "count", "taxe", "tax", "region", "type", "statut", "status"]),
  R("total_cost", ["Order", "ExecutiveSummary"], [COUT, ["total", ...MONTANT, "marchandise", "produit", "product", "vendu", "sold"]], ["unitaire", "unit", "clic", "click"]),
  R("total_cost", ["Order"], [["cogs", "cmv", "cogs"]]),
  R("unit_cost", ["Order"], [COUT, ["unitaire", "unit", "moyen", "pondere", "pmp"]], ["total"]),
  R("unit_price", ["Order"], [["prix", "price", "pu", "tarif"], ["unitaire", "unit", "brut", "vente", "list"]], ["net", "cout", "cost", "achat", "total"]),
  R("discount", ["Order"], [["remise", "rabais", "discount", "escompte", "reduction"]], ["taux", "rate", "pct", "percent", "percentage", "pourcentage"]),
  R("gross_profit", ["Order", "ExecutiveSummary"], [["profit", "benefice", "gain"]], ["pct", "percent", "pourcentage", "taux", "rate", "marge", "margin"]),
  R("gross_margin", ["Order", "ExecutiveSummary"], [["marge", "margin"]], ["montant", "amount"]),
  R("tax_federal", ["Order"], [["tps", "gst", "federale", "federal"]], ["itc", "cti"]),
  R("tax_provincial", ["Order"], [["tvq", "qst", "tvh", "hst", "pst", "tvp", "provinciale"]], ["itr", "rti"]),
  R("tax", ["Order"], [["taxe", "tax", "tva", "vat"]], TAXES_PRECISES),
  R("status", ["Order"], [["statut", "status", "etat", "state"]], ["paiement", "payment", "livraison", "delivery", "shipping", "retour", "return", "compte", "account", "syndical"]),
  R("return_status", ["Order"], [["retour", "return", "returned", "retourne"]], ["raison", "reason", "motif", "date"]),
  R("employee_id", ["Order"], [["vendeur", "rep", "representant", "seller", "salesperson", "employe", "employee", "agent", "conseiller"], ID]),
  R("province", ["Order", "Customer"], [["province", "state"]], ["id", "code"]),
  R("channel", ["Order"], [["canal", "channel", "circuit"]]),
  R("currency", ["Order"], [["devise", "currency", "monnaie"]], ["taux", "rate"]),
  R("location_id", ["Order", "ExecutiveSummary"], [["succursale", "magasin", "store", "boutique", "agence", "branch", "location", "site", "point"]], ["id", "code", "no", "num", "vente", "sale"]),
  R("total_revenue", ["ExecutiveSummary"], [VENTE, ["total", "totale", ...MONTANT, "brut", "net"]], ["cout", "cost"]),
  R("total_orders", ["ExecutiveSummary"], [["commande", "order", "transaction", "vente"], ["nombre", "nb", "count", "total"]], ["montant", "amount"]),
  R("customer_id", ["Order", "Payment", "Transaction"], [["client", "customer", "acheteur", "buyer"], ID]),
  R("product_id", ["Order", "Inventory", "Purchase"], [["produit", "product", "article", "item", "sku"], ID]),
  // Sur une ligne de vente ou d'achat, le code de stock, de piece ou de modele
  // designe l'article vendu (« StockCode », « Part Number », « Code modele ») ;
  // les codes normalises (SKU, EAN, UPC, GTIN, ASIN...) aussi, seuls.
  R("product_id", ["Order", "Purchase"], [["stock", "part", "piece", "modele", "model", "style", "catalogue", "catalog"], ID], ["quantite", "quantity", "qty", "qte", "niveau", "level", "disponible", "reserve", "client", "customer", "fournisseur", "supplier"]),
  R("product_id", ["Order", "Inventory", "Purchase"], [["sku", "ugs", "ean", "upc", "gtin", "asin", "isbn", "barcode", "codebarre", "mpn"]], ["quantite", "quantity", "qty", "qte"]),
  // Pays de la vente ou du client (« Country », « Pays », « Pays_client »).
  R("country", ["Order", "Customer"], [["pays", "country", "nation"]], ["code", "id", "devise", "currency", "origine", "origin"]),
  R("quantity", ["Order", "Purchase"], [["quantite", "quantity", "qty", "qte", "unite"]], ["stock", "reserve", "transit", "disponible"]),

  // ── Produits ────────────────────────────────────────────────────────────
  R("purchase_cost", ["Product"], [COUT, ["achat", "purchase", "revient", "unitaire", "unit", "fournisseur"]], ["total"]),
  R("selling_price", ["Product"], [["prix", "price", "tarif"], ["vente", "sale", "selling", "public", "detail", "retail"]]),
  // Le prix unitaire d'une fiche produit est son prix de vente (le cout d'achat porte « cout »/« achat »).
  R("selling_price", ["Product"], [["prix", "price", "tarif", "pu"], ["unitaire", "unit"]], ["cout", "cost", "achat", "purchase", "fournisseur", "supplier"]),
  R("gross_margin", ["Product"], [["marge", "margin"]]),
  R("launch_date", ["Product"], [["lancement", "launch", "sortie", "creation"]]),
  R("subcategory", ["Product"], [["sous", "sub"], ["categorie", "category", "famille"]]),
  R("subcategory", ["Product"], [["souscategorie", "subcategory", "subcategorie"]]),
  R("monthly_sales", ["Product"], [["vente", "sale"], ["mensuel", "mensuelle", "monthly", "mois", "month"]]),
  R("inventory_level", ["Product"], [["niveau", "level", "quantite", "qte", "qty"], ["stock", "inventaire", "inventory"]]),
  R("reorder_point", ["Product"], [["seuil", "reorder", "point", "alerte"], ["reappro", "reapprovisionnement", "commande", "reorder", "alerte", "point", "minimum"]], ["quantite", "quantity", "optimale", "eoq"]),

  // ── Clients ─────────────────────────────────────────────────────────────
  R("loyalty_points", ["Customer"], [["point"], ["fidelite", "loyalty", "reward"]]),
  R("loyalty_points", ["Customer"], [["fidelite", "loyalty"]]),
  R("credit_limit", ["Customer"], [["limite", "limit", "plafond"], ["credit"]]),
  R("first_purchase_date", ["Customer"], [["premier", "1er", "first"], ["achat", "purchase", "commande", "order"]]),
  R("last_purchase_date", ["Customer"], [["dernier", "last", "recent"], ["achat", "purchase", "commande", "order"]]),
  R("total_orders", ["Customer"], [["commande", "order", "achat"], ["total", "totale", "nombre", "nb", "count"]]),
  R("churn_risk", ["Customer"], [["risque", "risk"], ["depart", "churn", "attrition", "perte"]]),
  R("segment", ["Customer"], [["segment", "segmentation", "typologie", "tier"]]),
  R("acquisition_date", ["Customer"], [["acquisition", "inscription", "signup", "creation", "entree"]]),
  R("name", ["Customer"], [["nom", "name", "raison"], ["complet", "full", "client", "customer", "sociale"]]),
  R("last_name", ["Customer", "Employee"], [["nom", "name"], ["famille", "family", "last"]]),
  R("first_name", ["Customer", "Employee"], [["prenom", "first", "given"]]),
  R("total_revenue", ["Customer"], [[...VENTE, "achat", "purchase", "depense", "spent"], ["total", "totale", "cumul", "cumule"]], ["nombre", "nb", "count"]),
  R("average_order_value", ["Customer"], [["panier", "basket", "average", "moyen"], ["moyen", "average", "order", "commande", "value", "valeur"]]),
  R("lifetime_value", ["Customer"], [["ltv", "clv"]]),
  R("lifetime_value", ["Customer"], [["valeur", "value"], ["vie", "life", "lifetime"]]),

  // ── Employes et paie ────────────────────────────────────────────────────
  R("hire_date", ["Employee"], [["embauche", "hire", "hiring", "entree", "arrivee", "start"]]),
  R("weekly_hours", ["Employee"], [["heure", "hour", "hr"], ["hebdo", "hebdomadaire", "semaine", "weekly", "week"]]),
  R("total_employer_cost", ["Employee"], [COUT, ["employeur", "employer", "global", "complet", "total"]], ["charge", "cotisation"]),
  R("total_social_charges", ["Employee"], [["charge", "cotisation", "contribution"], ["sociale", "social", "patronale", "employeur", "employer", "total"]]),
  R("annual_salary", ["Employee"], [["salaire", "salary", "remuneration", "paie"], ["annuel", "annual", "base", "brut", "yearly"]]),
  R("annual_salary", ["Employee"], [["salaire", "salary"]], ["taux", "rate", "horaire", "hourly", "net", "mensuel", "monthly"]),
  R("hourly_rate", ["Employee"], [["taux", "rate", "salaire"], ["horaire", "hourly", "heure"]]),
  R("union_status", ["Employee"], [["syndical", "syndique", "union", "syndicat"]]),
  R("role", ["Employee"], [["role", "poste", "fonction", "title", "job", "titre"]]),
  // Succursale : meme champ que la table d'alias (branch) ; sinon l'import avec IA
  // et l'import sans IA rangeaient la meme colonne dans deux champs (jeux generes).
  R("branch", ["Employee"], [["succursale", "magasin", "boutique", "store", "agence", "branch"]]),
  R("location", ["Employee"], [["emplacement", "location", "site", "lieu", "work"]]),
  R("last_name", ["Employee"], [["nom"], ["famille", "family"]]),
  R("period", ["Payroll"], [["periode", "period", "mois", "month"]]),
  R("period", ["Payroll"], [DATE, ["paie", "pay", "paye", "versement", "payment"]]),
  R("regular_pay", ["Payroll"], [["salaire", "salary", "paie", "pay", "remuneration"], ["brut", "gross", "regulier", "regular", "base"]]),
  R("employer_cost", ["Payroll"], [["cotisation", "contribution", "charge"], ["employeur", "employer", "patronale", "total"]]),
  R("total_cost", ["Payroll"], [COUT, ["total", "employeur", "employer"]], ["cotisation", "contribution"]),
  R("overtime", ["Payroll"], [["supplementaire", "overtime", "sup"]]),
  // Retenues, net et date de versement : perdus avant (rapport du 25 sept.).
  R("deductions", ["Payroll"], [["deduction", "deductions", "retenue", "retenues", "withholding", "withholdings"]]),
  R("net_pay", ["Payroll"], [["salaire", "salary", "paie", "pay", "remuneration"], ["net", "nette"]]),
  R("payment_date", ["Payroll"], [DATE, ["paiement", "versement", "payment", "paye", "virement"]]),

  // ── Fournisseurs et achats ──────────────────────────────────────────────
  R("supplier_name", ["Supplier"], [["nom", "name", "raison"], ["fournisseur", "supplier", "vendor", "sociale", "prestataire"]]),
  R("supplier_name", ["Supplier"], [["raison"], ["sociale"]]),
  // Concurrents et evenements du rapport du 25 sept. : « nom_concurrent »,
  // « zone », « positionnement », « type » n'avaient aucun champ.
  R("name", ["Competitor"], [["nom", "name", "raison", "libelle"]], ID),
  R("location", ["Competitor"], [["zone", "ville", "city", "region", "localisation", "location", "territoire"]]),
  R("market_position", ["Competitor"], [["positionnement", "positioning"]], ["prix", "price"]),
  R("event_type", ["Event"], [["type", "categorie", "category", "nature"]], ["impact"]),
  R("payment_terms", ["Supplier", "Purchase"], [["condition", "modalite", "terme", "term"], ["paiement", "payment", "reglement"]]),
  R("average_delivery_days", ["Supplier"], [["delai", "lead", "delivery", "livraison"], ["livraison", "delivery", "time", "jour", "day", "moyen", "average"]], ["statut", "status"]),
  R("reliability_score", ["Supplier"], [["fiabilite", "reliability"]]),
  R("quality_score", ["Supplier"], [["qualite", "quality"]]),
  R("esg_score", ["Supplier"], [["esg", "rse", "csr"]]),
  R("purchase_volume", ["Supplier"], [["volume"], ["achat", "purchase"]]),
  R("contact_name", ["Supplier"], [["contact"]], ["email", "courriel", "mail", "telephone", "phone"]),
  R("email", ["Supplier"], [["email", "courriel", "mail"]]),
  R("city", ["Supplier"], [["ville", "city"]]),
  R("purchase_currency", ["Supplier"], [["devise", "currency", "monnaie"]]),
  R("price_change_last_12_months", ["Supplier"], [["evolution", "variation", "change"], ["prix", "price"]]),
  R("purchase_id", ["Purchase"], [["achat", "purchase", "bon", "po"], ID], ["fournisseur", "supplier", "produit", "product"]),
  R("date", ["Purchase"], [DATE, ["achat", "purchase", "commande", "order"]]),
  R("expected_delivery", ["Purchase"], [["livraison", "delivery", "reception"], ["prevue", "prevu", "expected", "planned", "attendue", "prevision"]]),
  R("actual_delivery", ["Purchase"], [["livraison", "delivery", "reception"], ["reelle", "reel", "actual", "effective"]]),
  R("delay_days", ["Purchase"], [["retard", "delay", "late"]]),
  R("unit_cost", ["Purchase"], [COUT, ["unitaire", "unit"]]),
  R("total_cost", ["Purchase"], [["subtotal", "soustotal", "ht"]], ["tps", "tvq", "itc", "itr", "unitaire", "unit"]),
  R("total_cost", ["Purchase"], [["sous"], ["total"]]),
  R("total_cost", ["Purchase"], [COUT, ["total", ...MONTANT]], ["unitaire", "unit", "ttc", ...TAXES_PRECISES]),
  R("status", ["Purchase"], [["statut", "status", "etat"]], ["paiement", "payment"]),
  R("supplier_id", ["Purchase", "Inventory", "Product"], [["fournisseur", "supplier", "vendor"], ID]),
  // Un achat n'a qu'un champ fournisseur : une colonne « Fournisseur » seule le
  // designe (achats.csv jugee incomplete, jeux generes du 25 sept.).
  R("supplier_id", ["Purchase"], [["fournisseur", "supplier", "vendor"]], ["contact", "email", "courriel", "telephone", "phone", "ville", "city", "delai", "condition", "pays", "country"]),

  // ── Stocks ──────────────────────────────────────────────────────────────
  R("warehouse_id", ["Inventory"], [["entrepot", "depot", "warehouse", "site"], ID]),
  R("warehouse_name", ["Inventory"], [["entrepot", "depot", "warehouse"], ["nom", "name", "libelle"]]),
  // Une colonne « succursale » a partout un champ ou atterrir : sinon elle
  // restait dans original_data, invisible aux calculs (rapport, lot 1.3).
  R("warehouse_name", ["Inventory"], [["succursale", "magasin", "boutique", "store", "site", "emplacement", "branch", "entrepot", "depot", "warehouse"]], ID),
  R("branch", ["Transaction"], [["succursale", "magasin", "boutique", "store", "agence", "branch", "site", "emplacement", "location"]], ID),
  R("location_id", ["Asset"], [["succursale", "magasin", "boutique", "store", "agence", "branch", "site", "emplacement", "location", "lieu"]], ID),
  R("reserved_qty", ["Inventory"], [["reserve", "reservee", "reserved", "allocated"]]),
  R("in_transit_qty", ["Inventory"], [["transit"]]),
  R("quantity_available", ["Inventory"], [["disponible", "available", "dispo"]]),
  R("reorder_point", ["Inventory"], [["seuil", "reorder", "point", "alerte"], ["reappro", "reapprovisionnement", "commande", "reorder", "alerte", "point", "minimum"]], ["quantite", "quantity", "optimale", "eoq"]),
  R("sale_value", ["Inventory"], [["valeur", "value"], ["vente", "sale", "retail", "selling"]]),
  R("inventory_value", ["Inventory"], [["valeur", "value"], ["stock", "inventaire", "inventory", "cout", "cost"]], ["vente", "sale", "retail", "selling", "unitaire", "unit"]),
  R("closing_stock", ["Inventory"], [["quantite", "qty", "quantity", "qte", "niveau", "level"], ["stock", "hand", "main", "inventaire", "inventory", "physique"]], ["reserve", "transit", "disponible", "available", "reappro", "optimale", "seuil"]),
  R("unit_cost", ["Inventory"], [COUT, ["unitaire", "unit", "moyen", "pondere", "pmp", "average"]]),
  R("selling_price", ["Inventory"], [["prix", "price"], ["vente", "sale", "selling", "retail"]]),
  R("date", ["Inventory"], [["audit", "inventaire", "releve", "comptage", "count"], DATE]),

  // ── Tresorerie ──────────────────────────────────────────────────────────
  R("cash_in", ["Cashflow"], [["entree", "encaissement", "inflow", "recette", "in"]], ["solde", "balance"]),
  R("cash_out", ["Cashflow"], [["sortie", "decaissement", "outflow", "out"]], ["solde", "balance"]),
  R("opening_cash", ["Cashflow"], [["ouverture", "opening", "initial", "debut", "open"], ["solde", "cash", "tresorerie", "balance", "bank", "banque"]]),
  R("closing_cash", ["Cashflow"], [["cloture", "closing", "final", "fin", "close", "fermeture"], ["solde", "cash", "tresorerie", "balance", "bank", "banque"]]),
  R("net_cash_flow", ["Cashflow"], [["net"], ["flux", "flow", "cash", "tresorerie"]]),
  R("accounts_receivable", ["Cashflow"], [["creance", "receivable", "compte", "account"], ["client", "customer", "receivable"]]),
  R("accounts_payable", ["Cashflow"], [["dette", "payable", "compte", "account"], ["fournisseur", "supplier", "vendor", "payable"]]),
  R("date", ["Cashflow", "ExecutiveSummary", "CampaignDaily"], [["periode", "period", "mois", "month", "semaine", "week"]], ["id"]),

  // ── Depenses et transactions ────────────────────────────────────────────
  R("date", ["Expense"], [DATE, ["depense", "expense", "facture", "invoice", "achat"]]),
  R("amount", ["Expense"], [[...MONTANT, "cout", "cost", "depense"]], ["ttc", ...TAXES_PRECISES, "unitaire", "unit"]),
  R("supplier", ["Expense"], [["fournisseur", "vendor", "supplier", "prestataire", "beneficiaire", "payee"]], ID),
  R("recurring", ["Expense"], [["recurrent", "recurrente", "recurring", "recurrence", "mensuel"]]),
  R("date", ["Transaction"], [DATE, ["transaction", "operation", "mouvement", "ecriture"]]),
  R("type", ["Transaction"], [["type", "sens", "nature"]], ["paiement", "payment"]),
  R("reference_order_id", ["Transaction"], [COMMANDE], ["montant", "amount", "date"]),
  R("amount", ["Transaction"], [MONTANT], ["net", ...TAXES_PRECISES]),

  // ── Marketing ───────────────────────────────────────────────────────────
  R("spend", ["Campaign", "CampaignDaily"], [["depense", "spend", "cout", "cost", "frais", "investissement"]], ["clic", "click", "cpc", "par", "per", "acquisition", "cac", "mille", "cpm", "unitaire"]),
  R("budget", ["Campaign"], [["budget", "allocation", "alloue", "allocated"]], ["depense", "spent", "spend"]),
  R("start_date", ["Campaign"], [["debut", "start", "begin", "lancement"]]),
  R("end_date", ["Campaign"], [["fin", "end", "cloture"]]),
  R("new_customers", ["Campaign"], [["nouveau", "new"], ["client", "customer", "acquisition"]]),
  R("status", ["Campaign"], [["statut", "status", "etat"]]),
  R("conversions", ["Campaign", "CampaignDaily"], [["conversion", "lead", "vente", "sale"]], ["taux", "rate", "revenu", "revenue", "montant", "amount", "valeur"]),
  R("clicks", ["Campaign", "CampaignDaily"], [["clic", "click"]], ["cout", "cost", "par", "per", "cpc", "taux", "rate"]),
  R("revenue", ["Campaign", "CampaignDaily"], [["revenu", "revenue", "ca", "chiffre", "vente"]], ["taux", "rate", "par", "per"]),
  R("campaign_id", ["CampaignDaily"], [["campagne", "campaign"], ID]),
  R("date", ["CampaignDaily"], [DATE, ["record", "releve", "jour", "day", "semaine", "week"]]),
  R("cpc", ["CampaignDaily"], [["cpc"]]),
  R("cpc", ["CampaignDaily"], [COUT, ["clic", "click"]]),

  // ── Immobilisations ─────────────────────────────────────────────────────
  R("asset_id", ["Asset"], [["immobilisation", "asset", "actif", "equipement"], ID]),
  R("description", ["Asset"], [["description", "nom", "name", "libelle", "designation"]], ID),
  R("acquisition_date", ["Asset"], [["acquisition", "achat", "mise", "purchase"], DATE]),
  R("dpa_class", ["Asset"], [["classe", "class", "cca", "dpa"]], ["taux", "rate"]),
  R("dpa_rate", ["Asset"], [["taux", "rate"]]),
  R("initial_cost", ["Asset"], [COUT, ["acquisition", "initial", "origine", "achat", "historique"]]),
  R("accumulated_depreciation", ["Asset"], [["amortissement", "depreciation", "amortization"]], ["taux", "rate"]),
  R("net_book_value", ["Asset"], [["valeur", "value"], ["nette", "net", "comptable", "book"]]),
  R("historical_comment", ["Asset"], [["commentaire", "comment", "note", "remarque", "observation"]]),
  // « valeur_acquisition » / « prix d'achat » : sans ce second libelle, le cout
  // d'une immobilisation n'etait jamais lu (rapport du 25 sept. 2026).
  R("initial_cost", ["Asset"], [["valeur", "value", "prix", "price", "montant"], ["acquisition", "achat", "initial", "initiale", "origine", "historique", "purchase"]]),
  R("category", ["Asset"], [["categorie", "category", "nature", "famille"]], ["dpa", "cca", "fiscale"]),
  R("useful_life_years", ["Asset"], [["duree", "life", "vie"]], ["restante", "remaining"]),
  R("residual_value", ["Asset"], [["residuelle", "residual", "recuperation", "salvage"]]),
  R("depreciation_method", ["Asset"], [["methode", "method", "mode"], ["amortissement", "depreciation", "amortization"]]),

  // ── Paiements ───────────────────────────────────────────────────────────
  R("payment_id", ["Payment"], [["paiement", "payment", "reglement", "encaissement"], ID]),
  R("date", ["Payment"], [DATE]),
  R("status", ["Payment"], [["statut", "status", "etat"]]),
  R("amount", ["Payment"], [MONTANT]),
  R("method", ["Payment"], [["mode", "methode", "method", "moyen"]]),

  // ── Modules sans lexique jusqu'ici (jeux generes, 25 sept. 2026) ─────────
  // Veille : « Titre », « Famille », « Impact » laissaient title et family
  // (obligatoires) absents : toutes les lignes etaient ecartees.
  R("title", ["ExternalSignal"], [["titre", "title", "signal", "headline", "intitule", "sujet", "nom", "name"]], ["date", "source", "url", "lien", "link"]),
  R("family", ["ExternalSignal"], [["famille", "family", "categorie", "category", "theme", "domaine", "domain", "type"]]),
  R("impact", ["ExternalSignal"], [["impact", "effet", "effect"]]),
  R("description", ["ExternalSignal", "Event"], [["description", "detail", "details", "resume", "summary"]]),
  R("relevance_score", ["ExternalSignal"], [["pertinence", "relevance"]]),
  R("source", ["ExternalSignal"], [["source", "origine"]]),
  R("url", ["ExternalSignal"], [["url", "lien", "link"]]),
  // Objectifs : « Indicateur », « Cible », « Domaine » (metric est obligatoire).
  R("metric", ["Goal"], [["indicateur", "metric", "kpi", "indicator", "mesure", "measure", "objectif", "goal"]], ID),
  R("goal_id", ["Goal"], [["objectif", "goal"], ID]),
  R("goal_id", ["Goal"], [["id", "no", "num", "numero", "code", "ref"]], ["indicateur", "metric", "kpi", "cible", "target"]),
  R("target", ["Goal"], [["cible", "target", "visee"]]),
  R("current", ["Goal"], [["actuel", "actuelle", "current", "realise", "reel", "actual"]]),
  R("domain", ["Goal"], [["domaine", "domain", "axe", "area"]]),
  R("priority", ["Goal"], [["priorite", "priority"]]),
  R("period", ["Goal"], [["periode", "period", "horizon", "echeance"]]),
  R("status", ["Goal"], [["statut", "status", "etat"]]),
  // Interactions : tickets de support, avis, points de contact.
  R("interaction_id", ["Interaction"], [["interaction", "ticket", "avis", "review", "contact", "touchpoint", "echange", "appel", "call"], ID]),
  // « Opened », « Ouvert le », « Créé le » : date d'un ticket ou d'un evenement.
  R("date", ["Interaction", "Event"], [["opened", "ouvert", "ouverture", "created", "cree", "creation", "submitted", "soumis", "reported", "signale", "posted", "publie"]], ["ferme", "closed", "fermeture", "resolution", "resolu", "resolved"]),
  R("channel", ["Interaction"], [["canal", "channel", "via"]]),
  R("sentiment", ["Interaction"], [["sentiment", "tonalite", "tone", "humeur"]]),
  R("type", ["Interaction"], [["type", "nature", "motif"]]),
  R("subject", ["Interaction"], [["sujet", "subject", "objet", "topic"]]),
  R("satisfaction_score", ["Interaction"], [["satisfaction", "csat", "note", "rating", "star", "etoile"]]),
  R("resolved", ["Interaction"], [["resolu", "resolue", "resolved", "ferme", "closed"]]),
  // Produits : la famille ou le rayon est la categorie.
  R("category", ["Product"], [["categorie", "category", "famille", "family", "rayon", "department", "departement", "gamme"]], ["sous", "sub"]),
  R("product_name", ["Product"], [["designation", "libelle", "nom", "name", "produit", "product", "article", "item"]], ID),
];

// Libelle d'une ligne (« Designation », « Libelle », « Memo ») : sa description,
// sur toute entite qui en a une. Sans elle, une transaction « Vente ORD-12 »
// n'etait plus rapprochee de sa commande et le CA etait compte deux fois.
for (const [ent, sch] of Object.entries(ENTITY_SCHEMAS_POUR_LEXIQUE())) {
  if (sch.properties.description) REGLES.push(R("description", [ent], [["description", "designation", "libelle", "intitule", "memo", "narration", "detail"]], ["produit", "product", "article", "item", "date", "id", "code", "montant", "amount"]));
}

// ── Regles generees : identifiants et noms de TOUTES les entites ───────────
// Un champ « xxx_id » se reconnait partout a {nom de xxx} + {id, code, no...},
// un champ « xxx_name » a {nom, name, libelle...} + {nom de xxx}. Ecrire ces
// regles a la main pour chaque entite en oubliait (« ID customer » n'etait
// reconnu que dans une feuille de ventes, pas dans la feuille Clients).
const NOMS_OBJETS: Record<string, string[]> = {
  customer: ["client", "customer", "acheteur", "buyer", "consommateur", "abonne"],
  supplier: ["fournisseur", "supplier", "vendor", "prestataire"],
  campaign: ["campagne", "campaign"],
  employee: ["employe", "employee", "salarie", "staff", "collaborateur", "matricule"],
  product: ["produit", "product", "article", "item", "sku", "ugs"],
  order: COMMANDE,
  expense: ["depense", "expense", "charge"],
  inventory: ["inventaire", "inventory", "stock"],
  interaction: ["interaction", "ticket", "contact"],
  competitor: ["concurrent", "competitor"],
  goal: ["objectif", "goal", "cible"],
  event: ["evenement", "event"],
  payroll: ["paie", "payroll", "bulletin"],
  purchase: ["achat", "purchase", "po"],
  asset: ["immobilisation", "asset", "actif"],
  payment: ["paiement", "payment", "reglement", "encaissement"],
  summary: ["sommaire", "synthese", "summary"],
  warehouse: ["entrepot", "depot", "warehouse"],
};
const NOMS_LIBELLE = ["nom", "name", "libelle", "designation", "intitule", "titre", "raison"];
function reglesGenerees(): Regle[] {
  const out: Regle[] = [];
  const champs = new Map<string, Set<string>>();
  for (const [ent, sch] of Object.entries(ENTITY_SCHEMAS_POUR_LEXIQUE())) {
    for (const f of Object.keys(sch.properties)) champs.set(f, (champs.get(f) || new Set()).add(ent));
  }
  for (const [f, entites] of champs) {
    const m = /^(.+)_(id|name)$/.exec(f);
    if (!m || !NOMS_OBJETS[m[1]]) continue;
    const autres = Object.entries(NOMS_OBJETS).filter(([k]) => k !== m[1]).flatMap(([, v]) => v).filter((x) => !NOMS_OBJETS[m[1]].includes(x));
    if (m[2] === "id") out.push(R(f, [...entites], [NOMS_OBJETS[m[1]], ID], [...NOMS_LIBELLE, "date", "montant", "amount"]));
    else out.push(R(f, [...entites], [NOMS_LIBELLE, NOMS_OBJETS[m[1]]], [...ID.filter((x) => x !== "n"), ...autres]));
  }
  // Un « nom » seul designe le nom de l'objet de la feuille (« name » sur Produits
  // = product_name), quand l'entite n'a pas elle-meme de champ « name ».
  for (const [ent, sch] of Object.entries(ENTITY_SCHEMAS_POUR_LEXIQUE())) {
    const cle = ent.replace(/[A-Z]/g, (c, i) => (i ? "_" : "") + c.toLowerCase());
    const champ = `${cle}_name`;
    if (!sch.properties[champ] || sch.properties.name || !NOMS_OBJETS[cle]) continue;
    const autres = Object.entries(NOMS_OBJETS).filter(([k]) => k !== cle).flatMap(([, v]) => v);
    out.push(R(champ, [ent], [NOMS_LIBELLE], [...ID.filter((x) => x !== "n"), ...autres, "date"]));
  }
  return out;
}
let GENEREES: Regle[] | null = null;

function correspond(regle: Regle, mots: string[], autres: string[][]): number {
  const set = new Set(mots);
  if (regle.sauf?.some((m) => set.has(m))) return 0;
  if (!regle.groupes.every((g) => g.some((m) => set.has(m)))) return 0;
  if (regle.siAutreColonne && !autres.some((a) => regle.siAutreColonne!.some((m) => a.includes(m)))) return 0;
  if (regle.siAucuneAutreColonne && autres.some((a) => regle.siAucuneAutreColonne!.some((m) => a.includes(m)))) return 0;
  // Specificite : nombre de groupes, puis part de l'intitule expliquee.
  const expliques = mots.filter((m) => regle.groupes.some((g) => g.includes(m))).length;
  return regle.groupes.length * 10 + expliques;
}

/** Champ qu'un intitule designe pour une entite, d'apres le lexique (ou null). */
export function champParLexique(entite: string, entete: string, autresEntetes: string[] = []): string | null {
  const schema = getSchema(entite);
  if (!schema) return null;
  const mots = motsDe(entete);
  if (mots.length === 0) return null;
  const autres = autresEntetes.filter((e) => e !== entete).map(motsDe);
  let meilleur: string | null = null, score = 0, egalite = false;
  GENEREES ||= reglesGenerees();
  for (const r of [...REGLES, ...GENEREES]) {
    // `name` n'est pas un champ des entites qui stockent prenom et nom, mais
    // l'import sait le repartir (normalizeRow) : c'est un rattachement valide.
    const existe = schema.properties[r.champ] || (r.champ === "name" && schema.properties.first_name);
    if (!r.entites.includes(entite) || !existe) continue;
    const s = correspond(r, mots, autres);
    if (s === 0) continue;
    if (s > score) { meilleur = r.champ; score = s; egalite = false; }
    else if (s === score && r.champ !== meilleur) egalite = true;
  }
  return egalite ? null : meilleur;
}

/**
 * Rattachement par lexique de toutes les colonnes d'une feuille. Quand
 * plusieurs colonnes visent le meme champ, la plus generale l'emporte : celle
 * qui porte « total », sinon celle dont l'intitule a le moins de mots en plus.
 * Une egalite parfaite ne tranche pas (aucune des deux n'est rattachee).
 */
export function rattacherParLexique(entite: string, entetes: string[], dejaPris: Set<string> = new Set()): Map<string, string> {
  const candidats = new Map<string, string[]>();
  for (const e of entetes) {
    const champ = champParLexique(entite, e, entetes);
    if (!champ || dejaPris.has(champ)) continue;
    candidats.set(champ, [...(candidats.get(champ) || []), e]);
  }
  const out = new Map<string, string>();
  for (const [champ, cols] of candidats) {
    if (cols.length === 1) { out.set(cols[0], champ); continue; }
    const rang = (e: string) => { const m = motsDe(e); return (m.includes("total") ? 0 : 100) + m.length; };
    const tries = [...cols].sort((a, b) => rang(a) - rang(b));
    if (rang(tries[0]) < rang(tries[1])) out.set(tries[0], champ);
  }
  return out;
}
