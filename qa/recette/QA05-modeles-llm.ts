// QA05 : chaque fonction n'appelle InvokeLLM qu'avec un modèle que Base44
// accepte. La liste de référence (shared/modelesLLM.ts) doit suivre celle du
// SDK installé (InvokeLLMParams.model).
import * as Modeles from "../../base44/shared/modelesLLM.ts";
const { MODELES_INVOKELLM } = Modeles;

let ko = 0;
const verif = (ok: boolean, msg: string) => { if (!ok) ko++; console.log(`${ok ? "ok  " : "KO  "} ${msg}`); };
const racine = new URL("../../", import.meta.url);

// 1. La liste suit le SDK installé.
const dts = await Deno.readTextFile(new URL("node_modules/@base44/sdk/dist/modules/integrations.types.d.ts", racine));
const ligne = dts.match(/model\?:\s*([^;]+);/)?.[1] || "";
const duSdk = [...ligne.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
verif(duSdk.length > 0 && JSON.stringify(duSdk) === JSON.stringify([...MODELES_INVOKELLM].sort()),
  `liste des modèles = SDK installé (${duSdk.join(", ")})`);

// 2. Aucune fonction n'utilise un modèle hors liste : ni en toutes lettres
// (model: "…"), ni par une constante de shared/modelesLLM.ts (model: MODELE_…).
const connus = new Set<string>(MODELES_INVOKELLM);
for (const [nom, valeur] of Object.entries(Modeles)) {
  if (nom.startsWith("MODELE_")) verif(connus.has(String(valeur)), `${nom} = « ${valeur} » accepté par InvokeLLM`);
}
for await (const d of Deno.readDir(new URL("base44/functions/", racine))) {
  if (!d.isDirectory) continue;
  const src = await Deno.readTextFile(new URL(`base44/functions/${d.name}/entry.ts`, racine)).catch(() => "");
  for (const m of src.matchAll(/^\s*model:\s*"([^"]+)"/gm)) {
    verif(connus.has(m[1]), `${d.name} : modèle « ${m[1]} » accepté par InvokeLLM`);
  }
  for (const m of src.matchAll(/^\s*model:\s*([A-Z_]+)\s*,/gm)) {
    verif(m[1] in Modeles, `${d.name} : ${m[1]} vient de shared/modelesLLM.ts`);
  }
}
const enrich = await Deno.readTextFile(new URL("base44/functions/enrichFromWebsite/entry.ts", racine));
verif(!/claude-3-5-sonnet"/.test(enrich.replace(/\/\/.*$/gm, "")), "enrichFromWebsite n'utilise plus claude-3-5-sonnet");
verif(/model:\s*MODELE_ENRICHISSEMENT_WEB/.test(enrich), "enrichFromWebsite utilise le modèle de référence");

console.log(ko ? `cas en echec : ${ko}` : "tous les cas passent");
if (ko) Deno.exit(1);
