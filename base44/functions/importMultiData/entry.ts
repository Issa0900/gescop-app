import { createFixedClientFromRequest as createClientFromRequest } from "../../shared/client.ts";
import {
  normalizeRow, normalizeKeys, isSummaryOrTotalRow, deriveFallbackIdentity, buildCompanyDictionaryIndex,
  LIGNE_BRUTE, NUMERO_LIGNE, type TraceNormalisation,
} from "../../shared/importUtils.ts";
import { REASON, motifChampManquant } from "../../shared/importStatus.ts";
import { detectEntityByName, detectEntityByHeaders, detectEntityByFieldOverlap, entiteCompatible, sheetRows, trouverLigneEntetes, estDictionnaireDeDonnees } from "../../shared/sheetDetect.ts";
import { fetchDelimitedRows, fetchMatrice } from "../../shared/csvParse.ts";
import { fetchExternalFile } from "../../shared/safeFetch.ts";
import {
  analyserFichier, appliquerPlan, planParRegles, signatureFichier, planSansRattachement, evaluerPlan,
  construireEchantillon, type PlanImport, type LigneEcartee,
} from "../../shared/importPlan.ts";
import { insertRows, missingRequired } from "../../shared/bulkInsert.ts";
import { buildBusinessContext } from "../../shared/businessContext.ts";
import { traiterLignes, champsImport, conserverFeuilleInconnue } from "../../shared/importRows.ts";
import { appliquerPreuvesEntreTables, nouveauContexteRelations } from "../../shared/preuvesTables.ts";
import { getSchema, ENTITY_SCHEMAS } from "../../shared/entitySchemas.ts";
import * as XLSX from "npm:xlsx@0.18.5";
import { calculerFormulesManquantes } from "../../shared/formules.ts";
import { apprendreDictionnaire } from "../../shared/dictionnaireDonnees.ts";

/**
 * Resolve the target entity for a sheet/file.
 *
 * `manual` is the type the user picked in the UI and it wins outright: guessing
 * from the sheet name used to override that explicit choice, so a file whose
 * name looked like something else landed in the wrong entity — or nowhere.
 * Then: name, exact header signature, and finally a best-fit score over the
 * columns, which rescues sheets that carry no recognizable id column.
 */
export function detect(label: string, headers: string[], fileGuess?: string | null, manual?: string | null, companyDictionary?: Record<string, string>) {
  if (manual) return { entity: manual, via: "manuel" };
  const byName = detectEntityByName(label);
  const byHeaders = detectEntityByHeaders(headers, companyDictionary);
  // Le nom ne l'emporte que si les colonnes peuvent reellement alimenter
  // l'entite qu'il designe. Sinon ce sont les colonnes qui decident : elles
  // decrivent le contenu, le nom ne fait que le suggerer.
  if (byName && (headers.length === 0 || entiteCompatible(byName, headers, companyDictionary))) {
    return { entity: byName, via: "nom" };
  }
  if (byHeaders) return { entity: byHeaders, via: "colonnes" };
  if (byName) return { entity: byName, via: "nom (colonnes non concluantes)" };
  const byOverlap = detectEntityByFieldOverlap(headers, companyDictionary);
  if (byOverlap) return { entity: byOverlap, via: "colonnes (approché)" };
  if (fileGuess) return { entity: fileGuess, via: "nom du fichier" };
  return { entity: null, via: null };
}

function forceTransactionColumns(plan: PlanImport): PlanImport {
  if (plan.entite !== "Transaction") return plan;
  return {
    ...plan,
    colonnes: plan.colonnes.map((col: any) => {
      const key = String(col.colonne || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_");
      if (key === "type") return { ...col, champ: "type" };
      if (key === "category" || key === "categorie") return { ...col, champ: "category" };
      return col;
    }),
  };
}

/**
 * Plan de lecture d'une feuille : memoire, puis IA, puis regles.
 *
 * L'ordre n'est pas negociable. Un plan qu'un humain a deja valide l'emporte sur
 * une nouvelle analyse : rappeler l'IA sur un fichier dont l'utilisateur a
 * corrige le rattachement risquerait de lui reproposer l'erreur qu'il vient de
 * corriger. Ailleurs l'IA est appelee a chaque fois, et les regles ne servent
 * que de filet si elle est indisponible.
 */
async function planPourFeuille(
  base44: any,
  options: { matrix: any[][]; label: string; nomFichier: string; manual?: string | null; companyDictionary?: Record<string, string> },
) {
  const { matrix, label, nomFichier, manual, companyDictionary } = options;
  const entetes = (matrix[trouverLigneEntetes(matrix)] || []).map((h: any) => String(h ?? "").trim());
  const signature = signatureFichier(entetes);

  // 1. Deja vu et valide par un humain.
  // 1. Deja vu et valide par un humain (match exact de la signature).
  try {
    const memo = await base44.entities.Import.filter(
      { plan_signature: signature, plan_confirmed: true }, "-created_date", 1,
    );
    if (memo && memo.length > 0 && memo[0].read_plan && memo[0].read_plan.colonnes) {
      const plan: PlanImport = evaluerPlan(
        forceTransactionColumns({ ...memo[0].read_plan, origine: "memoire", corrections: [] }), matrix, "humain",
      );
      if (manual) plan.entite = manual;
      return { plan, signature, refus: [] as string[], erreur: undefined as string | undefined };
    }
  } catch { /* la memoire est un confort, jamais un prerequis */ }

  // 1.5. Apprentissage croisé (mémoire globale pour rattraper les colonnes uniques)
  let mappingMemory: any[] = [];
  try {
    const allMemo = await base44.entities.Import.filter(
      { plan_confirmed: true }, "-created_date", 50,
    );
    mappingMemory = allMemo.map((m: any) => m.read_plan).filter(Boolean);
  } catch {}

  // 2. Analyse par l'IA, filet deterministe derriere.
  // Le libelle "fichier [feuille]" : le nom de la FEUILLE est une preuve du type (preuves.ts).
  const secours = planParRegles(matrix, label, manual || null, mappingMemory, companyDictionary);
  const res = await analyserFichier(
    (args) => base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: args.prompt,
      response_json_schema: args.response_json_schema,
      model: "gemini_3_8_flash",
    }),
    { matrix, nomFichier: label, entitesPossibles: Object.keys(ENTITY_SCHEMAS), planDeSecours: secours, companyDictionary },
  );
  const entiteParNom = detectEntityByName(label);
  const entetesNormalisees = entetes.map((h) => String(h).trim());
  // Le plan par regles a deja pese le nom de la feuille parmi ses preuves
  // (preuves.ts) : l'y ecraser remplacerait l'entite sans recalculer ses colonnes.
  if (res.plan.origine !== "regles" && entiteParNom && entiteCompatible(entiteParNom, entetesNormalisees)) {
    res.plan.entite = entiteParNom;
    if (entiteParNom === "Transaction") {
      // The semantic recognizer can confuse Transaction.category with type.
      // For this entity the two headers are unambiguous: preserve them before
      // the plan reaches the write phase.
      res.plan = forceTransactionColumns(res.plan);
    }
  }
  // Le type choisi explicitement par l'utilisateur n'est jamais discute.
  if (manual) res.plan.entite = manual;
  return { ...res, signature };
}

/**
 * Les lignes du fichier selon le plan — avec un filet.
 *
 * Un plan dont la ligne d'en-tetes est decalee d'un cran ne rend aucune ligne :
 * les intitules ne correspondent a rien, et l'import se solderait par « 0 ligne
 * importee » sans que personne ne sache pourquoi. Quand cela arrive alors que le
 * fichier contient manifestement des donnees, on rejoue avec les regles
 * deterministes et on le DIT dans le resultat, plutot que de rendre un echec
 * muet.
 */
function lignesSelonPlan(plan: PlanImport, matrix: any[][], nomFichier: string, entite?: string | null) {
  let rows: Record<string, any>[] = [];
  let ecartees: LigneEcartee[] = [];
  try { rows = appliquerPlan(plan, matrix, ecartees); } catch { rows = []; }
  const disponibles = Math.max(matrix.length - plan.ligne_entetes - 1 - plan.lignes_ignorees.length, 0);
  // Une ligne d'en-tetes decalee d'un cran ne rend pas toujours 0 ligne : les
  // intitules pointent alors sur de vraies donnees, qui deviennent des colonnes
  // au nom absurde produisant 1 ou 2 lignes bien formees mais illisibles. Le
  // signal fiable n'est donc pas "0 ligne" mais "aucune des colonnes decrites
  // par le plan n'a ete retrouvee dans la ligne d'en-tetes reelle".
  const entetesReelles = new Set((matrix[plan.ligne_entetes] || []).map((h: any) => String(h ?? "").trim()));
  const aucuneColonneRattachee = plan.colonnes.length > 0 && plan.colonnes.every((c) => !entetesReelles.has(c.colonne));
  if ((rows.length > 0 && !aucuneColonneRattachee) || disponibles === 0) return { rows, plan, note: "", ecartees };

  const secours = planParRegles(matrix, nomFichier, entite || plan.entite);
  let rowsSecours: Record<string, any>[] = [];
  const ecarteesSecours: LigneEcartee[] = [];
  try { rowsSecours = appliquerPlan(secours, matrix, ecarteesSecours); } catch { rowsSecours = []; }
  if (rowsSecours.length === 0) return { rows, plan, note: "", ecartees };
  return {
    rows: rowsSecours,
    plan: secours,
    ecartees: ecarteesSecours,
    note: "Le plan de lecture ne rattachait aucune ligne du fichier ; lecture automatique utilisee a la place.",
  };
}

/**
 * Les lignes ecartees de la lecture, dites a l'utilisateur. Une ligne de total
 * doit sortir des faits (sinon elle double le chiffre d'affaires) mais jamais
 * en silence : si la detection se trompe, c'est ici qu'on le voit.
 */
function noteLignesEcartees(ecartees: LigneEcartee[]): string {
  if (ecartees.length === 0) return "";
  const exemples = ecartees.slice(0, 5).map((e) => `ligne ${e.ligne} « ${e.apercu} »`).join(", ");
  return `${ecartees.length} ligne(s) de total ou ignorée(s) par le plan, exclue(s) des données : ${exemples}`
    + (ecartees.length > 5 ? "…" : "") + ".";
}

/** Matrice d'une feuille de classeur, meme forme que celle d'un fichier texte. */
function matriceDeFeuille(sheet: any): any[][] {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }) as any[][];
}

async function importRows(
  base44: any,
  entityName: string,
  rows: Record<string, any>[],
  sourceType: string,
  fileLabel: string,
  fileUrl = "",
  memoire?: { plan: PlanImport | null; signature: string; confirme: boolean },
  companyDictionary?: Record<string, string>,
  ecartees: LigneEcartee[] = [],
) {
  const importRec = await base44.entities.Import.create({
    source_type: sourceType,
    file_name: fileLabel,
    file_url: fileUrl,
    entity_type: entityName,
    status: "en_cours",
    rows_processed: 0,
    rows_quarantined: 0,
    // Le plan est enregistre avec l'import : c'est lui qui rendra le prochain
    // export du meme logiciel lisible sans rien redemander.
    read_plan: memoire?.plan || undefined,
    plan_signature: memoire?.signature || undefined,
    plan_confirmed: memoire?.confirme || false,
  });
  const t = await traiterLignes(base44, {
    importId: importRec.id, entityName, rows, sourceType, fileLabel,
    plan: memoire?.plan || null, companyDictionary, ecartees,
  });
  await base44.entities.Import.update(importRec.id, champsImport(t));
  return {
    entity: entityName,
    import_id: importRec.id,
    status: t.status,
    rows_read: rows.length + ecartees.length,
    rows: t.created,
    quarantined: t.quarantined,
    metrics: t.metrics,
    corrections_preuves: (memoire?.plan?.corrections || []).slice(0, 10),
    message: t.message,
    rateLimited: t.rateLimited,
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

    // Vocabulaire propre a cette entreprise (Company.company_dictionary) :
    // consulte en priorite, avant les tables generiques de normalizeKeys, pour
    // qu'une correction deja faite une fois ne soit plus jamais redemandee.
    // Aujourd'hui alimente uniquement par ce que l'utilisateur tape dans
    // Parametres > Dictionnaire — l'apprentissage automatique depuis une
    // correction manuelle sur l'ecran d'import reste a cabler separement.
    let companyDictionary: Record<string, string> = {};
    let entreprise: any = null;
    try {
      const companies = await base44.entities.Company.list();
      entreprise = companies?.[0] || null;
      companyDictionary = buildCompanyDictionaryIndex(companies?.[0]?.company_dictionary);
    } catch (e) {
      console.error("Lecture du dictionnaire d'entreprise impossible, poursuite sans", e);
    }

    const body = await req.json();
    const { files, entity_override, mode, plans } = body;
    // Deux temps : "analyser" lit le fichier et rend un plan sans rien ecrire ;
    // l'import n'a lieu qu'ensuite, avec le plan que l'utilisateur a valide ou
    // corrige. Un appel sans `mode` garde le comportement historique.
    const analyseSeule = mode === "analyser";
    // Les plans confirmes par l'utilisateur, indexes par libelle de feuille.
    const plansFournis: Record<string, PlanImport> = {};
    if (plans && typeof plans === "object") Object.assign(plansFournis, plans);
    if (!files || !Array.isArray(files) || files.length === 0) {
      return Response.json({ error: "files requis (tableau de {file_url, file_name})" }, { status: 400 });
    }

    const results: any[] = [];
    // Cles connues (base + feuilles deja lues dans cet envoi) pour les preuves
    // entre tables : une feuille Clients lue avant la feuille Ventes compte.
    const relations = nouveauContexteRelations();

    for (const file of files) {
      const { file_url, file_name } = file;
      const ext = (file_name || "").split(".").pop().toLowerCase();
      const sourceType = ["csv", "xlsx", "xls", "tsv", "pdf"].includes(ext) ? ext : "csv";

      // === Classeurs et fichiers texte : meme traitement, a la lecture pres ===
      if (["xlsx", "xls", "csv", "tsv"].includes(ext)) {
        try {
          const feuilles: { label: string; nomFeuille: string; matrix: any[][] }[] = [];
          // Dit une fois par fichier : des cellules calculees par GESCOP et non
          // lues telles quelles, et celles qui restent vides.
          let noteFormules = "";
          if (["xlsx", "xls"].includes(ext)) {
            const ab = await (await fetchExternalFile(file_url)).arrayBuffer();
            // sheetStubs : une formule sans resultat enregistre (classeur genere
            // par script) n'existe sinon pas du tout ; on la calcule ici.
            const wb = XLSX.read(new Uint8Array(ab), { type: "array", sheetStubs: true });
            const formules = calculerFormulesManquantes(wb);
            if (formules.calculees > 0 || formules.laissees > 0) {
              noteFormules = `${formules.calculees} cellule(s) de formule sans resultat enregistre recalculee(s) par GESCOP`
                + (formules.laissees > 0 ? ` ; ${formules.laissees} formule(s) non calculable(s) laissee(s) vide(s)` : "") + ".";
            }
            for (const sheetName of wb.SheetNames) {
              feuilles.push({ label: `${file_name} [${sheetName}]`, nomFeuille: sheetName, matrix: matriceDeFeuille(wb.Sheets[sheetName]) });
            }
          } else {
            feuilles.push({ label: file_name, nomFeuille: "", matrix: await fetchMatrice(file_url) });
          }

          for (const feuille of feuilles) {
            const { label, nomFeuille, matrix } = feuille;
            if (matrix.length === 0) {
              results.push({ file_name: label, entity: null, status: "ignore", rows_read: 0, rows: 0, message: "Feuille vide" });
              continue;
            }

            // Le plan valide par l'utilisateur, s'il nous l'a renvoye.
            const planValide = plansFournis[label];
            const analyse = planValide
              ? { plan: evaluerPlan(planValide, matrix, "humain"), signature: signatureFichier(matrix[planValide.ligne_entetes] || []), refus: [], erreur: undefined }
              : await planPourFeuille(base44, { matrix, label, nomFichier: file_name, manual: entity_override, companyDictionary });
            const plan = await appliquerPreuvesEntreTables(base44, analyse.plan, matrix, relations);

            // Un dictionnaire de donnees decrit des colonnes : ce ne sont pas
            // des faits. Conserve tel quel dans le registre, jamais importe
            // comme des ventes ou des clients.
            const entetesPlan = (matrix[plan.ligne_entetes] || []).map((h: any) => String(h ?? "").trim());
            if (!planValide && estDictionnaireDeDonnees(entetesPlan)) {
              const definitions = Math.max(matrix.length - plan.ligne_entetes - 1, 0);
              const message = `Dictionnaire de données détecté (${definitions} définition(s) de colonnes : ${entetesPlan.slice(0, 4).join(", ")}). `
                + "Il décrit des colonnes, il ne contient pas de données : rien n'est importé comme ventes ou clients.";
              if (analyseSeule) {
                results.push({ file_name: label, sheet: nomFeuille, entity: null, status: "analyse", rows_read: definitions, dictionnaire: true, message, plan: { ...plan, entite: null } });
                continue;
              }
              const conserve = await conserverFeuilleInconnue(base44, label, matrix, plan.ligne_entetes, sourceType, file_url);
              // Apprendre le sens des colonnes que GESCOP ne reconnait pas par
              // leur nom, d'apres leur description (dictionnaireDonnees.ts).
              // Jamais de reecriture d'un terme deja defini par l'entreprise.
              const appris = apprendreDictionnaire(matrix, plan.ligne_entetes, companyDictionary);
              let noteAppris = "";
              if (appris.length > 0 && entreprise?.id) {
                try {
                  const actuel = entreprise.company_dictionary && !Array.isArray(entreprise.company_dictionary) ? entreprise.company_dictionary : {};
                  const ajout = Object.fromEntries(appris.filter((a) => !(a.terme in actuel)).map((a) => [a.terme, a.champ]));
                  if (Object.keys(ajout).length > 0) {
                    await base44.entities.Company.update(entreprise.id, { company_dictionary: { ...actuel, ...ajout } });
                    entreprise.company_dictionary = { ...actuel, ...ajout };
                    Object.assign(companyDictionary, buildCompanyDictionaryIndex(ajout));
                    noteAppris = ` ${Object.keys(ajout).length} terme(s) appris dans le dictionnaire de l'entreprise : `
                      + appris.slice(0, 5).map((a) => `${a.terme} → ${a.champ}`).join(", ") + (appris.length > 5 ? "…" : "") + ".";
                  }
                } catch (e) {
                  console.error("Dictionnaire de l'entreprise non mis a jour", e);
                }
              }
              results.push({
                file_name: label, entity: null, status: "ignore", import_id: conserve.import_id, dictionnaire: true,
                rows_read: conserve.metrics.total_rows, rows: 0, metrics: conserve.metrics, termes_appris: appris,
                message: message + noteAppris + " Les définitions restent consultables dans le registre de l'import.",
              });
              continue;
            }

            if (analyseSeule) {
              const lecture = lignesSelonPlan(plan, matrix, file_name);
              const totalRows = Math.max(matrix.length - plan.ligne_entetes - 1 - (plan.lignes_ignorees?.length || 0), 0);
              
              let validCount = 0;
              let mappedCount = 0;
              let quarantinedCount = 0;
              const quarantine: any[] = [];
              const properties = getSchema(plan.entite)?.properties || null;
              const required = getSchema(plan.entite)?.required || [];

              if (plan.entite && properties) {
                for (let i = 0; i < lecture.rows.length; i++) {
                  const row = lecture.rows[i];
                  if (!row || typeof row !== "object" || isSummaryOrTotalRow(row)) continue;
                  
                  const enumIssues: { field: string; value: string; allowed: string[] }[] = [];
                  const normalized = normalizeRow(plan.entite, row, "tmp", properties, sourceType, enumIssues, undefined, companyDictionary);

                  if (Object.keys(normalized).filter(k => k !== "import_id").length === 0) {
                    continue; // Ligne vide ou total filtré : ne pas générer de faux positif en quarantaine
                  }
                  deriveFallbackIdentity(plan.entite, normalized, i);
                  mappedCount++;

                  // L'apercu doit annoncer ce que l'import fera vraiment : seule une
                  // ligne a laquelle manque un champ OBLIGATOIRE part en quarantaine.
                  // Une valeur hors liste sur un champ facultatif est seulement
                  // retiree de ce champ — la ligne est importee. Les compter en
                  // quarantaine ici annoncait des rejets qui n'avaient pas lieu.
                  const errors: string[] = [];
                  const missing = missingRequired(normalized, required);
                  if (missing.length > 0) errors.push(`Champs obligatoires manquants: ${missing.join(", ")}`);
                  enumIssues.filter((e) => missing.includes(e.field)).forEach((e) => errors.push(`Valeur refusée pour ${e.field}: "${e.value}" (acceptées: ${e.allowed.join(", ")})`));

                  if (errors.length > 0) {
                    quarantinedCount++;
                    if (quarantine.length < 50) {
                      const premier = missing[0];
                      const motif = motifChampManquant(premier, normalizeKeys(row, properties, undefined, companyDictionary, plan.entite || undefined)[premier], properties[premier], enumIssues.find((e) => e.field === premier));
                      quarantine.push({
                        rowIndex: (row as any)[NUMERO_LIGNE] ?? i + plan.ligne_entetes + 2,
                        original: (row as any)[LIGNE_BRUTE] || row, mapped: normalized, errors,
                        reason_code: motif.reason, field: premier,
                      });
                    }
                  } else {
                    validCount++;
                  }
                }
              }

              const completeness = lecture.rows.length > 0 ? (mappedCount / lecture.rows.length) * 100 : 0;
              const validity = lecture.rows.length > 0 ? (validCount / lecture.rows.length) * 100 : 0;
              const quality_score = Math.round((completeness + validity) / 2);

              results.push({
                file_name: label, sheet: nomFeuille, entity: plan.entite,
                plan, signature: analyse.signature, refus: analyse.refus, analyse_erreur: analyse.erreur,
                apercu: lecture.rows.slice(0, 5),
                echantillon: construireEchantillon(matrix, 8),
                rows_read: totalRows,
                status: "analyse",
                quality: {
                  score: quality_score || 0,
                  valid_rows: validCount,
                  total_rows: totalRows,
                  quarantined_rows: quarantinedCount,
                  quarantine_samples: quarantine
                }
              });
              continue;
            }

            // Une feuille generique ("Feuil1") ne dit rien : ses colonnes decident.
            const generic = /^(feuil|sheet|tab|page)\s*\d*$/i.test(nomFeuille.trim());
            const entetesLues = (matrix[plan.ligne_entetes] || []).map((h: any) => String(h ?? "").trim());
            let entity = plan.entite;
            let via = plan.origine;
            if (!entity) {
              const parRegles = detect(generic ? "" : (nomFeuille || file_name), entetesLues, detectEntityByName(file_name), entity_override, companyDictionary);
              entity = parRegles.entity;
              via = parRegles.via as any;
            }
            if (!entity) {
              const conserve = await conserverFeuilleInconnue(base44, label, matrix, plan.ligne_entetes, sourceType, file_url);
              results.push({
                file_name: label, entity: null, status: "quarantaine", import_id: conserve.import_id,
                rows_read: conserve.metrics.total_rows, rows: 0, quarantined: conserve.metrics.unknown_rows,
                metrics: conserve.metrics,
                message: `Type non reconnu — colonnes lues : ${entetesLues.slice(0, 6).join(", ")}. `
                  + `${conserve.conservees} ligne(s) conservée(s) telles quelles dans le registre de l'import : `
                  + `choisissez le type pour les intégrer, sans réimporter.`
                  + (conserve.erreur ? ` (${conserve.erreur})` : ""),
              });
              continue;
            }

            const lecture = lignesSelonPlan(plan, matrix, file_name, entity);
            const res = await importRows(base44, entity, lecture.rows, sourceType, label, file_url, {
              plan: lecture.plan, signature: analyse.signature, confirme: Boolean(planValide) && !lecture.note,
            }, companyDictionary, lecture.ecartees);
            if (res.rateLimited) await pause(RATE_LIMIT_COOLDOWN_MS);
            const noteFichier = noteFormules;
            noteFormules = "";
            results.push({
              file_name: label, detected_via: via,
              plan_origine: lecture.plan.origine, corrections: lecture.plan.corrections,
              ...res,
              lignes_ecartees: lecture.ecartees.length,
              message: [noteFichier, lecture.note, noteLignesEcartees(lecture.ecartees), res.message].filter(Boolean).join(" · ") || undefined,
            });
          }
        } catch (e: any) {
          results.push({ file_name, entity: null, status: "echoue", rows_read: 0, rows: 0, reason_code: REASON.TECHNICAL_PARSE_ERROR, error: e.message });
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

        const res = await importRows(base44, entityName, rows, sourceType, file_name, file_url, undefined, companyDictionary);
        if (res.rateLimited) await pause(RATE_LIMIT_COOLDOWN_MS);
        results.push({ file_name, detected_via: entity_override ? "manuel" : "nom", ...res });
      } catch (e: any) {
        results.push({ file_name, entity: entityName, status: "echoue", rows_read: 0, rows: 0, error: e.message });
      }
    }

    // En mode analyse, l'ecran de confirmation doit pouvoir proposer les champs
    // de n'importe quel type : l'utilisateur peut corriger le type detecte, et
    // la liste des champs doit suivre. On l'envoie une fois, pas par feuille.
    if (analyseSeule) {
      const champsParEntite: Record<string, string[]> = {};
      for (const [nom, schema] of Object.entries(ENTITY_SCHEMAS)) {
        champsParEntite[nom] = Object.keys(schema.properties).filter((c) => c !== "import_id");
      }
      return Response.json({ results, champs_par_entite: champsParEntite });
    }
    return Response.json({ results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
