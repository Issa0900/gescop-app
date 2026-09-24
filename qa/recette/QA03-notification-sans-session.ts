// QA03 : notifyCriticalEvent.
// - Sans session utilisateur (appel d'un workflow, d'un webhook ou d'un inconnu),
//   la réponse est un 401 explicite, pas un 500 dû à l'exception de auth.me().
// - Le destinataire vient toujours de l'enregistrement relu, jamais d'un
//   user_id fourni dans le corps de la requête.
// - Les workflows n'envoient plus de user_id (ni les autres champs ignorés).
import handler from "../../base44/functions/notifyCriticalEvent/entry.ts";

let ko = 0;
const verif = (ok: boolean, msg: string) => { if (!ok) ko++; console.log(`${ok ? "ok  " : "KO  "} ${msg}`); };
const requete = (corps: any) => new Request("https://x/notify", { method: "POST", body: JSON.stringify(corps) });
const poser = (c: any) => { (globalThis as any).__BASE44_STUB = c; };

function client(me: () => Promise<any>, courriels: any[]) {
  const record = { id: "an-1", created_by_id: "proprio", title: "Marge négative", severity: "critique" };
  const alertes: any[] = [];
  const entities = new Proxy({}, { get: () => ({
    get: async (id: string) => (id === "an-1" ? record : null),
    create: async (d: any) => d,
    filter: async (q: any) => alertes.filter((a) => a.category === q.category),
  }) });
  return {
    auth: { me },
    entities,
    asServiceRole: {
      entities: new Proxy({}, { get: (_t, n) => ({
        get: async (id: string) => (n === "User" ? { id, email: `${id}@exemple.test` } : null),
        create: async (d: any) => { if (n === "Alert") alertes.push({ ...d, created_date: new Date().toISOString() }); return d; },
      }) }),
      integrations: { Core: { SendEmail: async (m: any) => { courriels.push(m); return {}; } } },
    },
  };
}

// 1. Sans session : auth.me() lève (c'est ce que fait le SDK sans jeton).
let courriels: any[] = [];
poser(client(async () => { throw Object.assign(new Error("Unauthorized"), { status: 401 }); }, courriels));
let rep = await handler(requete({ entity_type: "anomaly", entity_id: "an-1", user_id: "victime" }));
verif(rep.status === 401, `sans session : 401 (obtenu ${rep.status})`);
verif(courriels.length === 0, "sans session : aucun courriel");

// 2. Session d'un autre utilisateur qui fournit un user_id : refusé.
courriels = [];
poser(client(async () => ({ id: "intrus" }), courriels));
rep = await handler(requete({ entity_type: "anomaly", entity_id: "an-1", user_id: "proprio" }));
verif(rep.status === 404 && courriels.length === 0, "user_id du corps ignoré : un intrus n'obtient aucun envoi");

// 3. Le propriétaire : le courriel part vers l'adresse du propriétaire de l'enregistrement.
courriels = [];
poser(client(async () => ({ id: "proprio" }), courriels));
rep = await handler(requete({ entity_type: "anomaly", entity_id: "an-1", user_id: "autre" }));
verif(rep.status === 200 && courriels[0]?.to === "proprio@exemple.test", "propriétaire : courriel envoyé à son adresse, pas au user_id du corps");
// 3b. Rappel pour le même enregistrement : déjà notifié, pas de second courriel.
rep = await handler(requete({ entity_type: "anomaly", entity_id: "an-1" }));
verif(rep.status === 200 && courriels.length === 1, "même anomalie rappelée : pas de second courriel (règle des nouveautés)");
delete (globalThis as any).__BASE44_STUB;

// 4. Les workflows n'envoient plus de paramètre que la fonction ignore.
for (const f of ["Alerte Anomalie Critique", "Alerte Risque Majeur"]) {
  const txt = await Deno.readTextFile(new URL(`../../base44/workflows/${f}.jsonc`, import.meta.url));
  const args = JSON.parse(txt).definition.do[0].notify.with.args;
  verif(!("user_id" in args), `${f} : plus de user_id dans les arguments`);
  verif(Object.keys(args).sort().join(",") === "entity_id,entity_type", `${f} : seuls entity_type et entity_id sont transmis`);
}

console.log(ko ? `cas en echec : ${ko}` : "tous les cas passent");
if (ko) Deno.exit(1);
