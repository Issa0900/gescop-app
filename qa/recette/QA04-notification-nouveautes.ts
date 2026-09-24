// QA04 : courriel « anomalie critique / risque majeur » envoyé par
// analyzeBusiness, seulement pour un élément NOUVEAU (même titre non notifié
// depuis JOURS_NOUVEAUTE jours) — règle décidée par Issa le 24 sept. 2026.
import { aNotifier, cleTitre, JOURS_NOUVEAUTE } from "../../base44/shared/notificationsCritiques.ts";
import analyzeBusiness from "../../base44/functions/analyzeBusiness/entry.ts";

let ko = 0;
const verif = (ok: boolean, msg: string) => { if (!ok) ko++; console.log(`${ok ? "ok  " : "KO  "} ${msg}`); };

// --- 1. La règle, sur des données fixes --------------------------------------
const maintenant = new Date("2026-09-24T12:00:00Z");
const ilYa = (j: number) => new Date(maintenant.getTime() - j * 86_400_000).toISOString();
const anomalies = [
  { title: "Marge brute négative", severity: "critique" },
  { title: "Chute des ventes", severity: "critique" },
  { title: "Retard fournisseur", severity: "modere" },
  { title: "Stock dormant", severity: "critique" },
  { title: "  CHUTE des  ventes ", severity: "critique" },
];
const alertes = [
  { category: "anomaly", title: "Marge brute negative", created_date: ilYa(3) },
  { category: "anomaly", title: "Stock dormant", created_date: ilYa(JOURS_NOUVEAUTE + 1) },
  { category: "anomalie", title: "Chute des ventes", created_date: ilYa(1) },
  { category: "risk", title: "Chute des ventes", created_date: ilYa(1) },
];
const retenus = aNotifier("anomaly", anomalies, alertes, maintenant).map((a) => a.title);
verif(!retenus.includes("Marge brute négative"), "déjà notifiée il y a 3 jours (accents ignorés) : pas de courriel");
verif(retenus.includes("Stock dormant"), `notifiée il y a ${JOURS_NOUVEAUTE + 1} jours : de nouveau notifiée`);
verif(retenus.filter((t) => cleTitre(t) === "chute des ventes").length === 1, "nouvelle : notifiée une seule fois même si l'analyse la répète");
verif(!retenus.includes("Retard fournisseur"), "non critique : pas de courriel");
verif(aNotifier("anomaly", [{ title: "X", severity: "critique" }], [{ category: "anomaly", title: "X" }], maintenant).length === 0, "alerte sans date lisible : comptée comme récente (pas de double envoi)");
const risques = aNotifier("risk", [{ title: "Rupture", urgency: "elevee" }, { title: "Taux", urgency: "moyenne" }], [], maintenant);
verif(risques.length === 1 && risques[0].title === "Rupture", "risque : seulement l'urgence élevée");

// --- 2. Le vrai analyzeBusiness, client Base44 simulé, deux analyses ----------
const tables: Record<string, any[]> = {
  Company: [{ id: "c1", name: "Boulangerie", industry: "alimentation" }],
  Transaction: [{ id: "t1", date: "2026-08-01", amount: 1000, type: "revenu" }],
};
let n = 0;
const table = (e: string) => (tables[e] ||= []);
const entite = (e: string) => ({
  list: async (_s?: string, limit = 1e9, skip = 0) => table(e).slice(skip, skip + limit),
  filter: async (q: any = {}, _s?: string, limit = 1e9) => table(e).filter((r) => Object.entries(q).every(([k, v]: any) =>
    v && typeof v === "object" && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v)).slice(0, limit),
  get: async (id: string) => table(e).find((r) => r.id === id),
  create: async (r: any) => { const x = { id: `${e}-${++n}`, created_date: new Date().toISOString(), ...r }; table(e).push(x); return x; },
  bulkCreate: async (rs: any[]) => rs.map((r) => { const x = { id: `${e}-${++n}`, created_date: new Date().toISOString(), ...r }; table(e).push(x); return x; }),
  update: async (id: string, p: any) => Object.assign(table(e).find((r) => r.id === id) || {}, p),
  deleteMany: async (q: any = {}) => { const avant = table(e).length; if (Object.keys(q).length === 0) tables[e] = []; return { deleted: avant - table(e).length }; },
});
const entities = new Proxy({}, { get: (_t, e) => entite(String(e)) });
const courriels: any[] = [];
const reponseIA = {
  dimensions: [{ name: "Finance", score: 40, trend: "baisse", explanation: "x", measured: true }],
  anomalies: [
    { title: "Marge brute négative", severity: "critique", description: "d" },
    { title: "Retard fournisseur", severity: "modere" },
  ],
  risks: [{ title: "Rupture de trésorerie", urgency: "elevee", score: 60 }],
  opportunities: [], recommendations: [],
};
(globalThis as any).__BASE44_STUB = {
  entities,
  auth: { me: async () => ({ id: "u1", email: "issa@exemple.test" }) },
  asServiceRole: {
    entities,
    integrations: { Core: {
      InvokeLLM: async () => JSON.parse(JSON.stringify(reponseIA)),
      SendEmail: async (m: any) => { courriels.push(m); return {}; },
    } },
  },
};
const analyser = async () => {
  const rep = await analyzeBusiness(new Request("https://x/a", { method: "POST", body: "{}" }));
  return { status: rep.status, corps: await rep.json() };
};
const r1 = await analyser();
verif(r1.status === 200, `1re analyse aboutit (statut ${r1.status}${r1.corps?.error ? " : " + r1.corps.error : ""})`);
verif(courriels.length === 2, `1re analyse : 2 courriels (anomalie critique + risque élevé), obtenu ${courriels.length}`);
verif(courriels.every((c) => c.to === "issa@exemple.test"), "envoyés à l'utilisateur de la session");
verif(courriels.some((c) => /Anomalie critique.*Marge brute/.test(c.subject)) && courriels.some((c) => /Risque majeur.*Rupture/.test(c.subject)), "sujets attendus");
verif(r1.corps?.counts?.notifications === 2, "la réponse compte les notifications");
const r2 = await analyser();
verif(r2.status === 200 && courriels.length === 2, `2e analyse, mêmes titres : aucun nouveau courriel (total ${courriels.length})`);
reponseIA.anomalies.push({ title: "Fraude possible", severity: "critique", description: "d" });
await analyser();
verif(courriels.length === 3 && /Fraude possible/.test(courriels[2]?.subject), "3e analyse : seule la nouvelle anomalie est notifiée");
delete (globalThis as any).__BASE44_STUB;

console.log(ko ? `cas en echec : ${ko}` : "tous les cas passent");
if (ko) Deno.exit(1);
