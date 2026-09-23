import { generateFingerprint, empreinteForte } from "./fingerprint.ts";

/**
 * Sur chaque ligne rendue, la ligne recue en entree (propriete non enumerable,
 * donc jamais envoyee a la base) : l'appelant retrouve ainsi d'ou vient une
 * ligne que l'insertion refuse ensuite.
 */
export const LIGNE_SOURCE = Symbol.for("gescop.ligneSource");

/**
 * Deduplication, selon une regle metier explicite (decision du 22 sept 2026) :
 *
 * - Un doublon n'est EXCLU que s'il est prouve :
 *     • par un identifiant metier (meme n° de commande + produit, meme code
 *       client, meme SKU...) — empreinte « forte » ;
 *     • ou parce que la ligne a deja ete importee (reimport du meme fichier) :
 *       la k-ieme occurrence d'une ligne n'est un doublon que si la base en
 *       contient deja au moins k.
 * - Deux lignes strictement identiques SANS identifiant dans un meme fichier
 *   (deux ventes de pain a 4,75 $ le meme jour) peuvent etre deux faits reels :
 *   elles sont CONSERVEES, et la repetition est signalee comme doublon
 *   potentiel (`potentialDuplicates`) a verifier. Les exclure d'office divisait
 *   les ventes par deux sans preuve.
 */
/**
 * Contenu metier d'une ligne, pour distinguer un doublon (meme identifiant,
 * memes valeurs) d'un CONFLIT (meme identifiant, valeurs differentes).
 */
const TECHNIQUES = new Set(["import_id", "fingerprint", "original_data", "id", "created_date", "updated_date", "created_by_id", "created_by", "import_date", "reference_date", "reference_date_type"]);
export function contenuMetier(r: any): string {
  const out: Record<string, any> = {};
  for (const k of Object.keys(r || {}).sort()) {
    if (TECHNIQUES.has(k) || k.startsWith("_")) continue;
    const v = r[k];
    if (v === undefined || v === null || v === "" || /^AUTO-/.test(String(v))) continue;
    out[k] = typeof v === "number" ? Math.round(v * 100) / 100 : String(v).trim();
  }
  return JSON.stringify(out);
}

export async function deduplicateRows(base44: any, entityName: string, rows: any[]) {
  const vide = { newRows: [] as any[], duplicateCount: 0, conflicts: 0, newCount: 0, duplicates: [] as any[], potentialDuplicates: [] as { row: any; premiere: any }[], conflits: [] as { row: any; existant: any }[] };
  if (rows.length === 0) return vide;

  // 1. Generate fingerprints
  const withFp = rows.map((r) => {
    const copie = { ...r, fingerprint: generateFingerprint(entityName, r) };
    Object.defineProperty(copie, LIGNE_SOURCE, { value: r, enumerable: false });
    return copie;
  });

  // 2. Ce qui est deja en base : les cles metier (ensemble) et, pour les lignes
  //    sans cle metier, le NOMBRE d'occurrences de chaque empreinte.
  // To avoid N^2 queries, we bulk fetch existing fingerprints. Base44 list() caps at 500.
  const fortes = new Set<string>();
  // Contenu de la ligne deja retenue pour chaque identifiant : un identifiant
  // repete avec d'autres valeurs n'est pas un doublon mais un conflit.
  const contenuParCle = new Map<string, { contenu: string; ligne: any }>();
  const occurrencesEnBase = new Map<string, number>();
  let page = 0;
  while (true) {
    const batch = await base44.entities[entityName].list("-created_date", 500, page * 500);
    if (!batch || batch.length === 0) break;
    batch.forEach((b: any) => {
      const fp = generateFingerprint(entityName, b) || b.fingerprint;
      if (empreinteForte(entityName, b)) {
        // L'empreinte enregistree ET celle que le code actuel calculerait : une
        // ligne importee avant un changement de regle d'empreinte doit toujours
        // etre reconnue au reimport du meme fichier.
        if (b.fingerprint) fortes.add(b.fingerprint);
        if (fp) fortes.add(fp);
        const c = { contenu: contenuMetier(b), ligne: b };
        if (b.fingerprint && !contenuParCle.has(b.fingerprint)) contenuParCle.set(b.fingerprint, c);
        if (fp && !contenuParCle.has(fp)) contenuParCle.set(fp, c);
      } else if (fp) {
        occurrencesEnBase.set(fp, (occurrencesEnBase.get(fp) || 0) + 1);
      }
    });
    if (batch.length < 500) break;
    page++;
    if (page > 500) break; // Supports up to 250,000 rows
  }

  const newRows: any[] = [];
  // Les lignes ecartees elles-memes, pas seulement leur nombre : chacune doit
  // pouvoir etre retrouvee dans le registre de l'import (ImportIssue).
  const duplicates: any[] = [];
  // Meme identifiant metier, valeurs differentes : ni importee (la premiere
  // version reste), ni jetee comme doublon — conservee dans le registre comme
  // conflit a trancher (Xplorer_Succes : deux jeux de 500 produits, clients,
  // fournisseurs, tresorerie sous les memes identifiants).
  const conflits: { row: any; existant: any }[] = [];
  const potentialDuplicates: { row: any; premiere: any }[] = [];
  const occurrencesFichier = new Map<string, number>();
  const premiereOccurrence = new Map<string, any>();

  for (const r of withFp) {
    const source = (r as any)[LIGNE_SOURCE];
    if (empreinteForte(entityName, r)) {
      if (fortes.has(r.fingerprint)) {
        const deja = contenuParCle.get(r.fingerprint);
        if (deja && deja.contenu !== contenuMetier(r)) conflits.push({ row: source, existant: deja.ligne });
        else duplicates.push(source);
      } else {
        newRows.push(r);
        fortes.add(r.fingerprint);
        contenuParCle.set(r.fingerprint, { contenu: contenuMetier(r), ligne: source });
      }
      continue;
    }
    const k = (occurrencesFichier.get(r.fingerprint) || 0) + 1;
    occurrencesFichier.set(r.fingerprint, k);
    if (!premiereOccurrence.has(r.fingerprint)) premiereOccurrence.set(r.fingerprint, source);
    if (k <= (occurrencesEnBase.get(r.fingerprint) || 0)) {
      // Deja importee : reimport du meme fichier.
      duplicates.push(source);
    } else {
      newRows.push(r);
      if (k > 1) potentialDuplicates.push({ row: source, premiere: premiereOccurrence.get(r.fingerprint) });
    }
  }

  return { newRows, duplicateCount: duplicates.length, conflicts: conflits.length, newCount: newRows.length, duplicates, potentialDuplicates, conflits };
}
