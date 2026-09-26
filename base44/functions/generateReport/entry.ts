import { createFixedClientFromRequest as createClientFromRequest } from "../../shared/client.ts";
import { buildBusinessContext } from "../../shared/businessContext.ts";
import { validateStructuredResponse } from "../../shared/decisionEngine.ts";
import { lireChiffresRapport, blocChiffresRapport, comparaisonDepuisChiffres } from "../../shared/chiffresRapport.ts";


export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { type } = body;
    if (!type) return Response.json({ error: "type requis" }, { status: 400 });
    // Les chiffres viennent du moteur KPI de l'ecran (rapportChiffres.js) : le
    // serveur ne calcule plus ses propres totaux.
    const chiffres = lireChiffresRapport(body);
    if (!chiffres) {
      return Response.json({ error: "Chiffres du rapport manquants : rechargez la page et relancez la génération." }, { status: 400 });
    }

    const ctx = await buildBusinessContext(base44);
    if (!ctx.company) {
      return Response.json({ error: "Configurez votre entreprise d'abord." }, { status: 400 });
    }

    const period = chiffres.periode?.libelle || new Date().toLocaleDateString("fr-CA");

    const reportSpecs = {
      quotidien: `Génère le rapport quotidien (SURVEILLER) : état général de la journée, performance en ventes, finance et opérations, points d'attention, 3 à 5 actions prioritaires.`,
      hebdomadaire: `Génère le rapport hebdomadaire (COMPRENDRE) : compare la semaine et la semaine précédente, explique les variations, les anomalies, les risques et les opportunités, puis les priorités de la semaine suivante.`,
      mensuel: `Génère le rapport mensuel (PILOTER) : résultats financiers, ventes, clients, trésorerie, productivité, risques et opportunités, et termine par un résumé exécutif.`,
    };

    const comparisonData = chiffres.precedente ? comparaisonDepuisChiffres(chiffres) : null;
    const consignesVariations = comparisonData
      ? `\n\nPour CHAQUE explication de variation (champ variationAnalysis), classe ton affirmation :\n- FACT : fait brut directement vérifiable dans les CHIFFRES CALCULÉS.\n- CALCULATION : calcul arithmétique direct sur ces chiffres (écart, %, ratio).\n- OBSERVATION : constat d'une tendance sans en expliquer la cause.\n- INFERENCE : déduction croisant plusieurs indicateurs.\n- HYPOTHESIS : explication plausible qui demande une validation terrain.\n- RECOMMENDATION : action recommandée.\nRenseigne "confidence" (0.0 à 1.0) et "sources" (les indicateurs précis utilisés). N'utilise JAMAIS FACT ou CALCULATION pour une cause non vérifiable dans les données : classe-la HYPOTHESIS.`
      : "";

    const prompt = `Tu es GESCOP. ${reportSpecs[type] || reportSpecs.quotidien}

${blocChiffresRapport(chiffres)}

CONTEXTE BUSINESS (qualitatif, pour l'analyse) :
${ctx.context}

RÈGLES
0. Les CHIFFRES CALCULÉS PAR GESCOP font foi : cite-les tels quels, ne les recalcule pas. Si le CONTEXTE BUSINESS donne un autre montant pour le même indicateur, c'est le CHIFFRE CALCULÉ qui compte. Un chiffre « non mesuré » reste non mesuré : dis-le, n'en propose aucune estimation. Un chiffre « partiel » se cite avec cette réserve.
1. Tout nombre que tu écris doit apparaître dans les CHIFFRES CALCULÉS, ou être un calcul simple (écart, pourcentage de variation, ratio) sur ces seuls nombres.
2. Aucune valeur de référence sectorielle, aucun ordre de grandeur « typique », aucun scénario chiffré inventé. Un élément mieux vaut absent que chiffré à l'aveugle.
3. Chaque CONSTAT CROISÉ doit être repris sans être contredit.${consignesVariations}

Toutes les valeurs textuelles doivent être rédigées en français.

Réponds avec un JSON contenant : summary (résumé exécutif en 2-3 phrases), content (le rapport complet en markdown avec titres et sections), sections (un objet : nom de section -> contenu)${comparisonData ? ", variationAnalysis (3 à 5 objets {label, classification, text, confidence, sources}, un par variation marquante), keyInsights (3 à 5 chaînes, chacune un constat sur l'évolution d'un indicateur)" : ""}.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          content: { type: "string" },
          sections: { type: "object" },
          variationAnalysis: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                classification: { type: "string", enum: ["FACT", "CALCULATION", "OBSERVATION", "INFERENCE", "HYPOTHESIS", "RECOMMENDATION"] },
                text: { type: "string" },
                confidence: { type: "number" },
                sources: { type: "array", items: { type: "string" } },
              },
            },
          },
          keyInsights: { type: "array", items: { type: "string" } },
        },
      },
    });

    const data = typeof result === "string" ? JSON.parse(result) : result;

    // Garde-fou serveur (audit 23 sept, même contrôle que chatAssistant) :
    // generateReport demandait jusqu'ici au LLM un texte libre ("explication
    // probable des variations") sans aucune structure de classification, donc
    // rien ne pouvait être vérifié. Le prompt ci-dessus exige maintenant une
    // classification par variation (variationAnalysis) ; on la valide ici
    // avant de stocker/retourner le rapport, avec le même contrôle que
    // chatAssistant (decisionEngine.ts, jusque-là orphelin).
    const rawVariationAnalysis = Array.isArray(data.variationAnalysis) ? data.variationAnalysis : [];
    let reportReviewRequired = false;
    const variationAnalysis = rawVariationAnalysis.map((v) => {
      const validation = validateStructuredResponse({
        classification: v?.classification,
        text: v?.text || "",
        confidence: v?.confidence,
        sources: v?.sources || [],
      });
      if (!validation.valid) reportReviewRequired = true;
      return {
        label: v?.label || "",
        classification: v?.classification || "INFERENCE",
        text: v?.text || "",
        confidence: v?.confidence ?? 0.5,
        sources: v?.sources || [],
        status: validation.valid ? "OK" : "REVIEW_REQUIRED",
        review_reason: validation.valid ? null : validation.reason,
      };
    });

    // src/components/reports/ReportComparison.jsx (et l'export PDF dans
    // src/lib/exportUtils.js) lisent comparison.evolutionSummary comme un
    // texte unique — champ conservé pour ne rien casser côté UI, reconstruit
    // ici à partir des explications désormais classifiées et validées, avec
    // un avertissement visible sur celles qui n'ont pas passé le contrôle.
    const evolutionSummary = variationAnalysis
      .map((v) => (v.status === "REVIEW_REQUIRED" ? `⚠️ [À vérifier — ${v.review_reason}] ${v.text}` : v.text))
      .filter(Boolean)
      .join(" ");

    const report = await base44.entities.Report.create({
      type,
      period,
      summary: data.summary || "",
      content: data.content || "",
      sections: data.sections || {},
      chiffres,
      comparison: comparisonData
        ? {
            ...comparisonData,
            evolutionSummary,
            variationAnalysis,
            keyInsights: data.keyInsights || [],
            reviewRequired: reportReviewRequired,
          }
        : null,
    });

    return Response.json({ report, summary: data.summary, content: data.content });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
