// Commandes -> clients (lot 4 du rapport du 25 sept. 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { indexClients, clientDeCommande, cleClientCommande } from "../src/lib/rapprochementClients.js";
import { churnStats } from "../src/lib/metrics.js";

const clients = [
  { customer_id: "C001", first_name: "Olivier", last_name: "Caron", email: "olivier.caron@courriel.ca" },
  { customer_id: "C002", first_name: "Josée", last_name: "Fortin" },
  { customer_id: "C003", name: "Plein Air Expédition Inc." },
];

test("une commande qui ne donne que le nom retrouve son client (casse, accents, ordre)", () => {
  const ix = indexClients(clients);
  assert.equal(clientDeCommande({ customer_id: "Olivier Caron" }, ix), "C001");
  assert.equal(clientDeCommande({ customer_name: "FORTIN, Josee" }, ix), "C002");
  assert.equal(clientDeCommande({ customer_id: "C001" }, ix), "C001");
  assert.equal(clientDeCommande({ customer_email: "Olivier.Caron@courriel.ca" }, ix), "C001");
  assert.equal(clientDeCommande({ customer_id: "plein air expedition inc" }, ix), "C003");
  assert.equal(clientDeCommande({ customer_id: "Inconnu Total" }, ix), null);
});

test("deux clients du même nom : le nom seul ne tranche pas", () => {
  const ix = indexClients([{ customer_id: "A", name: "Marie Tremblay" }, { customer_id: "B", name: "Marie Tremblay" }]);
  assert.equal(clientDeCommande({ customer_id: "Marie Tremblay" }, ix), null);
  assert.equal(clientDeCommande({ customer_id: "B" }, ix), "B");
});

test("sans fichier clients, l'identifiant de la commande sert tel quel", () => {
  assert.equal(cleClientCommande({ customer_id: "X9" }, indexClients([])), "X9");
});

test("« clients ayant commandé » ne dépasse jamais les clients du fichier", () => {
  const commandes = [
    { customer_id: "Olivier Caron", date: "2026-07-01" },
    { customer_id: "Josée Fortin", date: "2026-08-01" },
    ...Array.from({ length: 50 }, (_, i) => ({ customer_id: `AUTRE-${i}`, date: "2025-01-01" })),
  ];
  assert.equal(churnStats(clients, commandes).buyers, 2);
});
