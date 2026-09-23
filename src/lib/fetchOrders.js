// Lecture des commandes pour toutes les pages : paginee (fetchAll) ET ramenee
// a une seule devise (kpiRecords.normaliserDevises) avec les taux que
// l'entreprise a fournis (Parametres > Preferences). Une page qui lisait les
// commandes brutes additionnait des dollars US, des livres et des euros comme
// des dollars canadiens ; passer toutes les pages par ici garde la regle en
// un seul endroit.

import { base44 } from "@/api/base44Client";
import { fetchAll } from "./fetchAll";
import { normaliserDevises } from "./core/kpiRecords";

export async function fetchOrders(sort = "-date") {
  const [orders, companies] = await Promise.all([
    fetchAll(base44.entities.Order, sort),
    base44.entities.Company.list().catch(() => []),
  ]);
  const company = companies?.[0];
  return normaliserDevises(orders, { base: company?.currency || null, taux: company?.exchange_rates || {} }).rows;
}
