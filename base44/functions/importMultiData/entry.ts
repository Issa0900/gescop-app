import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { normalizeRow } from "../../shared/importUtils.ts";
import * as XLSX from "npm:xlsx@0.18.5";

// Map sheet names / file names to entity names (order matters: more specific first)
const NAME_ENTITY_MAP = [
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
  { pattern: /campaign|campagne/i, entity: "Campaign" },
  { pattern: /employee|employe/i, entity: "Employee" },
  { pattern: /payroll|paie/i, entity: "Payroll" },
  { pattern: /expense|depense/i, entity: "Expense" },
  { pattern: /cashflow|tresorerie/i, entity: "Cashflow" },
  { pattern: /competitor|concurrent/i, entity: "Competitor" },
  { pattern: /signal|radar/i, entity: "ExternalSignal" },
  { pattern: /goal|objectif/i, entity: "Goal" },
  { pattern: /event|evenement/i, entity: "Event" },
];

function detectEntity(name: string): string | null {
  const lower = (name || "").toLowerCase();
  for (const m of NAME_ENTITY_MAP) {
    if (m.pattern.test(lower)) return m.entity;
  }
  return null;
}

const schemaCache: Record<string, any> = {};

async function getEntityProperties(base44: any, entityName: string) {
  if (schemaCache[entityName] !== undefined) return schemaCache[entityName];
  try {
    const schema = await base44.entities[entityName].schema();
    schemaCache[entityName] = schema.properties || {};
  } catch {
    schemaCache[entityName] = null;
  }
  return schemaCache[entityName];
}

async function importRows(
  base44: any,
  entityName: string,
  rows: Record<string, any>[],
  sourceType: string,
  fileLabel: string
) {
  const properties = await getEntityProperties(base44, entityName);

  const importRec = await base44.entities.Import.create({
    source_type: sourceType,
    file_name: fileLabel,
    file_url: "",
    entity_type: entityName,
    status: "en_cours",
    rows_processed: 0,
    rows_quarantined: 0,
  });

  const toCreate: Record<string, any>[] = [];
  let quarantined = 0;
  rows.forEach((row) => {
    if (!row || typeof row !== "object") { quarantined++; return; }
    const normalized = normalizeRow(entityName, row, importRec.id, properties, sourceType);
    toCreate.push(normalized);
  });

  let created = 0;
  for (let i = 0; i < toCreate.length; i += 200) {
    const batch = toCreate.slice(i, i + 200);
    try {
      await base44.entities[entityName].bulkCreate(batch);
      created += batch.length;
    } catch {
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

  return { entity: entityName, status: created > 0 ? "complete" : "echoue", rows: created, quarantined };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { files, entity_override } = body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return Response.json({ error: "files requis (tableau de {file_url, file_name})" }, { status: 400 });
    }

    const results: any[] = [];

    for (const file of files) {
      const { file_url, file_name } = file;
      const ext = (file_name || "").split(".").pop().toLowerCase();
      const sourceType = ["csv", "xlsx", "xls", "tsv", "pdf"].includes(ext) ? ext : "csv";

      // === Excel files: parse sheet-by-sheet for multi-sheet support ===
      if (["xlsx", "xls"].includes(ext)) {
        try {
          const resp = await fetch(file_url);
          const ab = await resp.arrayBuffer();
          const wb = XLSX.read(new Uint8Array(ab), { type: "array" });
          const sheetNames = wb.SheetNames;
          const hasMultipleSheets = sheetNames.length > 1;

          if (hasMultipleSheets && !entity_override) {
            // Multi-sheet workbook: detect entity per sheet name
            for (const sheetName of sheetNames) {
              const entityName = detectEntity(sheetName);
              if (!entityName) {
                results.push({
                  file_name: `${file_name} [${sheetName}]`,
                  entity: null,
                  status: "ignore",
                  rows: 0,
                  message: `Feuille "${sheetName}" non reconnue`,
                });
                continue;
              }
              const sheet = wb.Sheets[sheetName];
              const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
              const res = await importRows(base44, entityName, rows, sourceType, `${file_name} [${sheetName}]`);
              results.push({ file_name: `${file_name} [${sheetName}]`, ...res });
            }
          } else {
            // Single sheet or manual override: process as one entity
            const entityName = entity_override || detectEntity(file_name) || detectEntity(sheetNames[0]);
            if (!entityName) {
              results.push({
                file_name,
                entity: null,
                status: "ignore",
                rows: 0,
                message: "Type non reconnu — choisissez le type manuellement",
              });
              continue;
            }
            // Collect rows from all sheets (in case data spans multiple sheets of same type)
            const allRows: Record<string, any>[] = [];
            for (const sheetName of sheetNames) {
              const sheet = wb.Sheets[sheetName];
              allRows.push(...XLSX.utils.sheet_to_json(sheet, { defval: "" }));
            }
            const res = await importRows(base44, entityName, allRows, sourceType, file_name);
            results.push({ file_name, ...res });
          }
        } catch (e: any) {
          results.push({ file_name, entity: null, status: "echoue", rows: 0, error: e.message });
        }
        continue;
      }

      // === CSV, TSV, PDF: use AI extraction (single entity per file) ===
      const entityName = entity_override || detectEntity(file_name);
      if (!entityName) {
        results.push({
          file_name,
          entity: null,
          status: "ignore",
          rows: 0,
          message: "Type non reconnu — choisissez le type manuellement",
        });
        continue;
      }

      try {
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

        let rows: any[] = [];
        if (extraction && extraction.status === "success" && extraction.output) {
          const out = extraction.output;
          if (Array.isArray(out)) rows = out;
          else if (out && Array.isArray(Object.values(out)[0])) rows = Object.values(out)[0] as any[];
        }

        const res = await importRows(base44, entityName, rows, sourceType, file_name);
        results.push({ file_name, ...res });
      } catch (e: any) {
        results.push({ file_name, entity: entityName, status: "echoue", rows: 0, error: e.message });
      }
    }

    return Response.json({ results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}