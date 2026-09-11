import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { buildBusinessContext } from "../../shared/businessContext.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { type } = body;
    if (!type) return Response.json({ error: "type requis" }, { status: 400 });

    const ctx = await buildBusinessContext(base44);
    if (!ctx.company) {
      return Response.json({ error: "Configurez votre entreprise d'abord." }, { status: 400 });
    }

    const now = new Date();
    const period = type === "quotidien"
      ? now.toLocaleDateString("fr-CA")
      : type === "hebdomadaire"
      ? `semaine du ${now.toLocaleDateString("fr-CA")}`
      : now.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });

    const reportSpecs = {
      quotidien: `Génère le rapport quotidien: résumé de l'état général, évolution et événements importants; performance en ventes, finance et opérations; principaux risques et opportunités; actualité externe pertinente; 3 à 5 actions prioritaires; automatisations disponibles.`,
      hebdomadaire: `Génère le rapport hebdomadaire: compare la semaine actuelle, la semaine précédente et la tendance historique sur la performance, les KPI, les anomalies, les risques, les opportunités, le marché, la concurrence, les actions réalisées, les actions restantes et les recommandations.`,
      mensuel: `Génère le rapport mensuel: approfondit les résultats financiers, les ventes, les clients, le marketing, les opérations, la trésorerie, la productivité, les risques, les opportunités et l'évolution externe. Termine par un résumé exécutif automatique.`,
    };

    const prompt = `Tu es GESCOP. ${reportSpecs[type] || reportSpecs.quotidien}

${ctx.context}

Réponds avec un JSON contenant: summary (résumé exécutif en 2-3 phrases), content (le rapport complet en markdown bien structuré avec titres et sections), sections (un objet où chaque clé est un nom de section et la valeur est le contenu de cette section).`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          content: { type: "string" },
          sections: { type: "object" },
        },
      },
    });

    const data = typeof result === "string" ? JSON.parse(result) : result;

    const report = await base44.entities.Report.create({
      type,
      period,
      summary: data.summary || "",
      content: data.content || "",
      sections: data.sections || {},
    });

    return Response.json({ report, summary: data.summary, content: data.content });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}