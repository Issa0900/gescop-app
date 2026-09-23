// Verite terrain des jeux publics UCI Online Retail (dossier ../DEMO/UCI),
// recalculee hors moteur (pandas) selon les regles metier de GESCOP :
//   CA net        = somme quantite x prix, lignes a prix negatif exclues (ajustements comptables)
//   avoir         = quantite ou montant negatif (factures « C… ») : reduit le CA net
//   vente         = ni avoir, ni prix negatif, montant > 0 (une ligne a 0 est un mouvement de stock)
//   commandes     = factures distinctes ayant au moins une ligne de vente
//   panier moyen  = ventes brutes / commandes ; frequence = commandes / clients identifies
//   lignes identiques d'un meme fichier : conservees et signalees (regle du 22 sept) ;
//   feuilles qui se chevauchent (Online Retail II, 1-9 dec. 2010) : la repetition est un doublon.
// Sources : https://archive.ics.uci.edu/dataset/352 et /dataset/502 (CC BY 4.0).
// Ecart connu, accepte : « Adjust bad debt » (facture A563185, +11 062,06 £) compte comme une vente.

import type { VeriteDemo } from "./verite_demo.ts";

export const VERITE_UCI: (VeriteDemo & { lent?: boolean })[] = [
  {
    fichier: "UCI/OR1_echantillon_dec2010.xlsx",
    note: "Une semaine (1-7 dec. 2010) : grain ligne d'article, avoirs « C… », 25 % sans client, 12 pays.",
    kpi: { total_revenue: 280766.48, gross_sales: 339876.49, returns_amount: 59110.01, order_count: 611, aov: 556.26, return_rate: 17.39, purchase_frequency: 1.34, employee_count: null },
    lignes: { Order: 16985 },
    sans: ["CONFLICTING_RECORD", "DUPLICATE_RECORD"],
  },
  {
    fichier: "UCI/Online Retail.xlsx",
    lent: true,
    note: "541 909 lignes d'articles, 25 900 factures, 38 pays, une seule devise (livre).",
    kpi: { total_revenue: 9769872.05, gross_sales: 10666684.54, returns_amount: 896812.49, order_count: 19960, aov: 534.4, return_rate: 8.41, purchase_frequency: 4.27 },
    lignes: { Order: 541909 },
    sans: ["CONFLICTING_RECORD"],
  },
  {
    fichier: "UCI/online_retail_II.xlsx",
    lent: true,
    note: "Deux feuilles (2009-2010, 2010-2011) qui se recouvrent du 1er au 9 dec. 2010 : 22 523 lignes repetees.",
    kpi: { total_revenue: 19068438.26, gross_sales: 20534115.49, returns_amount: 1465677.23, order_count: 40078, aov: 512.35, return_rate: 7.14, purchase_frequency: 6.29 },
    lignes: { Order: 1044848 },
    motifs: { DUPLICATE_RECORD: 22523 },
    sans: ["CONFLICTING_RECORD"],
  },
];
