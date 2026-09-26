import test from "node:test";
import assert from "node:assert/strict";
import { buildBusinessContext } from "../base44/shared/businessContext.ts";

test("Score fournisseur : 3.1/5 pour la qualité et 65/100 pour la fiabilité sans confusion d'échelle", async () => {
  const suppliers = [
    {
      supplier_name: "Fournisseur A",
      quality_score: 3.1,
      reliability_score: 65,
      average_delivery_days: 10,
      price_change_last_12_months: 2.5,
      status: "actif",
    },
    {
      supplier_name: "Fournisseur B",
      quality_score: 85,
      average_delivery_days: 7,
      status: "actif",
    },
  ];

  const ent = (data = []) => ({ list: async () => data });
  const mockBase44 = {
    entities: new Proxy(
      {
        Company: ent([{ name: "Test Corp" }]),
        Supplier: ent(suppliers),
      },
      { get: (target, prop) => target[prop] || ent([]) }
    ),
  };

  const res = await buildBusinessContext(mockBase44);
  const ctx = res.context;

  // Fournisseur A a un score qualité de 3.1/5 (donc formaté 3.1/5, pas 3.1/100) et fiabilité 65/100
  assert.ok(ctx.includes("qualité 3.1/5"), "Formatage qualité 3.1/5 attendu");
  assert.ok(ctx.includes("fiabilité 65/100"), "Formatage fiabilité 65/100 attendu");
  assert.ok(!ctx.includes("qualité 3.1/100"), "Ne doit jamais afficher 3.1/100");

  // Fournisseur B a un score qualité de 85/100
  assert.ok(ctx.includes("qualité 85/100"), "Formatage qualité 85/100 attendu");

  // Fournisseur A n'est pas faussement compté comme problématique (3.1/5 n'est pas < 70)
  assert.ok(ctx.includes("Fournisseurs problématiques: 0"), "Un score de 3.1/5 n'est pas < 70");
});
