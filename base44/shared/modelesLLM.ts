// Modèles acceptés par Core.InvokeLLM, recopiés du SDK utilisé par les
// fonctions (npm:@base44/sdk@0.8.48, InvokeLLMParams.model). Un nom hors de
// cette liste (ex. « claude-3-5-sonnet ») n'est pas un modèle Base44.
// qa/recette/QA05-modeles-llm.ts vérifie que la liste suit le SDK installé et
// que chaque fonction n'utilise qu'un modèle de la liste.
export const MODELES_INVOKELLM = [
  "gpt_5_mini", "gemini_3_flash", "gpt_5_4", "gpt_5_6_sol", "gpt_5_6_luna", "gemini_3_1_pro",
  "claude_sonnet_4_6", "claude_opus_4_6", "claude_opus_4_7", "claude_opus_4_8", "claude-sonnet-5",
] as const;

/** Rapide, avec recherche web (add_context_from_internet) : enrichissement par site web. */
export const MODELE_ENRICHISSEMENT_WEB = "gemini_3_flash";
