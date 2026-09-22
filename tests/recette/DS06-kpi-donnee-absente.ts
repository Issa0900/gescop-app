// DS06 — Une donnee non mesuree ne doit jamais devenir une "bonne"
// performance dans un KPI (sec9-11 de l'audit). Trouve par un agent
// d'audit delegue : src/lib/core/kpiRegistry.js (utilise par
// Dashboard/Finance/Tresorerie via useKpiEngine) traitait un COGS/CAC/AOV
// jamais importe comme un COGS/CAC/AOV de zero, au lieu de "non mesurable".
// Le moteur backend base44/shared/core/kpi/kpiCatalog.ts faisait deja ca
// correctement (retourne null) mais n'est appele nulle part en production
// (seules ses metadonnees sont lues par KpiManagementPanel.jsx) : la
// reference de comportement correct existait, mais pas au bon endroit.
//
// 22 sept 2026 : kpiCatalog.ts a ete supprime le 18 sept (moteur mort, cf.
// AGENTS.md) ; ses assertions « backend » sont retirees. Le moteur de
// production, kpiRegistry.js, reste verifie ci-dessous a l'identique.
import { KPI_REGISTRY } from "../../src/lib/core/kpiRegistry.js";

let e = 0;
const t = (b: boolean, msg: string) => { if (!b) e++; console.log(`${b ? "ok  " : "KO  "} ${msg}`); };

// ── Marge brute : CA mesure, COGS jamais importe (colonne absente) ────────

const frontendMarginAmount = KPI_REGISTRY.gross_margin_amount.calculate({ total_revenue: 100000 });
const frontendMarginPct = KPI_REGISTRY.gross_margin_pct.calculate({ total_revenue: 100000, gross_margin_amount: frontendMarginAmount });
t(frontendMarginPct === null,
  `frontend gross_margin_pct(total_revenue=100000, cogs jamais fourni) = ${frontendMarginPct} (attendu null, pas 100%)`);

// Non-regression : un COGS reellement mesure a 40000$ donne bien 60% de marge.
const margeReelle = KPI_REGISTRY.gross_margin_pct.calculate({
  total_revenue: 100000,
  gross_margin_amount: KPI_REGISTRY.gross_margin_amount.calculate({ total_revenue: 100000, cogs: 40000 }),
});
t(margeReelle === 60, `marge reelle (cogs=40000 mesure) = ${margeReelle}% (attendu 60%, le calcul normal ne doit pas casser)`);

// ── Panier moyen : aucune commande valide ──────────────────────────────────

const frontendAov = KPI_REGISTRY.aov.calculate({ total_revenue: 0, _records: [] });
t(frontendAov === null, `frontend aov(_records=[]) = ${frontendAov} (attendu null, pas 0)`);

// ── CAC : marketing_spend connu, new_customers jamais mesure ──────────────

const frontendCac = KPI_REGISTRY.cac.calculate({ marketing_spend: 5000, new_customers: 0 });
t(frontendCac === null, `frontend cac(spend=5000, new_customers=0) = ${frontendCac} (attendu null)`);

// Non-regression : un CAC reellement mesure (5000$/25 clients) reste 200$.
const cacReel = KPI_REGISTRY.cac.calculate({ marketing_spend: 5000, new_customers: 25 });
t(cacReel === 200, `cac reel (25 clients acquis) = ${cacReel}$ (attendu 200$)`);

console.log("\ncas en echec :", e);
