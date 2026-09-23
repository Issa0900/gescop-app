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
  // Vente dans une devise sans taux de conversion (normaliserDevises).
  if (r._devise_exclue) return true;
  const st = [r.status, r.payment_status, r.fulfillment_status]
    .map((x) => String(x || "").toLowerCase()).join(" ");
  if (STATUTS_HORS_CA.some((m) => st.includes(m))) return true;
  // Prix unitaire negatif : ecriture d'ajustement (creance irrecouvrable,
  // correction comptable), pas une vente ni un retour d'article.
  if (Number(r.unit_price) < 0) return true;
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

/**
 * Ligne d'AVOIR (note de credit, retour, annulation d'une facture) : quantite
 * ou montant negatif. Elle reduit le chiffre d'affaires net, mais n'est ni une
 * commande ni un panier (UCI Online Retail : 3 836 factures « C… » a quantites
 * negatives comptees comme commandes).
 */
export function estAvoir(r) {
  if (Number(r.quantity) < 0) return true;
  const m = montantHT(r);
  return Number.isFinite(m) && m < 0;
}

/**
 * Lignes de commande qui comptent comme VENTES : ni hors CA, ni avoir, ni de
 * montant nul. Une ligne a 0 (article « damaged », « found », « check » sans
 * prix) est un mouvement de stock, pas une commande : UCI Online Retail en
 * comptait 766 « factures » a 0, qui gonflaient le nombre de commandes et
 * baissaient le panier moyen. Montant non calculable : la ligne compte.
 */
export const estVente = (r) => {
  if ((r._entity !== undefined && r._entity !== "Order") || commandeHorsCA(r) || estAvoir(r)) return false;
  const m = montantHT(r);
  return !(Number.isFinite(m) && m === 0);
};

/** Somme (positive) des avoirs des commandes, hors lignes exclues du CA. */
export function montantAvoirs(records) {
  let s = 0;
  for (const r of records) {
    if ((r._entity !== undefined && r._entity !== "Order") || commandeHorsCA(r) || !estAvoir(r)) continue;
    const m = montantHT(r);
    if (Number.isFinite(m)) s += Math.abs(m);
  }
  return s;
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
  let somme = 0;
  for (const r of transactionsDejaCommandees(records)) somme += Math.abs(Number(r.amount) || 0);
  return somme;
}

/** Les transactions de recette elles-memes (voir recettesDejaCommandees). */
export function transactionsDejaCommandees(records) {
  const commandes = new Set(
    records.filter((r) => r._entity === "Order" && r.order_id != null)
      .map((r) => String(r.order_id).trim().toLowerCase()).filter((id) => id.length >= 3),
  );
  const out = new Set();
  if (commandes.size === 0) return out;
  for (const r of records) {
    if (r._entity !== "Transaction" || !estRecette(r)) continue;
    const refs = [r.order_id, r.reference, r.reference_order_id]
      .filter((x) => x != null && x !== "").map((x) => String(x).trim().toLowerCase());
    for (const m of String(r.description || "").matchAll(/[A-Za-z0-9][A-Za-z0-9_\-]{2,}/g)) refs.push(m[0].toLowerCase());
    if (refs.some((x) => commandes.has(x))) out.add(r);
  }
  return out;
}

/**
 * Transactions de depense qui repetent une depense deja importee (meme date,
 * meme montant) : comptees une seule fois, dans les depenses. Chaque depense
 * ne couvre qu'une transaction.
 */
export function depensesDejaSaisies(records) {
  let somme = 0;
  for (const r of transactionsDepensesDejaSaisies(records)) somme += Math.abs(Number(r.amount) || 0);
  return somme;
}

/** Les transactions de depense elles-memes (voir depensesDejaSaisies). */
export function transactionsDepensesDejaSaisies(records) {
  const dispo = new Map();
  for (const r of records) {
    if (r._entity !== "Expense") continue;
    const cle = `${String(r.date || "").slice(0, 10)}|${Math.abs(Number(r.amount) || 0).toFixed(2)}`;
    dispo.set(cle, (dispo.get(cle) || 0) + 1);
  }
  const out = new Set();
  if (dispo.size === 0) return out;
  for (const r of records) {
    if (r._entity !== "Transaction" || !estDepense(r)) continue;
    const m = Math.abs(Number(r.amount) || 0);
    const cle = `${String(r.date || "").slice(0, 10)}|${m.toFixed(2)}`;
    if ((dispo.get(cle) || 0) > 0) { dispo.set(cle, dispo.get(cle) - 1); out.add(r); }
  }
  return out;
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
  const notes = [b === "HT" ? "Hors taxes" : b === "TTC" ? "TTC : le fichier ne donne pas les taxes" : null];
  const rows = orders || [];
  const exclues = [...new Set(rows.filter((o) => o._devise_exclue).map((o) => o.currency))];
  const reference = rows.find((o) => o._devise_reference)?._devise_reference;
  if (exclues.length) notes.push(`Partiel : ventes en ${exclues.join(", ")} exclues, taux de change à fournir dans Paramètres > Préférences`);
  else if (rows.some((o) => o._devise_origine)) notes.push(`Converti en ${reference}`);
  return notes.filter(Boolean).join(" · ") || null;
}

const CHAMPS_MONETAIRES = ["subtotal", "total", "tax", "tax_federal", "tax_provincial", "total_revenue", "total_cost", "cost", "unit_price", "unit_cost", "gross_profit", "discount", "shipping"];

/**
 * Ventes en plusieurs devises : ramenees a UNE devise de reference avant
 * tout calcul. Reference = devise de l'entreprise si des ventes y sont
 * libellees, sinon la devise la plus frequente. Une vente dans une autre
 * devise est convertie avec le taux fourni par l'entreprise (1 unite = taux
 * unites de reference) ; sans taux, elle est marquee `_devise_exclue` et
 * n'entre dans AUCUN montant — le KPI est alors partiel, jamais une somme de
 * dollars US, de livres et d'euros. Une seule devise (ou aucune) : rien ne change.
 */
export function normaliserDevises(orders, devises) {
  const rows = orders || [];
  // Deja normalisees (fetchOrders, puis le moteur KPI) : ne pas recommencer,
  // la devise de reference pourrait changer et tout exclure.
  if (rows.some((o) => o._devise_exclue || o._devise_origine || o._devise_reference)) {
    return { rows, base: rows.find((o) => o._devise_reference)?._devise_reference ?? null, converties: rows.filter((o) => o._devise_origine).length, exclues: rows.filter((o) => o._devise_exclue).length, sansTaux: [...new Set(rows.filter((o) => o._devise_exclue).map((o) => o.currency))] };
  }
  const compte = new Map();
  for (const o of rows) if (o.currency) compte.set(o.currency, (compte.get(o.currency) || 0) + 1);
  if (compte.size <= 1) return { rows, base: [...compte.keys()][0] || devises?.base || null, converties: 0, exclues: 0, sansTaux: [] };
  const base = devises?.base && compte.has(devises.base) ? devises.base : [...compte.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const taux = devises?.taux || {};
  let converties = 0, exclues = 0;
  const sansTaux = new Set();
  const out = rows.map((o) => {
    if (!o.currency || o.currency === base) return { ...o, _devise_reference: base };
    const t = Number(taux[o.currency]);
    if (Number.isFinite(t) && t > 0) {
      converties++;
      const c = { ...o, _devise_origine: o.currency, _devise_reference: base, currency: base };
      for (const k of CHAMPS_MONETAIRES) if (c[k] !== undefined && c[k] !== null && c[k] !== "" && Number.isFinite(Number(c[k]))) c[k] = Number(c[k]) * t;
      return c;
    }
    exclues++;
    sansTaux.add(o.currency);
    return { ...o, _devise_exclue: true, _devise_reference: base };
  });
  return { rows: out, base, converties, exclues, sansTaux: [...sansTaux] };
}
