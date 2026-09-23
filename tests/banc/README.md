# Banc de reconnaissance et de récupération

Mesure ce que le pipeline d'import fait réellement des données (directives §20, §24, §25).
Chaque cas de `cas.ts` est un classeur `.xlsx` qui traverse le **vrai** point d'entrée
`base44/functions/importMultiData/entry.ts`, contre un faux client Base44 en mémoire
(`outils.ts` ; IA indisponible, donc plan de secours par règles, sauf si le cas fournit
`reponse_ia`). Les deux classeurs réels du dossier parent sont aussi importés, sans vérité
terrain : leurs lignes et leurs sommes par champ numérique servent de contrôle de
non-régression. `reprise.ts` rejoue ensuite des scénarios de **retraitement sans réimport**
(`base44/functions/reprocessImport`) sur la même base en mémoire.

## Lancer

```bash
npm run test:banc                      # mesure, et compare à resultats/avant.json
node tests/banc/lancer.cjs avant       # enregistre une nouvelle référence
BANC_DETAILS=1 npm run test:banc       # + le rapport d'import de chaque cas
npm test                               # tests unitaires (node --test, avec le chargeur npm:)
```

`resultats/avant.json` a été produit avec le code d'**origine** (avant le chantier du
22 septembre 2026) : la comparaison montre donc le gain cumulé.

## Colonnes du banc d'import

| Colonne | Sens | Cible |
|---|---|---|
| `impo.` | lignes écrites en base | le plus haut possible |
| `quar.` | lignes déclarées écartées par le rapport (doublons compris) | seulement les vraies erreurs |
| `PERDU` | lignes de données ni importées ni déclarées : disparues sans trace | **0** |
| `INVENT` | valeurs fabriquées dans les lignes écrites (date du jour, `ORD-…`) | **0** |
| `BRUT-` | lignes dont `original_data` a perdu une colonne brute attendue | **0** |
| `S/TRACE` | lignes non importées **et** absentes du registre `ImportIssue` : irrécupérables sans réimport | **0** |
| `MAL-LU` | mauvais type de feuille, ou valeur d'une colonne clé dans le mauvais champ | **0** |
| `NON-SIGNALE` | éléments attendus absents du rapport (valeur repliée, colonne ignorée, relation vérifiée…) | vide |

`hypotheses` (classeurs réels) compte les dates d'inventaire supposées égales à la date
d'import : un choix assumé pour un instantané de stock, compté à part.

## Colonnes du banc de retraitement

| Colonne | Sens |
|---|---|
| `récup.` | lignes du registre intégrées par `reprocessImport` |
| `avant→après` | lignes de l'entité cible avant / après le retraitement |
| `doublons` | lignes créées en trop par un second retraitement (doit rester 0) |
| `simu-écrit` | écritures faites en mode `simuler` (doit rester 0) |

## Ajouter un cas

Une entrée dans `CORPUS` (`cas.ts`) avec la vérité terrain : `donnees`, `colonnes_brutes`,
`signaler`, et `attendu` (type de chaque feuille, champ attendu pour les colonnes clés).
Puis relancer.

## Référence (22 septembre 2026, 24 cas, 82 lignes de données)

| | Code d'origine | Après le chantier |
|---|---|---|
| Lignes importées | 42 | 74 |
| Lignes écartées | 36 | 8 (toutes justifiées) |
| Irrécupérables sans réimport | 40 | 0 |
| Erreurs d'interprétation | 16 | 0 |
| Valeurs inventées | 6 | 0 |
| Anomalies non signalées | 11 | 0 |
| Nordik, feuille Ventes | `Customer`, 121 lignes | `Order`, 1 200/1 200, CA 381 048 $ |

## Banc DEMO (vérité terrain des fichiers réels) — 23 septembre 2026

`npm run test:demo` importe les fichiers du dossier `../DEMO` par le vrai `importMultiData`,
calcule les KPI **comme la page Indicateurs** (`src/lib/core/kpiDataset.js`, partagé avec
`useKpiEngine`) et compare chaque chiffre à `verite_demo.ts`, recalculé directement depuis
les fichiers (hors moteur). `node tests/banc/lancer-demo.cjs <etiquette> "<fichier1>,<fichier2>"`
filtre ; `COHERENCE=1` affiche aussi les contrôles de la page Audit.
Référence : `resultats/demo-avant.json` (code du 22 sept) — **29/76 → 76/76 contrôles justes**.

## Banc de robustesse

`npm run test:robustesse` déforme automatiquement 10 fichiers de référence (majuscules,
snake_case, CamelCase, suffixes de devise, colonnes mélangées + ligne de titre, en-têtes
traduits en anglais, dates en texte JJ/MM/AAAA, CSV français `;` + virgule décimale) et exige
**les mêmes chiffres** que la vérité terrain. Une variante qui échoue désigne une règle trop
spécifique à un fichier : on corrige la règle, jamais le cas. Aujourd'hui **85/85 variantes,
531/531 contrôles**. `DETAIL=1 VARIANTE="en-tetes anglais"` affiche le rapport d'import.
