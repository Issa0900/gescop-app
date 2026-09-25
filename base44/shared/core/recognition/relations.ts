// Preuves relationnelles et mathematiques (directives §4 niveaux 5 et 6, §5, §8).
//
// Un nom de colonne n'est qu'un indice. Deux preuves sont beaucoup plus fortes,
// parce qu'elles viennent des VALEURS :
//   - les relations mathematiques du metier : si « Montant » vaut « Qte × PU »
//     sur toutes les lignes, c'est bien un montant de vente, quel que soit son
//     nom ; si la relation ne tient jamais, le rattachement merite un doute ;
//   - les relations entre tables : si 95 % des codes d'une colonne « Ref.
//     acheteur » existent dans les clients deja connus, c'est un code client.
// Enfin une valeur inhabituelle (montant negatif, valeur 50 fois la mediane)
// n'est ni supprimee ni corrigee : elle est signalee (§8).

import { parseNumber } from "../../importUtils.ts";

// ---------------------------------------------------------------------------
// 1. Relations mathematiques
// ---------------------------------------------------------------------------

export interface RelationMath {
  id: string;
  libelle: string;
  /** Champ dont la valeur est calculee par la relation. */
  resultat: string;
  /** Champs necessaires au calcul (tous doivent etre rattaches). */
  termes: string[];
  /** Champs facultatifs pris en compte s'ils sont rattaches. */
  optionnels?: string[];
  calcul: (v: Record<string, number>) => number | null;
  /** Le resultat peut etre exprime en % ou en ratio. */
  pourcentage?: boolean;
}

const montantVente = (v: Record<string, number>) => v.quantity * v.unit_price - (v.discount || 0);

export const RELATIONS: RelationMath[] = [
  { id: "qte_prix_total_revenue", libelle: "quantité × prix unitaire = montant", resultat: "total_revenue", termes: ["quantity", "unit_price"], optionnels: ["discount"], calcul: montantVente },
  { id: "qte_prix_total", libelle: "quantité × prix unitaire = total", resultat: "total", termes: ["quantity", "unit_price"], optionnels: ["discount"], calcul: montantVente },
  { id: "qte_prix_subtotal", libelle: "quantité × prix unitaire = sous-total", resultat: "subtotal", termes: ["quantity", "unit_price"], optionnels: ["discount"], calcul: montantVente },
  { id: "qte_cout_total_cost", libelle: "quantité × coût unitaire = coût total", resultat: "total_cost", termes: ["quantity", "unit_cost"], calcul: (v) => v.quantity * v.unit_cost },
  { id: "marge_brute", libelle: "chiffre d'affaires − coût = profit brut", resultat: "gross_profit", termes: ["total_revenue", "total_cost"], calcul: (v) => v.total_revenue - v.total_cost },
  { id: "taux_marge", libelle: "profit brut ÷ chiffre d'affaires = marge", resultat: "gross_margin", termes: ["gross_profit", "total_revenue"], calcul: (v) => (v.total_revenue ? v.gross_profit / v.total_revenue : null), pourcentage: true },
  { id: "total_taxes", libelle: "sous-total + taxes + livraison − remise = total", resultat: "total", termes: ["subtotal", "tax"], optionnels: ["shipping", "discount"], calcul: (v) => v.subtotal + v.tax + (v.shipping || 0) - (v.discount || 0) },
  { id: "equation_stock", libelle: "stock initial + achats + retours − ventes − pertes = stock final", resultat: "closing_stock", termes: ["opening_stock", "purchases", "units_sold"], optionnels: ["returns", "damaged"], calcul: (v) => v.opening_stock + v.purchases + (v.returns || 0) - v.units_sold - (v.damaged || 0) },
  { id: "valeur_stock", libelle: "stock × coût unitaire = valeur du stock", resultat: "inventory_value", termes: ["closing_stock", "unit_cost"], calcul: (v) => v.closing_stock * v.unit_cost },
  { id: "flux_net", libelle: "encaissements − décaissements = flux net", resultat: "net_cash_flow", termes: ["cash_in", "cash_out"], calcul: (v) => v.cash_in - v.cash_out },
  { id: "tresorerie", libelle: "trésorerie d'ouverture + flux net = trésorerie de clôture", resultat: "closing_cash", termes: ["opening_cash", "net_cash_flow"], calcul: (v) => v.opening_cash + v.net_cash_flow },
  { id: "roas", libelle: "revenu ÷ dépense = ROAS", resultat: "roas", termes: ["revenue", "spend"], calcul: (v) => (v.spend ? v.revenue / v.spend : null) },
  { id: "cac", libelle: "dépense ÷ conversions = CAC", resultat: "cac", termes: ["spend", "conversions"], calcul: (v) => (v.conversions ? v.spend / v.conversions : null) },
];

export interface VerificationRelation {
  id: string;
  libelle: string;
  champs: string[];
  /** Lignes ou tous les termes et le resultat etaient lisibles. */
  n: number;
  coherentes: number;
  taux: number;
}

function proche(attendu: number, obtenu: number): boolean {
  const ecart = Math.abs(attendu - obtenu);
  return ecart <= 0.011 || ecart <= Math.abs(attendu) * 0.01;
}

/**
 * Verifie chaque relation dont tous les champs sont rattaches. `lignes` donne,
 * par ligne du fichier, la valeur brute de chaque champ rattache.
 */
export function verifierRelations(champsRattaches: Set<string>, lignes: Record<string, any>[]): VerificationRelation[] {
  const out: VerificationRelation[] = [];
  const aDesTaxes = champsRattaches.has("tax") || champsRattaches.has("tax_federal") || champsRattaches.has("tax_provincial") || champsRattaches.has("subtotal");
  for (const rel of RELATIONS) {
    if (rel.id === "qte_prix_total" && aDesTaxes) continue;
    if (!champsRattaches.has(rel.resultat) || !rel.termes.every((t) => champsRattaches.has(t))) continue;
    const optionnels = (rel.optionnels || []).filter((o) => champsRattaches.has(o));
    let n = 0;
    let coherentes = 0;
    for (const l of lignes) {
      const v: Record<string, number> = {};
      let lisible = true;
      for (const c of [...rel.termes, rel.resultat]) {
        const x = parseNumber(l[c]);
        if (x === null) { lisible = false; break; }
        v[c] = x;
      }
      if (!lisible) continue;
      for (const o of optionnels) v[o] = parseNumber(l[o]) ?? 0;
      const attendu = rel.calcul(v);
      if (attendu === null || !isFinite(attendu)) continue;
      n++;
      const obtenu = v[rel.resultat];
      if (proche(attendu, obtenu) || (rel.pourcentage && proche(attendu * 100, obtenu))) coherentes++;
    }
    if (n > 0) out.push({ id: rel.id, libelle: rel.libelle, champs: [...rel.termes, ...optionnels, rel.resultat], n, coherentes, taux: coherentes / n });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Relations entre tables
// ---------------------------------------------------------------------------

/** Champ-cle -> entites (et champ) ou ses valeurs doivent exister. */
export const CLES_ETRANGERES: Record<string, { entite: string; champ: string; libelle: string }[]> = {
  customer_id: [{ entite: "Customer", champ: "customer_id", libelle: "clients" }],
  product_id: [{ entite: "Product", champ: "product_id", libelle: "produits" }, { entite: "Inventory", champ: "product_id", libelle: "stocks" }],
  employee_id: [{ entite: "Employee", champ: "employee_id", libelle: "employés" }],
  supplier_id: [{ entite: "Supplier", champ: "supplier_id", libelle: "fournisseurs" }],
  campaign_id: [{ entite: "Campaign", champ: "campaign_id", libelle: "campagnes" }],
};

/** Valeurs connues par « Entite.champ » (base + feuilles deja lues dans ce fichier). */
export type ClesConnues = Map<string, Set<string>>;

const cle = (v: any) => String(v ?? "").trim().toLowerCase();

export function recouvrement(valeurs: any[], connues: Set<string> | undefined): { distinctes: number; trouvees: number; taux: number } {
  const d = new Set(valeurs.map(cle).filter(Boolean));
  if (!connues || connues.size === 0 || d.size === 0) return { distinctes: d.size, trouvees: 0, taux: 0 };
  let trouvees = 0;
  for (const v of d) if (connues.has(v)) trouvees++;
  return { distinctes: d.size, trouvees, taux: trouvees / d.size };
}

export function ajouterClesConnues(cles: ClesConnues, entite: string, champ: string, valeurs: any[]) {
  const k = `${entite}.${champ}`;
  const s = cles.get(k) || new Set<string>();
  for (const v of valeurs) { const c = cle(v); if (c) s.add(c); }
  cles.set(k, s);
}

// ---------------------------------------------------------------------------
// 3. Valeurs inhabituelles
// ---------------------------------------------------------------------------

/** Champs ou une valeur negative est inhabituelle (sans etre forcement fausse). */
export const POSITIFS_ATTENDUS = new Set([
  "quantity", "unit_price", "unit_cost", "total", "total_revenue", "subtotal", "amount", "spend", "budget",
  "closing_stock", "opening_stock", "inventory_level", "selling_price", "purchase_cost", "revenue",
]);

export interface ValeurInhabituelle { indice: number; champ: string; valeur: number; motif: string }

/**
 * Repere, sans rien modifier, les valeurs qui meritent un regard humain :
 * negatives la ou on attend du positif (retour, avoir, correction ?), ou tres
 * eloignees du reste de la colonne (plus de 20 fois la mediane).
 */
export function valeursInhabituelles(lignes: Record<string, any>[]): ValeurInhabituelle[] {
  const out: ValeurInhabituelle[] = [];
  const parChamp = new Map<string, { i: number; v: number }[]>();
  lignes.forEach((l, i) => {
    for (const [champ, brut] of Object.entries(l)) {
      if (!POSITIFS_ATTENDUS.has(champ)) continue;
      const v = parseNumber(brut);
      if (v === null) continue;
      if (!parChamp.has(champ)) parChamp.set(champ, []);
      parChamp.get(champ)!.push({ i, v });
      if (v < 0) out.push({ indice: i, champ, valeur: v, motif: "valeur négative (retour, avoir ou correction ?)" });
    }
  });
  for (const [champ, vals] of parChamp) {
    const positives = vals.map((x) => x.v).filter((v) => v > 0).sort((a, b) => a - b);
    if (positives.length < 10) continue;
    const mediane = positives[Math.floor(positives.length / 2)];
    if (mediane <= 0) continue;
    for (const { i, v } of vals) {
      if (v > mediane * 20) out.push({ indice: i, champ, valeur: v, motif: `valeur ${Math.round(v / mediane)} fois la médiane de la colonne` });
    }
  }
  return out;
}
