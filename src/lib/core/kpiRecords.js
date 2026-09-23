// Regles par ligne partagees par le moteur KPI (kpiEngine) et les formules
// (kpiRegistry) : ce qui compte dans le chiffre d'affaires, le montant hors
// taxes d'une commande, et le rapprochement des sources qui decrivent le meme
// argent (commande et transaction bancaire, depense et transaction).

const STATUTS_HORS_CA = ["annul", "cancel", "void", "brouillon", "draft", "rembours", "refund", "retour", "return"];

/**
 * Une commande annulee, en brouillon, remboursee ou retournee ne compte pas
 * dans le chiffre d'affaires (Sales_transactions : 2 490 lignes « Cancelled »
 * ou « Returned » comptees jusqu'ici).
 */
export function commandeHorsCA(r) {
  const st = [r.status, r.payment_status, r.fulfillment_status]
    .map((x) => String(x || "").toLowerCase()).join(" ");
  if (STATUTS_HORS_CA.some((m) => st.includes(m))) return true;
  // return_status est un indicateur (« Yes »/« No », « Retourné »...), pas un statut
  // de commande : « Not returned » ne doit pas exclure la ligne.
  const ret = String(r.return_status || "").trim().toLowerCase();
  return /^(yes|oui|true|1|y|retourn|returned|rembours|refunded)/.test(ret);
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/**
 * Montant hors taxes d'une ligne de commande : sous-total ; sinon total moins
 * la taxe quand le fichier la fournit ; sinon total ; sinon le montant
 * reconstruit a l'import (quantite x prix).
 */
export function montantHT(r) {
  const st = num(r.subtotal);
  if (st !== null && Number.isFinite(st)) return st;
  const tot = num(r.total);
  const tax = num(r.tax);
  if (tot !== null && Number.isFinite(tot)) return tax !== null && Number.isFinite(tax) ? tot - tax : tot;
  const tr = num(r.total_revenue);
  return tr !== null ? tr : NaN;
}

const TYPES_RECETTE = ["income", "entree", "credit", "revenu", "encaissement", "vente", "cash-in", "cash_in"];
const TYPES_DEPENSE = ["expense", "sortie", "debit", "depense", "decaissement", "charge", "cash-out", "cash_out"];
const sansAccents = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const estRecette = (r) => { const t = sansAccents(r.type); return TYPES_RECETTE.some((m) => t.includes(m)); };
export const estDepense = (r) => { const t = sansAccents(r.type); return TYPES_DEPENSE.some((m) => t.includes(m)); };

/**
 * Transactions de recette qui encaissent une commande deja presente dans les
 * commandes importees : meme argent, compte une seule fois (dans les
 * commandes). Reconnues par une reference explicite (order_id, reference)
 * ou par un numero de commande cite dans le libelle (« Vente ORD-20260601-1 »).
 * Rend la somme de leurs montants.
 */
export function recettesDejaCommandees(records) {
  const commandes = new Set(
    records.filter((r) => r._entity === "Order" && r.order_id != null)
      .map((r) => String(r.order_id).trim().toLowerCase()).filter((id) => id.length >= 3),
  );
  if (commandes.size === 0) return 0;
  let somme = 0;
  for (const r of records) {
    if (r._entity !== "Transaction" || !estRecette(r)) continue;
    const refs = [r.order_id, r.reference, r.reference_order_id]
      .filter((x) => x != null && x !== "").map((x) => String(x).trim().toLowerCase());
    for (const m of String(r.description || "").matchAll(/[A-Za-z0-9][A-Za-z0-9_\-]{2,}/g)) refs.push(m[0].toLowerCase());
    if (refs.some((x) => commandes.has(x))) somme += Math.abs(Number(r.amount) || 0);
  }
  return somme;
}

/**
 * Transactions de depense qui repetent une depense deja importee (meme date,
 * meme montant) : comptees une seule fois, dans les depenses. Chaque depense
 * ne couvre qu'une transaction.
 */
export function depensesDejaSaisies(records) {
  const dispo = new Map();
  for (const r of records) {
    if (r._entity !== "Expense") continue;
    const cle = `${String(r.date || "").slice(0, 10)}|${Math.abs(Number(r.amount) || 0).toFixed(2)}`;
    dispo.set(cle, (dispo.get(cle) || 0) + 1);
  }
  if (dispo.size === 0) return 0;
  let somme = 0;
  for (const r of records) {
    if (r._entity !== "Transaction" || !estDepense(r)) continue;
    const m = Math.abs(Number(r.amount) || 0);
    const cle = `${String(r.date || "").slice(0, 10)}|${m.toFixed(2)}`;
    if ((dispo.get(cle) || 0) > 0) { dispo.set(cle, dispo.get(cle) - 1); somme += m; }
  }
  return somme;
}

/** Lignes de commande avec leur montant hors taxes (`_ht`), pour les agregations par mois. */
export function avecMontantHT(orders) {
  return (orders || []).map((o) => ({ ...o, _ht: Number.isFinite(montantHT(o)) ? montantHT(o) : 0 }));
}

/**
 * Une ligne par COMMANDE : un fichier d'une ligne par article repete le numero
 * de commande ; compter ses lignes gonflait le nombre de commandes et
 * divisait le panier moyen. Montants HT additionnes, premiere date gardee.
 * Les lignes sans numero restent chacune une commande.
 */
export function commandesDistinctes(orders) {
  const parId = new Map();
  const sansId = [];
  for (const o of avecMontantHT(orders)) {
    if (o.order_id === undefined || o.order_id === null || o.order_id === "") { sansId.push(o); continue; }
    const k = String(o.order_id);
    const deja = parId.get(k);
    if (!deja) parId.set(k, { ...o });
    else {
      deja._ht += o._ht;
      deja.quantity = (Number(deja.quantity) || 0) + (Number(o.quantity) || 0);
    }
  }
  return [...parId.values(), ...sansId];
}

/**
 * Base du chiffre d'affaires des commandes, a montrer a cote du chiffre :
 * « HT » quand le fichier donne un sous-total ou les taxes (le CA en est
 * deduit hors taxes), « TTC » quand il ne donne qu'un montant toutes taxes
 * (DS02 : « montant_ttc »), null quand rien ne permet de le savoir.
 */
export function baseCA(orders) {
  const rows = orders || [];
  if (rows.some((o) => (o.subtotal !== undefined && o.subtotal !== null && o.subtotal !== "") || (o.tax !== undefined && o.tax !== null && o.tax !== ""))) return "HT";
  for (const o of rows.slice(0, 200)) {
    let cles = [];
    try { cles = Object.keys(JSON.parse(o.original_data || "{}")); } catch { cles = []; }
    if (cles.some((k) => /ttc|tax(es)?[\s_-]*incl|incl[\s_-]*tax/i.test(k))) return "TTC";
  }
  return null;
}

/** Libelle court de la base, pour les cartes KPI. */
export function noteBaseCA(orders) {
  const b = baseCA(orders);
  return b === "HT" ? "Hors taxes" : b === "TTC" ? "TTC : le fichier ne donne pas les taxes" : null;
}
