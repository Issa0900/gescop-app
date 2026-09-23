// Banc de robustesse : les corrections doivent tenir sur des fichiers que l'on
// n'a jamais vus, pas seulement sur les 27 du dossier DEMO.
//
// Chaque fichier de reference est DEFORME automatiquement (casse, separateurs,
// suffixes de devise, ordre des colonnes, ligne de titre, en-tetes traduits en
// anglais, CSV francais point-virgule / virgule decimale, dates ecrites en
// texte), puis importe par le vrai importMultiData. Chaque variante doit
// retrouver EXACTEMENT les memes chiffres que la verite terrain du fichier
// (verite_demo.ts). Une variante qui echoue designe une regle trop specifique.
//
// Usage : node tests/banc/lancer-demo.cjs robustesse [filtre]  (voir lancer-demo.cjs)

import * as XLSX from "npm:xlsx@0.18.5";
import { importer, classeur } from "./outils.ts";
import { calculerFormulesManquantes } from "../../base44/shared/formules.ts";
import { computeKpiBatch } from "../../src/lib/core/kpiEngine.js";
import { buildKpiDataset, ENTITES_KPI } from "../../src/lib/core/kpiDataset.js";
import { VERITE_DEMO } from "./verite_demo.ts";
import { VERITE_UCI } from "./verite_uci.ts";

declare const require: any;
declare const process: any;
const fs = require("fs");
const path = require("path");
const DEMO = path.resolve("..", "DEMO");

type Matrice = any[][];
type Feuilles = Record<string, Matrice>;

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const mots = (h: string) => sansAccents(String(h)).split(/[^A-Za-z0-9%$]+/).filter(Boolean);

// Traduction mot a mot (FR -> EN) : l'ordre des mots reste francais, comme
// dans beaucoup d'exports « traduits » ; le lexique doit s'en accommoder.
const FR_EN: Record<string, string> = {
  date: "date", quantite: "quantity", qte: "qty", prix: "price", unitaire: "unit", cout: "cost", couts: "costs",
  total: "total", totale: "total", totales: "total", sous: "sub", client: "customer", clients: "customers", produit: "product",
  nom: "name", commande: "order", remise: "discount", taxe: "tax", taxes: "taxes", federale: "federal",
  provinciale: "provincial", benefice: "profit", brut: "gross", marge: "margin", mode: "method", paiement: "payment",
  succursale: "branch", statut: "status", livraison: "delivery", employe: "employee", departement: "department",
  categorie: "category", montant: "amount", fournisseur: "supplier", depense: "spend", depenses: "expenses",
  ventes: "sales", vente: "sale", achat: "purchase", achats: "purchases", valeur: "value", stock: "stock",
  entrepot: "warehouse", solde: "balance", ouverture: "opening", cloture: "closing", entrees: "inflows",
  sorties: "outflows", fonds: "cash", flux: "flow", net: "net", comptes: "accounts", campagne: "campaign",
  clics: "clicks", nouveaux: "new", budget: "budget", revenu: "revenue", salaire: "salary", annuel: "annual",
  taux: "rate", horaire: "hourly", heures: "hours", hebdo: "weekly", embauche: "hire", charges: "charges",
  sociales: "social", employeur: "employer", semaine: "week", periode: "period", ventes_totales: "total_sales",
};
const traduire = (h: string) => mots(h).map((m) => FR_EN[m.toLowerCase()] ?? m).join(" ");
// Sens inverse (EN -> FR) pour les exports anglais (UCI Online Retail) ; casse
// chameau decoupee d'abord (« InvoiceNo » -> « facture No »).
const EN_FR: Record<string, string> = {
  // Premiere traduction francaise de chaque mot anglais (« total » -> « total », pas « totales »).
  ...Object.fromEntries(Object.entries(FR_EN).reverse().map(([fr, en]) => [en, fr])),
  invoice: "facture", no: "no", code: "code", description: "designation", country: "pays", customer: "client",
  unit: "unitaire", price: "prix", quantity: "quantite", date: "date", id: "id", stock: "stock",
};
const traduireFr = (h: string) => mots(String(h).replace(/([a-z0-9])([A-Z])/g, "$1 $2")).map((m) => EN_FR[m.toLowerCase()] ?? m).join(" ");

const estDateISO = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
const estSerieDate = (h: string, v: any) => typeof v === "number" && v > 30000 && v < 60000 && /date|jour|day|periode|semaine|embauche|livraison/i.test(sansAccents(h));
function versJJMM(v: any, us = false): any {
  let d: Date | null = null;
  if (estDateISO(v)) d = new Date(String(v).slice(0, 10) + "T00:00:00Z");
  else if (typeof v === "number") d = new Date(Math.round((v - 25569) * 86400000));
  if (!d || isNaN(d.getTime())) return v;
  const j = String(d.getUTCDate()).padStart(2, "0"), m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return us ? `${m}/${j}/${d.getUTCFullYear()}` : `${j}/${m}/${d.getUTCFullYear()}`;
}

/** Transforme l'en-tete (ligne detectee = premiere ligne ayant au moins 3 cellules remplies). */
function ligneEntetes(m: Matrice): number {
  return Math.max(0, m.findIndex((r) => (r || []).filter((c) => String(c ?? "").trim() !== "").length >= 3));
}
function surEntetes(f: Feuilles, t: (h: string, colNumerique: boolean) => string): Feuilles {
  const out: Feuilles = {};
  for (const [n, m] of Object.entries(f)) {
    const l = ligneEntetes(m);
    const copie = m.map((r) => [...(r || [])]);
    copie[l] = (copie[l] || []).map((h, i) => {
      if (String(h ?? "").trim() === "") return h;
      const num = m.slice(l + 1, l + 20).some((r) => typeof (r || [])[i] === "number");
      return t(String(h), num);
    });
    out[n] = copie;
  }
  return out;
}
function surValeurs(f: Feuilles, t: (h: string, v: any) => any): Feuilles {
  const out: Feuilles = {};
  for (const [n, m] of Object.entries(f)) {
    const l = ligneEntetes(m);
    const h = m[l] || [];
    out[n] = m.map((r, i) => (i <= l ? [...(r || [])] : (r || []).map((v, j) => t(String(h[j] ?? ""), v))));
  }
  return out;
}

const VARIANTES: Record<string, (f: Feuilles) => Feuilles> = {
  "original": (f) => f,
  "MAJUSCULES": (f) => surEntetes(f, (h) => sansAccents(h).toUpperCase()),
  "snake_case": (f) => surEntetes(f, (h) => mots(h).join("_").toLowerCase()),
  "CamelCase": (f) => surEntetes(f, (h) => mots(h).map((m) => m[0].toUpperCase() + m.slice(1).toLowerCase()).join("")),
  "suffixe devise": (f) => surEntetes(f, (h, num) => (num && !/id|qte|quant|nb|taux|%|clic|impression|conversion|point|heure|jour|stock|date|periode|semaine/i.test(sansAccents(h)) ? `${h} (CAD)` : h)),
  "titre + colonnes melangees": (f) => {
    const out: Feuilles = {};
    for (const [n, m] of Object.entries(f)) {
      const l = ligneEntetes(m);
      const larg = Math.max(...m.map((r) => (r || []).length));
      const ordre = [...Array(larg).keys()].sort((a, b) => ((a * 7919) % 13) - ((b * 7919) % 13));
      const perm = (r: any[]) => ordre.map((i) => (r || [])[i] ?? "");
      out[n] = [["Rapport exporte le 2026-09-23 — Donnees confidentielles"], [], ...m.slice(l).map(perm)];
    }
    return out;
  },
  "en-tetes anglais": (f) => surEntetes(f, traduire),
  "en-tetes francais": (f) => surEntetes(f, traduireFr),
  "dates en texte JJ/MM/AAAA": (f) => surValeurs(f, (h, v) => (estDateISO(v) || estSerieDate(h, v) ? versJJMM(v) : v)),
};

/** CSV francais : point-virgule, virgule decimale (fichiers d'une seule feuille). */
function csvFrancais(m: Matrice): ArrayBuffer {
  const cell = (v: any) => {
    let s = typeof v === "number" ? String(v).replace(".", ",") : String(v ?? "");
    if (/[;"\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const txt = m.map((r) => (r || []).map(cell).join(";")).join("\n");
  return new TextEncoder().encode(txt).buffer as ArrayBuffer;
}

function lireFichier(chemin: string): { feuilles: Feuilles; csv: boolean } {
  const buf = fs.readFileSync(chemin);
  if (/\.csv$/i.test(chemin)) {
    const wb = XLSX.read(buf.toString("utf8"), { type: "string", raw: true });
    return { feuilles: { [wb.SheetNames[0]]: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true }) as Matrice }, csv: true };
  }
  const wb = XLSX.read(buf, { type: "buffer", sheetStubs: true });
  calculerFormulesManquantes(wb);
  const feuilles: Feuilles = {};
  for (const n of wb.SheetNames) feuilles[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "", raw: true }) as Matrice;
  return { feuilles, csv: false };
}

function kpiPage(tables: Record<string, any[]>, ids: string[]) {
  const data: Record<string, any[]> = {};
  for (const [cle, entite] of ENTITES_KPI) if (tables[entite]) data[cle] = tables[entite];
  const { records, semantics } = buildKpiDataset(data);
  const res = computeKpiBatch(ids, records, semantics);
  return Object.fromEntries(ids.map((id) => [id, (res as any).get(id)?.value ?? null]));
}
const proche = (a: number | null, b: number | null) => (b === null ? a === null : a !== null && Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 0.002));

const FICHIERS = [
  "Nordik_PleinAir_Donnees_Complet_2026.xlsx", "GESCOP.xlsx", "Entreprise_Simulation_50Ans_Canada_QC.xlsx",
  "Simulation_Entreprise_Quebec_3Ans_Complet.xlsx", "GESCOP_Donnees_Test_Xplorer_3Mois.xlsx",
  "DS01_succursales_6mois.xlsx", "DS02_commandes_ecommerce_6mois.xlsx", "DS03_marketing_6mois.xlsx",
  "E-Commerce Sales Analytics.csv", "Sample - Superstore.csv", "UCI/OR1_echantillon_dec2010.xlsx",
];

(async () => {
  const filtre = process.argv[3] || "";
  const log = console.log;
  const bruit = [console.warn, console.error];
  console.warn = () => {}; console.error = () => {};
  const bilan: { fichier: string; variante: string; ok: number; total: number; echecs: string[] }[] = [];
  for (const nom of FICHIERS) {
    if (filtre && !filtre.split(",").some((f: string) => nom.includes(f))) continue;
    const v = [...VERITE_DEMO, ...VERITE_UCI].find((x) => x.fichier === nom);
    if (!v) continue;
    const { feuilles, csv } = lireFichier(path.join(DEMO, nom));
    const variantes: [string, ArrayBuffer, string][] = Object.entries(VARIANTES).map(([n, t]) => {
      const f = t(feuilles);
      const base = path.basename(nom);
      return [n, csv ? csvFrancaisOuAnglais(f) : classeur(f), csv ? base : base.replace(/\.csv$/i, ".xlsx")];
    });
    if (Object.keys(feuilles).length === 1) {
      variantes.push(["CSV francais ; et virgule decimale", csvFrancais(Object.values(feuilles)[0]), path.basename(nom).replace(/\.(xlsx|csv)$/i, "") + ".csv"]);
    }
    for (const [variante, contenu, nomFichier] of variantes) {
      const { tables, results } = await importer(nomFichier, contenu);
      if (process.env.DETAIL && (!process.env.VARIANTE || variante === process.env.VARIANTE)) {
        for (const r of results) log(`   [${variante}] ${r.file_name} -> ${r.entity} ${r.rows}/${r.rows_read} ${(r.message || r.error || "").slice(0, 400)}`);
      }
      const ids = Object.keys(v.kpi || {});
      const k = kpiPage(tables, ids);
      const echecs: string[] = [];
      let total = 0;
      for (const id of ids) { total++; if (!proche(k[id], v.kpi![id])) echecs.push(`${id} ${k[id] === null ? "null" : Math.round(k[id] * 100) / 100} (attendu ${v.kpi![id]})`); }
      for (const [ent, n] of Object.entries(v.lignes || {})) { total++; const app = (tables[ent] || []).length; if (app !== n) echecs.push(`${ent} ${app} lignes (attendu ${n})`); }
      bilan.push({ fichier: nom, variante, ok: total - echecs.length, total, echecs });
    }
  }
  [console.warn, console.error] = bruit;
  log(`\n=== Banc de robustesse ===`);
  let ok = 0, total = 0, variantesOk = 0;
  for (const b of bilan) {
    ok += b.ok; total += b.total; if (!b.echecs.length) variantesOk++;
    log(`${b.echecs.length ? "KO" : "ok"}  ${b.fichier.padEnd(48)} ${b.variante.padEnd(36)} ${b.ok}/${b.total}${b.echecs.length ? "  — " + b.echecs.slice(0, 4).join(" ; ") : ""}`);
  }
  log(`\nTOTAL : ${variantesOk}/${bilan.length} variantes entierement justes, ${ok}/${total} controles`);
  const dossier = path.join("tests", "banc", "resultats");
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, "robustesse.json"), JSON.stringify({ variantesOk, variantes: bilan.length, ok, total, bilan }, null, 1));
})();

// Variante d'un fichier CSV : reecrit en CSV (virgule) pour garder la nature « CSV ».
function csvFrancaisOuAnglais(f: Feuilles): ArrayBuffer {
  const m = Object.values(f)[0];
  const cell = (v: any) => { let s = String(v ?? ""); if (/[,"\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`; return s; };
  return new TextEncoder().encode(m.map((r) => (r || []).map(cell).join(",")).join("\n")).buffer as ArrayBuffer;
}
