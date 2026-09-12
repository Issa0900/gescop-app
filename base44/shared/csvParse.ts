// Deterministic CSV/TSV parsing.
// AI extraction truncates large files (it caps around a few hundred rows), which
// silently produced partial datasets and incoherent metrics. Delimited text is
// fully structured, so it must be parsed literally — never through the LLM.

import * as XLSX from "npm:xlsx@0.18.5";
import { sheetRows } from "./sheetDetect.ts";

export function parseDelimitedText(text: string): Record<string, any>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/)[0] || "";
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) || []).length,
    ";": (firstLine.match(/;/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
    "|": (firstLine.match(/\|/g) || []).length,
  };
  const delimiter = Object.keys(counts).reduce((a, b) => (counts[b] > counts[a] ? b : a), ",");
  const wb = XLSX.read(clean, { type: "string", raw: false, FS: delimiter });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Meme recuperation de la ligne d'en-tetes que pour un classeur Excel : un
  // export comptable commence souvent par un titre ("Rapport de ventes - mars"),
  // qui donnait des colonnes __EMPTY et mettait tout le fichier en quarantaine.
  // Le meme fichier passait en .xlsx et echouait en .csv.
  return sheetRows(sheet).rows;
}

export async function fetchDelimitedRows(fileUrl: string): Promise<Record<string, any>[]> {
  const resp = await fetch(fileUrl);
  const text = await resp.text();
  return parseDelimitedText(text);
}