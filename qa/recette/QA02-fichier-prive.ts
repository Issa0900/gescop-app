// QA02 : un fichier téléversé en privé (file_uri) est lu par une URL signée de
// courte durée, créée avec le client de l'utilisateur (jamais en rôle service) ;
// seule l'URI privée est conservée sur l'import, jamais l'URL signée. Un ancien
// import dont file_url est une URL publique reste lisible.
import { urlDeLecture, referenceFichier, DUREE_URL_SIGNEE_S } from "../../base44/shared/fichierPrive.ts";

let ko = 0;
const verif = (ok: boolean, msg: string) => { if (!ok) ko++; console.log(`${ok ? "ok  " : "KO  "} ${msg}`); };

const appels: { client: string; params: any }[] = [];
const core = (client: string) => ({
  CreateFileSignedUrl: async (params: any) => {
    appels.push({ client, params });
    return { signed_url: `https://stockage.example/${params.file_uri}?signature=abc` };
  },
});
const base44 = { integrations: { Core: core("utilisateur") }, asServiceRole: { integrations: { Core: core("service") } } };

const prive = { file_uri: "private/u1/ventes.xlsx", file_name: "ventes.xlsx" };
const url = await urlDeLecture(base44, prive);
verif(url === "https://stockage.example/private/u1/ventes.xlsx?signature=abc", "file_uri -> URL signée");
verif(appels.length === 1 && appels[0].client === "utilisateur", "signée avec le client de l'utilisateur, pas en rôle service");
verif(appels[0]?.params.expires_in === DUREE_URL_SIGNEE_S && DUREE_URL_SIGNEE_S <= 900, "URL de courte durée (≤ 15 min)");
verif(referenceFichier(prive) === "private/u1/ventes.xlsx", "l'import conserve l'URI privée");
verif(!referenceFichier(prive).includes("signature"), "l'URL signée n'est jamais conservée");

const ancien = { file_url: "https://base44.app/public/ancien.csv", file_name: "ancien.csv" };
verif(await urlDeLecture(base44, ancien) === ancien.file_url, "ancien import : l'URL publique reste lisible");
verif(appels.length === 1, "ancien import : aucune signature demandée");
verif(referenceFichier(ancien) === ancien.file_url, "ancien import : référence inchangée");

let erreur = "";
try { await urlDeLecture(base44, { file_name: "rien.csv" }); } catch (e) { erreur = (e as Error).message; }
verif(/file_uri/.test(erreur), "fichier sans référence : erreur claire");

const sansLien = { integrations: { Core: { CreateFileSignedUrl: async () => ({}) } } };
erreur = "";
try { await urlDeLecture(sansLien, prive); } catch (e) { erreur = (e as Error).message; }
verif(/non obtenu/.test(erreur), "signature refusée : erreur claire, pas d'URL vide");

// Bout en bout : le vrai point d'entrée importMultiData, client Base44 simulé.
const { default: importMultiData } = await import("../../base44/functions/importMultiData/entry.ts");
const lus: string[] = [];
(globalThis as any).fetch = async (u: string) => { lus.push(String(u)); return { text: async () => "Date;Montant;Type\n2026-03-01;100;revenu\n", arrayBuffer: async () => new ArrayBuffer(0) }; };
const ecrits: any[] = [];
const signes: any[] = [];
const entite = (nom: string) => ({
  list: async () => [], filter: async () => [],
  create: async (d: any) => { ecrits.push({ nom, d }); return { id: `${nom}-1`, ...d }; },
  update: async (_id: string, d: any) => d,
  bulkCreate: async (rs: any[]) => rs.map((r, i) => ({ id: `${nom}-${i}`, ...r })),
});
const entities = new Proxy({}, { get: (_t, n) => entite(String(n)) });
(globalThis as any).__BASE44_STUB = {
  entities, auth: { me: async () => ({ id: "u1" }) },
  integrations: { Core: { CreateFileSignedUrl: async (p: any) => { signes.push(p); return { signed_url: `https://stockage.example/${p.file_uri}?signature=xyz` }; } } },
  asServiceRole: { entities, integrations: { Core: { InvokeLLM: async () => { throw new Error("hors ligne"); } } } },
};
const corps = { files: [{ file_uri: "private/u1/ventes.csv", file_name: "ventes.csv" }], entity_override: "Transaction" };
const rep = await importMultiData(new Request("https://x/f", { method: "POST", body: JSON.stringify(corps) }));
const donnees = await rep.json();
const creeImport = ecrits.find((e) => e.nom === "Import");
verif(signes.length === 1 && signes[0].file_uri === "private/u1/ventes.csv", "importMultiData signe le file_uri reçu");
verif(lus.length > 0 && lus.every((u) => u.includes("signature=xyz")), "importMultiData lit le fichier par l'URL signée");
verif(creeImport?.d?.file_url === "private/u1/ventes.csv", `l'import enregistre l'URI privée (obtenu : ${creeImport?.d?.file_url})`);
verif(!JSON.stringify(ecrits).includes("signature=xyz"), "l'URL signée n'est écrite nulle part en base");
verif(Array.isArray(donnees.results) && donnees.results.length === 1, "l'import aboutit à un résultat");
delete (globalThis as any).__BASE44_STUB;

console.log(ko ? `cas en echec : ${ko}` : "tous les cas passent");
if (ko) Deno.exit(1);
