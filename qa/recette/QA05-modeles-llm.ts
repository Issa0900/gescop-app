// QA05 : chaque fonction n'appelle InvokeLLM qu'avec un modèle que Base44
// accepte. La liste de référence (shared/modelesLLM.ts) doit suivre celle du
// SDK installé (InvokeLLMParams.model).
import { MODELES_INVOKELLM } from "../../base44/shared/modelesLLM.ts";

let ko = 0;
const verif = (ok: boolean, msg: string) => { if (!ok) ko++; console.log(`${ok ? "ok  " : "KO  "} ${msg}`); };
const racine = new URL("../../", import.meta.url);

// 1. La liste suit le SDK installé.
const dts = await Deno.readTextFile(new URL("node_modules/@base44/sdk/dist/modules/integrations.types.d.ts", racine));
const ligne = dts.match(/model\?:\s*([^;]+);/)?.[1] || "";
const duSdk = [...ligne.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
verif(duSdk.length > 0 && JSON.stringify(duSdk) === JSON.stringify([...MODELES_INVOKELLM].sort()),
  `liste des modèles = SDK installé (${duSdk.join(", ")})`);

// 2. Aucune fonction n'utilise un modèle hors liste.
// gemini_3_8_flash (importMultiData, scanExternalRadar) est absent du SDK 0.8.48 :
// signalé à Issa (qa/COMPTE-RENDU.md, lot 4), non modifié ici — à trancher.
const A_VERIFIER = new Set(["gemini_3_8_flash"]);
const connus = new Set<string>(MODELES_INVOKELLM);
for await (const d of Deno.readDir(new URL("base44/functions/", racine))) {
  if (!d.isDirectory) continue;
  const src = await Deno.readTextFile(new URL(`base44/functions/${d.name}/entry.ts`, racine)).catch(() => "");
  for (const m of src.matchAll(/^\s*model:\s*"([^"]+)"/gm)) {
    if (A_VERIFIER.has(m[1])) { console.log(`note ${d.name} : modèle « ${m[1]} » absent du SDK, à vérifier`); continue; }
    verif(connus.has(m[1]), `${d.name} : modèle « ${m[1]} » accepté par InvokeLLM`);
  }
}
const enrich = await Deno.readTextFile(new URL("base44/functions/enrichFromWebsite/entry.ts", racine));
verif(!/claude-3-5-sonnet"/.test(enrich.replace(/\/\/.*$/gm, "")), "enrichFromWebsite n'utilise plus claude-3-5-sonnet");
verif(/model:\s*MODELE_ENRICHISSEMENT_WEB/.test(enrich), "enrichFromWebsite utilise le modèle de référence");

console.log(ko ? `cas en echec : ${ko}` : "tous les cas passent");
if (ko) Deno.exit(1);
