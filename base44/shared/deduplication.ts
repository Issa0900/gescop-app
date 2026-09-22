import { generateFingerprint } from "./fingerprint.ts";

/**
 * Sur chaque ligne rendue, la ligne recue en entree (propriete non enumerable,
 * donc jamais envoyee a la base) : l'appelant retrouve ainsi d'ou vient une
 * ligne que l'insertion refuse ensuite.
 */
export const LIGNE_SOURCE = Symbol.for("gescop.ligneSource");

export async function deduplicateRows(base44: any, entityName: string, rows: any[]) {
  if (rows.length === 0) return { newRows: [], duplicateCount: 0, conflicts: 0, newCount: 0, duplicates: [] as any[] };
  
  // 1. Generate fingerprints
  const withFp = rows.map((r) => {
    const copie = { ...r, fingerprint: generateFingerprint(entityName, r) };
    Object.defineProperty(copie, LIGNE_SOURCE, { value: r, enumerable: false });
    return copie;
  });

  // 2. Fetch all existing fingerprints for deduplication
  // To avoid N^2 queries, we bulk fetch existing fingerprints. Base44 list() caps at 500.
  const existingFingerprints = new Set<string>();
  let page = 0;
  while (true) {
    const batch = await base44.entities[entityName].list("-created_date", 500, page * 500);
    if (!batch || batch.length === 0) break;
    batch.forEach((b: any) => {
      // L'empreinte enregistree ET celle que le code actuel calculerait : une
      // ligne importee avant un changement de regle d'empreinte doit toujours
      // etre reconnue au reimport du meme fichier.
      if (b.fingerprint) existingFingerprints.add(b.fingerprint);
      const fp = generateFingerprint(entityName, b);
      if (fp) existingFingerprints.add(fp);
    });
    if (batch.length < 500) break;
    page++;
    if (page > 500) break; // Supports up to 250,000 rows
  }

  const newRows: any[] = [];
  // Les lignes ecartees elles-memes, pas seulement leur nombre : chacune doit
  // pouvoir etre retrouvee dans le registre de l'import (ImportIssue).
  const duplicates: any[] = [];
  let duplicateCount = 0;

  for (const r of withFp) {
    if (existingFingerprints.has(r.fingerprint)) {
      duplicateCount++;
      duplicates.push((r as any)[LIGNE_SOURCE]);
    } else {
      newRows.push(r);
      // Pre-add to prevent duplicates within the SAME import file
      existingFingerprints.add(r.fingerprint);
    }
  }

  return { newRows, duplicateCount, conflicts: 0, newCount: newRows.length, duplicates };
}
