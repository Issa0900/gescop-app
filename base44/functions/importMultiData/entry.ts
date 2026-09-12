import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { normalizeRow } from "../../shared/importUtils.ts";
import { detectEntityByName, detectEntityByHeaders, detectEntityByFieldOverlap, sheetRows } from "../../shared/sheetDetect.ts";
import { fetchDelimitedRows } from "../../shared/csvParse.ts";
import { insertRows, missingRequired } from "../../shared/bulkInsert.ts";
import { getSchema } from "../../shared/entitySchemas.ts";
import * as XLSX from "npm:xlsx@0.18.5";

/**
 * Resolve the target entity for a sheet/file.
 *
 * `manual` is the type the user picked in the UI and it wins outright: guessing
 * from the sheet name used to override that explicit choice, so a file whose
 * name looked like something else landed in the wrong entity — or nowhere.
 * Then: name, exact header signature, and finally a best-fit score over the
 * columns, which rescues sheets that carry no recognizable id column.
 */
function detect(label: string, headers: string[], fileGuess?: string | null, manual?: string | null) {
  if (manual) return { entity: manual, via: "manuel" };
  const byName = detectEntityByName(label);
  if (byName) return { entity: byName, via: "nom" };
  const byHeaders = detectEntityByHeaders(headers);
  if (byHeaders) return { entity: byHeaders, via: "colonnes" };
  const byOverlap = detectEntityByFieldOverlap(headers);
  if (byOverlap) return { entity: byOverlap, via: "colonnes (approché)" };
  if (fileGuess) return { entity: fileGuess, via: "nom du fichier" };
  return { entity: null, via: null };
}

async function importRows(
  base44: any,
  entityName: string,
  rows: Record<string, any>[],
  sourceType: string,
  fileLabel: string,
  fileUrl = "",
) {
  // Ré-importer le même fichier/feuille dupliquait chaque ligne : un fichier
  // importé 6 fois donnait 6 copies et des chiffres contradictoires partout.
  const already = await base44.entities.Import.filter({ file_name: fileLabel, entity_type: entityName }, null, 1);
  if (already && already.length > 0) {
    return {
      entity: entityName,
      status: "ignore",
      rows_read: rows.length,
      rows: 0,
      quarantined: 0,
      message: "Déjà importé — supprimez d'abord l'import existant pour le remplacer (évite les doublons).",
      rateLimited: false,
    };
  }

  const schema = getSchema(entityName);
  const properties = schema ? schema.properties : null;
  const required = schema ? schema.required : [];

  const importRec = await base44.entities.Import.create({
    source_type: sourceType,
    file_name: fileLabel,
    file_url: fileUrl,
    entity_type: entityName,
    status: "en_cours",
    rows_processed: 0,
    rows_quarantined: 0,
  });

  const toCreate: Record<string, any>[] = [];
  let quarantined = 0;
  const missingFields = new Set<string>();
  const samples: string[] = [];
  // Values present in the file but refused by the schema, counted per field and
  // per value so the report can name them instead of claiming the field is absent.
  const refusedValues: Record<string, Record<string, number>> = {};
  const allowedByField: Record<string, string[]> = {};
  rows.forEach((row) => {
    if (!row || typeof row !== "object") { quarantined++; return; }
    const enumIssues: { field: string; value: string; allowed: string[] }[] = [];
    const normalized = normalizeRow(entityName, row, importRec.id, properties, sourceType, enumIssues);
    if (Object.keys(normalized).filter((k) => k !== "import_id").length === 0) { quarantined++; return; }
    // Reject up front rather than letting one row fail its whole batch.
    const missing = missingRequired(normalized, required);
    if (missing.length > 0) {
      missing.forEach((m) => {
        // Was the field actually absent, or present with a refused value?
        const refused = enumIssues.find((e) => e.field === m);
        if (refused) {
          if (!refusedValues[m]) refusedValues[m] = {};
          refusedValues[m][refused.value] = (refusedValues[m][refused.value] || 0) + 1;
          allowedByField[m] = refused.allowed;
        } else {
          missingFields.add(m);
        }
      });
      if (samples.length < 2) samples.push(JSON.stringify(row).slice(0, 220));
      quarantined++;
      return;
    }
    toCreate.push(normalized);
  });

  const { created, quarantined: rejected, errors } = await insertRows(base44, entityName, toCreate);
  quarantined += rejected;

  const messages: string[] = [];
  // Refused values first: this is the actionable one, and it used to be
  // reported as a missing field, which sent users looking for a column that
  // was right there in their file.
  for (const [field, counts] of Object.entries(refusedValues)) {
    const listed = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([val, n]) => `« ${val} » (${n})`)
      .join(", ");
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    messages.push(
      `${field} : ${total} ligne(s) rejetée(s) pour cause de valeur non reconnue — ${listed}. `
      + `Valeurs acceptées : ${(allowedByField[field] || []).join(", ")}. `
      + `Corrigez cette colonne dans votre fichier, puis réimportez.`,
    );
  }
  if (missingFields.size > 0) {
    messages.push(`champs obligatoires absents du fichier : ${Array.from(missingFields).join(", ")}`);
    if (samples.length > 0) messages.push(`exemple de ligne rejetée : ${samples[0]}`);
  }
  if (errors.length > 0) messages.push(errors[0]);

  const quality = rows.length > 0 ? Math.round((created / rows.length) * 100) : 0;
  await base44.entities.Import.update(importRec.id, {
    status: created > 0 ? "complete" : "echoue",
    quality_score: quality,
    rows_processed: created,
    rows_quarantined: quarantined,
  });

  return {
    entity: entityName,
    status: created > 0 ? "complete" : "echoue",
    rows_read: rows.length,
    rows: created,
    quarantined,
    message: messages.join(" · ") || undefined,
    // Signals to the caller that the quota is exhausted, so the next sheet
    // should not be fired straight into the same wall.
    rateLimited: errors.some((e) => e.includes("limite de débit")),
  };
}

/**
 * Cooldown between sheets once the quota has been hit.
 *
 * Sheets are imported one after another, so a large multi-sheet workbook
 * exhausts a per-minute quota partway through and every remaining sheet then
 * fails instantly with 0 rows imported. Pausing once the limit is reached lets
 * the window refill instead of burning the rest of the workbook.
 */
const RATE_LIMIT_COOLDOWN_MS = 20000;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

      // === Excel: every sheet is processed on its own ===
      if (["xlsx", "xls"].includes(ext)) {
        try {
          const resp = await fetch(file_url);
          const ab = await resp.arrayBuffer();
          const wb = XLSX.read(new Uint8Array(ab), { type: "array" });

          for (const sheetName of wb.SheetNames) {
            const label = `${file_name} [${sheetName}]`;
            const { rows, headers } = sheetRows(wb.Sheets[sheetName]);
            if (rows.length === 0) {
              results.push({ file_name: label, entity: null, status: "ignore", rows_read: 0, rows: 0, message: "Feuille vide" });
              continue;
            }
            // A sheet named "Feuil1"/"Sheet1" carries no information: its columns decide.
            const generic = /^(feuil|sheet|tab|page)\s*\d*$/i.test(sheetName.trim());
            const { entity, via } = detect(generic ? "" : sheetName, headers, detectEntityByName(file_name), entity_override);
            if (!entity) {
              results.push({
                file_name: label,
                entity: null,
                status: "ignore",
                rows_read: rows.length,
                rows: 0,
                message: `Type non reconnu — colonnes lues : ${headers.slice(0, 6).join(", ")}`,
              });
              continue;
            }
            const res = await importRows(base44, entity, rows, sourceType, label, file_url);
            if (res.rateLimited) await pause(RATE_LIMIT_COOLDOWN_MS);
            results.push({ file_name: label, detected_via: via, ...res });
          }
        } catch (e: any) {
          results.push({ file_name, entity: null, status: "echoue", rows_read: 0, rows: 0, error: e.message });
        }
        continue;
      }

      // === CSV / TSV: parsed literally, nothing truncated ===
      if (["csv", "tsv"].includes(ext)) {
        try {
          const rows = await fetchDelimitedRows(file_url);
          const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
          const { entity, via } = detect(file_name, headers, null, entity_override);
          if (!entity) {
            results.push({
              file_name,
              entity: null,
              status: "ignore",
              rows_read: rows.length,
              rows: 0,
              message: `Type non reconnu — colonnes lues : ${headers.slice(0, 6).join(", ")}`,
            });
            continue;
          }
          const res = await importRows(base44, entity, rows, sourceType, file_name, file_url);
          if (res.rateLimited) await pause(RATE_LIMIT_COOLDOWN_MS);
          results.push({ file_name, detected_via: via, ...res });
        } catch (e: any) {
          results.push({ file_name, entity: null, status: "echoue", rows_read: 0, rows: 0, error: e.message });
        }
        continue;
      }

      // === PDF: AI extraction (no deterministic structure available) ===
      const entityName = entity_override || detectEntityByName(file_name);
      if (!entityName) {
        results.push({ file_name, entity: null, status: "ignore", rows_read: 0, rows: 0, message: "Type non reconnu — choisissez le type manuellement" });
        continue;
      }

      try {
        let extractionSchema: any;
        const entitySchema = getSchema(entityName);
        if (entitySchema) {
          extractionSchema = {
            type: "array",
            items: { type: "object", properties: entitySchema.properties, additionalProperties: true },
          };
        } else {
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

        const res = await importRows(base44, entityName, rows, sourceType, file_name, file_url);
        if (res.rateLimited) await pause(RATE_LIMIT_COOLDOWN_MS);
        results.push({ file_name, detected_via: entity_override ? "manuel" : "nom", ...res });
      } catch (e: any) {
        results.push({ file_name, entity: entityName, status: "echoue", rows_read: 0, rows: 0, error: e.message });
      }
    }

    return Response.json({ results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}