// Rapprochement commande -> client, une seule règle pour la page Clients,
// l'attrition (metrics.js) et l'audit (dataAudit.js).
//
// Rapport du 25 sept. 2026 : 66 commandes et 30 clients importés, mais 0
// commande et 0 $ pour chaque client. Le fichier de commandes ne donne que le
// NOM du client (« Olivier Bélanger »), rangé dans customer_id, alors que la
// fiche client porte l'identifiant « C001 » : la jointure stricte sur
// customer_id ne trouvait jamais rien. Le rapprochement se fait ici à la
// lecture, donc quel que soit l'ordre des imports (clients avant ou après les
// commandes).

// Les points ne comptent que dans un courriel (« Inc. » = « Inc »).
const norm = (s) => {
  const t = String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return (t.includes("@") ? t.replace(/[^a-z0-9@.]+/g, " ") : t.replace(/[^a-z0-9]+/g, " ")).trim();
};

/** Toutes les façons de désigner un client : identifiant, courriel, nom (dans les deux ordres). */
function clesClient(c) {
  const cles = [c.customer_id, c.email];
  const prenom = c.first_name, nom = c.last_name;
  if (c.name) cles.push(c.name);
  if (prenom || nom) {
    cles.push(`${prenom || ""} ${nom || ""}`, `${nom || ""} ${prenom || ""}`, `${nom || ""}, ${prenom || ""}`);
  }
  if (c.company_name) cles.push(c.company_name);
  return cles.map(norm).filter(Boolean);
}

/**
 * Index clé normalisée -> customer_id. Une clé partagée par deux clients
 * différents (deux « Marie Tremblay ») est ambiguë : elle n'est pas utilisée.
 */
export function indexClients(customers = []) {
  const index = new Map();
  const ambigues = new Set();
  for (const c of customers || []) {
    const id = c.customer_id ?? c.id;
    if (id == null || id === "") continue;
    for (const k of clesClient(c)) {
      if (index.has(k) && index.get(k) !== id) ambigues.add(k);
      else index.set(k, id);
    }
  }
  for (const k of ambigues) index.delete(k);
  // Gardees pour le dire (« 2 fiches clients portent ce nom »), jamais pour deviner.
  index.ambigues = ambigues;
  return index;
}

/** customer_id du client d'une commande, ou null si aucun client connu ne correspond. */
export function clientDeCommande(o, index) {
  for (const v of [o.customer_id, o.customer_email, o.customer_name, o.client]) {
    const k = norm(v);
    if (k && index.has(k)) return index.get(k);
  }
  return null;
}

/** « trouve », « ambigu » (plusieurs fiches portent ce nom) ou « absent ». */
export function statutClientCommande(o, index) {
  if (clientDeCommande(o, index)) return "trouve";
  const cles = [o.customer_id, o.customer_email, o.customer_name, o.client].map(norm).filter(Boolean);
  if (cles.length === 0) return "sans_client";
  return cles.some((k) => index.ambigues?.has(k)) ? "ambigu" : "absent";
}

/**
 * Identifiant client à utiliser pour une commande : le client connu s'il est
 * retrouvé, sinon l'identifiant brut de la commande (fichier de commandes seul,
 * sans fichier clients).
 */
export function cleClientCommande(o, index) {
  return clientDeCommande(o, index) ?? (o.customer_id || o.customer_name || null);
}
