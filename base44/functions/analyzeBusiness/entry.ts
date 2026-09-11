import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { buildBusinessContext } from "../../shared/businessContext.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non autorisé" }, { status: 401 });

    const ctx = await buildBusinessContext(base44);
    const { company, transactions, context, totals } = ctx;

    if (!company) {
      return Response.json({ error: "Veuillez configurer votre entreprise d'abord." }, { status: 400 });
    }
    if (!transactions || transactions.length < 3) {
      return Response.json({
        error: "Données insuffisantes. Importez au moins quelques transactions avant l'analyse.",
      }, { status: 400 });
    }

    // Clear previous analysis artifacts (keep history but remove stale auto-generated ones)
    await base44.entities.Anomaly.deleteMany({});
    await base44.entities.Risk.deleteMany({});
    await base44.entities.Opportunity.deleteMany({});
    await base44.entities.Recommendation.deleteMany({ source_type: { $in: ["risk", "opportunity", "anomaly"] } });
    await base44.entities.Kpi.deleteMany({});
    await base44.entities.ExternalSignal.deleteMany({});

    const prompt = `Tu es GESCOP, un système intelligent de pilotage pour PME. Analyse les données de cette entreprise et produis un diagnostic complet.

${context}

INSTRUCTIONS
1. Calcule un score de santé global sur 100 et un score pour chacune des 9 dimensions: finance, ventes, tresorerie, clients, operations, marketing, productivite, risques, croissance. Chaque score entre 0 et 100. Pour chaque dimension donne aussi une tendance (up/down/stable) et une explication courte.
2. Détecte les anomalies: écarts par rapport à la normale (dépenses inhabituelles, baisses de ventes, montants aberrants). Pour chaque anomalie: title, description, dimension, severity (critique/important/modere/faible), deviation_pct, explanation.
3. Identifie les risques: title, description, category, probability (0-100), impact (faible/moyen/eleve), urgency (faible/moyenne/elevee), confidence (faible/moyenne/elevee), horizon, score (0-100). Calcule le score = combinaison de probabilité, impact, urgence et confiance.
4. Identifie les opportunités: title, description, category, potential (faible/moyen/eleve), probability (0-100), horizon, confidence (faible/moyenne/elevee), score (0-100).
5. Pour chaque risque et opportunité majeur, produis une recommandation structurée: title, situation (que se passe-t-il), analysis (pourquoi), impact (quel effet possible), action (que faire), priority (faible/moyenne/elevee/urgente), source_type (risk/opportunity/anomaly).
6. Sélectionne les KPI pertinents pour ce secteur, organisés en 4 domaines (finance, ventes, operations, marketing). Pour chaque KPI: name, domain, value, target, previous, trend (up/down/stable), unit.
7. Détecte des signaux externes pertinents pour cette entreprise (radar externe): title, description, family (gouvernement/economie/marche/concurrence/fournisseurs/consommateurs/actualites), relevance_score (0-100), impact (positif/neutre/negatif), source, horizon. Base-toi sur le secteur et la localisation de l'entreprise.

Réponds UNIQUEMENT avec un JSON valide respectant ce schéma. Aucun texte hors JSON.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          health_score: { type: "number" },
          dimensions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                score: { type: "number" },
                trend: { type: "string" },
                explanation: { type: "string" },
              },
            },
          },
          anomalies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                dimension: { type: "string" },
                severity: { type: "string" },
                deviation_pct: { type: "number" },
                explanation: { type: "string" },
              },
            },
          },
          risks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                category: { type: "string" },
                probability: { type: "number" },
                impact: { type: "string" },
                urgency: { type: "string" },
                confidence: { type: "string" },
                horizon: { type: "string" },
                score: { type: "number" },
              },
            },
          },
          opportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                category: { type: "string" },
                potential: { type: "string" },
                probability: { type: "number" },
                horizon: { type: "string" },
                confidence: { type: "string" },
                score: { type: "number" },
              },
            },
          },
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                situation: { type: "string" },
                analysis: { type: "string" },
                impact: { type: "string" },
                action: { type: "string" },
                priority: { type: "string" },
                source_type: { type: "string" },
              },
            },
          },
          kpis: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                domain: { type: "string" },
                value: { type: "number" },
                target: { type: "number" },
                previous: { type: "number" },
                trend: { type: "string" },
                unit: { type: "string" },
              },
            },
          },
          external_signals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                family: { type: "string" },
                relevance_score: { type: "number" },
                impact: { type: "string" },
                source: { type: "string" },
                horizon: { type: "string" },
              },
            },
          },
        },
      },
    });

    const data = typeof result === "string" ? JSON.parse(result) : result;

    // Update company health
    const dimScores = {};
    (data.dimensions || []).forEach((d) => {
      dimScores[d.name] = { score: d.score, trend: d.trend, explanation: d.explanation };
    });
    await base44.entities.Company.update(company.id, {
      health_score: data.health_score,
      dimension_scores: dimScores,
      last_analysis_date: new Date().toISOString(),
    });

    // Create anomalies
    if (data.anomalies && data.anomalies.length) {
      for (let i = 0; i < data.anomalies.length; i += 100) {
        const batch = data.anomalies.slice(i, i + 100).map((a) => ({
          title: a.title,
          description: a.description || "",
          dimension: a.dimension || "",
          severity: a.severity || "modere",
          deviation_pct: a.deviation_pct || 0,
          explanation: a.explanation || "",
          status: "nouveau",
          detected_date: new Date().toISOString().slice(0, 10),
        }));
        await base44.entities.Anomaly.bulkCreate(batch);
      }
    }

    // Create risks
    if (data.risks && data.risks.length) {
      for (let i = 0; i < data.risks.length; i += 100) {
        const batch = data.risks.slice(i, i + 100).map((r) => ({
          title: r.title,
          description: r.description || "",
          category: r.category || "",
          probability: r.probability || 50,
          impact: r.impact || "moyen",
          urgency: r.urgency || "moyenne",
          confidence: r.confidence || "moyenne",
          horizon: r.horizon || "",
          score: r.score || 50,
          status: "actif",
        }));
        await base44.entities.Risk.bulkCreate(batch);
      }
    }

    // Create opportunities
    if (data.opportunities && data.opportunities.length) {
      for (let i = 0; i < data.opportunities.length; i += 100) {
        const batch = data.opportunities.slice(i, i + 100).map((o) => ({
          title: o.title,
          description: o.description || "",
          category: o.category || "",
          potential: o.potential || "moyen",
          probability: o.probability || 50,
          horizon: o.horizon || "",
          confidence: o.confidence || "moyenne",
          score: o.score || 50,
          status: "nouvelle",
        }));
        await base44.entities.Opportunity.bulkCreate(batch);
      }
    }

    // Create recommendations
    if (data.recommendations && data.recommendations.length) {
      for (let i = 0; i < data.recommendations.length; i += 100) {
        const batch = data.recommendations.slice(i, i + 100).map((r) => ({
          title: r.title,
          situation: r.situation || "",
          analysis: r.analysis || "",
          impact: r.impact || "",
          action: r.action || "",
          priority: r.priority || "moyenne",
          source_type: r.source_type || "risk",
          status: "nouvelle",
        }));
        await base44.entities.Recommendation.bulkCreate(batch);
      }
    }

    // Create KPIs
    if (data.kpis && data.kpis.length) {
      for (let i = 0; i < data.kpis.length; i += 100) {
        const batch = data.kpis.slice(i, i + 100).map((k) => ({
          name: k.name,
          domain: k.domain || "finance",
          value: k.value || 0,
          target: k.target || 0,
          previous: k.previous || 0,
          trend: k.trend || "stable",
          unit: k.unit || "",
          period: new Date().toISOString().slice(0, 7),
        }));
        await base44.entities.Kpi.bulkCreate(batch);
      }
    }

    // Create external signals
    if (data.external_signals && data.external_signals.length) {
      for (let i = 0; i < data.external_signals.length; i += 100) {
        const batch = data.external_signals.slice(i, i + 100).map((s) => ({
          title: s.title,
          description: s.description || "",
          family: s.family || "marche",
          relevance_score: s.relevance_score || 50,
          impact: s.impact || "neutre",
          source: s.source || "",
          date: new Date().toISOString().slice(0, 10),
          status: "nouveau",
        }));
        await base44.entities.ExternalSignal.bulkCreate(batch);
      }
    }

    // Create alerts for critical items
    const alerts = [];
    (data.anomalies || []).filter((a) => a.severity === "critique").forEach((a) =>
      alerts.push({ title: a.title, message: a.description || a.explanation || "", level: "critique", category: "anomalie", status: "non_lue" })
    );
    (data.risks || []).filter((r) => (r.score || 0) >= 75).forEach((r) =>
      alerts.push({ title: r.title, message: r.description || "", level: "important", category: "risque", status: "non_lue" })
    );
    (data.opportunities || []).filter((o) => (o.score || 0) >= 75).forEach((o) =>
      alerts.push({ title: o.title, message: o.description || "", level: "info", category: "opportunite", status: "non_lue" })
    );
    if (alerts.length) {
      for (let i = 0; i < alerts.length; i += 100) {
        await base44.entities.Alert.bulkCreate(alerts.slice(i, i + 100));
      }
    }

    return Response.json({
      health_score: data.health_score,
      dimensions: data.dimensions || [],
      counts: {
        anomalies: (data.anomalies || []).length,
        risks: (data.risks || []).length,
        opportunities: (data.opportunities || []).length,
        recommendations: (data.recommendations || []).length,
        kpis: (data.kpis || []).length,
        signals: (data.external_signals || []).length,
        alerts: alerts.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}