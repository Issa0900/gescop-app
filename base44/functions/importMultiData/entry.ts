import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { normalizeRow } from "../../shared/importUtils.ts";

// Map file name patterns to entity names (order matters: more specific first)
const FILE_ENTITY_MAP = [
  { pattern: /campaign.*daily|marketing.*daily|daily.*campaign/i, entity: "CampaignDaily" },
  { pattern: /interaction/i, entity: "Interaction" },
  { pattern: /transaction/i, entity: "Transaction" },
  { pattern: /inventaire|inventory/i, entity: "Inventory" },
  { pattern: /order|commande/i, entity: "Order" },
  { pattern: /sale/i, entity: "Order" },
  { pattern: /customer|client/i, entity: "Customer" },
  { pattern: /product|produit/i, entity: "Product" },
  { pattern: /supplier|fournisseur/i, entity: "Supplier" },
  { pattern: /purchase|achat/i, entity: "Purchase" },
  { pattern: /campaign/i, entity: "Campaign" },
  { pattern: /employee|employe/i, entity: "Employee" },
  { pattern: /payroll|paie/i, entity: "Payroll" },
  { pattern: /expense|depense/i, entity: "Expense" },
  { pattern: /cashflow|tresorerie/i, entity: "Cashflow" },
  { pattern: /competitor|concurrent/i, entity: "Competitor" },
  { pattern: /signal|radar/i, entity: "ExternalSignal" },
  { pattern: /goal|objectif/i, entity: "Goal" },
  { pattern: /event|evenement/i, entity: "Event" },
];

function detectEntity(fileName) {
  const lower = (fileName || "").toLowerCase();
  for (const m of FILE_ENTITY_MAP) {
    if (m.pattern.test(lower)) return m.entity;
  }
  return null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { files } = body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return Response.json({ error: "files requis (tableau de {file_url, file_name})" }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      const { file_url, file_name } = file;
      const entityName = detectEntity(file_name);

      if (!entityName) {
        results.push({ file_name, entity: null, status: "ignore", rows: 0, message: "Type non reconnu" });
        continue;
      }

      try {
        const ext = (file_name || "").split(".").pop().toLowerCase();
        const sourceType = ["csv", "xlsx", "xls", "tsv", "pdf"].includes(ext) ? ext : "csv";

        const importRec = await base44.entities.Import.create({
          source_type: sourceType,
          file_name,
          file_url,
          entity_type: entityName,
          status: "en_cours",
          rows_processed: 0,
          rows_quarantined: 0,
        });

        // Get the entity's own schema so extraction targets the right fields
        let entityProperties = null;
        let extractionSchema;
        try {
          const entitySchema = await base44.entities[entityName].schema();
          entityProperties = entitySchema.properties || {};
          extractionSchema = {
            type: "array",
            items: {
              type: "object",
              properties: entityProperties,
              additionalProperties: true,
            },
          };
        } catch {
          // Fallback: generic schema
          extractionSchema = {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string" },
                description: { type: "string" },
                amount: { type: "number" },
                type: { type: "string" },
                category: { type: "string" },
              },
              additionalProperties: true,
            },
          };
        }

        const extraction = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: extractionSchema,
        });

        let rows = [];
        if (extraction && extraction.status === "success" && extraction.output) {
          const out = extraction.output;
          if (Array.isArray(out)) rows = out;
          else if (out && Array.isArray(Object.values(out)[0])) rows = Object.values(out)[0];
        }

        const toCreate = [];
        let quarantined = 0;
        rows.forEach((row) => {
          if (!row || typeof row !== "object") { quarantined++; return; }
          const normalized = normalizeRow(entityName, row, importRec.id, entityProperties, sourceType);
          toCreate.push(normalized);
        });

        let created = 0;
        for (let i = 0; i < toCreate.length; i += 200) {
          const batch = toCreate.slice(i, i + 200);
          try {
            await base44.entities[entityName].bulkCreate(batch);
            created += batch.length;
          } catch {
            // Batch failed — retry row by row to salvage valid records
            for (const row of batch) {
              try {
                await base44.entities[entityName].create(row);
                created++;
              } catch {
                quarantined++;
              }
            }
          }
        }

        const quality = rows.length > 0 ? Math.round((created / rows.length) * 100) : 0;
        await base44.entities.Import.update(importRec.id, {
          status: created > 0 ? "complete" : "echoue",
          quality_score: quality,
          rows_processed: created,
          rows_quarantined: quarantined,
        });

        results.push({ file_name, entity: entityName, status: created > 0 ? "complete" : "echoue", rows: created, quarantined });
      } catch (e) {
        results.push({ file_name, entity: entityName, status: "echoue", rows: 0, error: e.message });
      }
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}