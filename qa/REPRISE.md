# Reprise de la mission import/KPI — pour l'agent qui continue (Antigravity ou autre)

Fiche écrite le 25 sept. 2026, à la fin de la session Claude Code. Elle se suffit à elle-même : l'agent précédent avait une mémoire privée que tu n'as pas. Le détail de tout ce qui a été fait est dans `qa/COMPTE-RENDU.md` (section « Suite de la mission », à la fin du fichier).

## Où on en est

- Branche : `correctifs-import-kpi-2026-09` (dernier commit `210fc68`). **Non poussée, non déployée.**
- But d'Issa : que GESCOP **intègre correctement** les données de n'importe quel fichier (tous les modules : ventes, clients, produits, stocks, employés, paie, dépenses, trésorerie, fournisseurs, achats, immobilisations, marketing, interactions, concurrents, veille, objectifs, événements) **et calcule juste** les chiffres des pages. Ce qui compte, ce sont ces chiffres sur les fichiers du dossier `../DEMO`.

## Règles à respecter (données par Issa, toujours en vigueur)

1. **Ne rien déployer** : aucun `npm run deploy`, aucune commande `base44 deploy`.
2. **Ne rien pousser** sur GitHub. Le dépôt `Issa0900/gescop-app` est **public** : ne jamais y ajouter les fichiers de `../DEMO`.
3. **Ne rien écrire en production** : aucun script qui appelle l'API de l'app en ligne.
4. **Ne jamais récupérer le code stocké dans Base44** (`base44` pull, sync, restauration de checkpoint) par-dessus ce dossier.
5. **Penser macro** : corriger la RÈGLE générale (lexique par mots, traductions de listes, choix du type de feuille…), jamais un cas propre à un fichier. Ne jamais inventer une valeur ; une ligne non importée laisse toujours une trace (ImportIssue).
6. **Ne pas casser les autres succès** : après chaque correction, relancer la batterie ci-dessous. Un commit par correction, avec les chiffres avant/après dans le message.
7. Quand une vérité attendue est fausse (erreur de calcul dans le script de vérité), corriger la vérité en expliquant pourquoi, jamais l'app pour coller à une vérité fausse.
8. `npm run test:robustesse` : **une seule fois, à la toute fin** (gros fichier, long).
9. La machine manque souvent de mémoire : lancer les bancs **l'un après l'autre**, et le banc DEMO fichier par fichier (filtre en 2e argument).

## Batterie de non-régression (état actuel à conserver)

| Commande | Attendu |
|---|---|
| `npm test` | 252/252 |
| `npm run test:banc` | 78/82 (inchangé depuis le début : les 4 restants sont connus, 0 ligne perdue) |
| `npm run test:demo` | 77/77, plus les contrôles « module » (84/84 sur 3 classeurs) |
| `npm run test:vq` | 114/114 |
| `node tests/banc/lancer-demo.cjs jeux "" sans-ia,ia-fidele,ia-nom,ia-sans-colonnes,ia-decalee` | 450/450 |
| Deno : `for f in tests/import/*.ts tests/recette/*.ts qa/recette/*.ts; do deno run -A --no-check --sloppy-imports "$f"; done` puis `git checkout deno.lock` | 32/32 |
| `node tests/banc/lancer-demo.cjs diagnostic` (long, 5 comportements d'IA) | 73/73 par mode |

Banc DEMO sur quelques fichiers : `node tests/banc/lancer-demo.cjs demo-modules "Xplorer_3Mois,GESCOP.xlsx"`.

## Comment fonctionne la vérification « tous modules » sur DEMO

- `tests/banc/verite_demo_modules.py` lit les fichiers de `../DEMO` avec openpyxl et calcule **hors moteur** les chiffres attendus de chaque module. Les règles de calcul sont écrites dans son en-tête : paie = coût employeur total, dépenses et achats hors taxes, stock = dernière photo par produit et entrepôt au coût, immobilisations = valeur nette, trésorerie = dernier solde de clôture, etc. Il écrit `verite_demo_modules.json`.
- `tests/banc/demo.ts` importe chaque fichier par le vrai pipeline (`importMultiData`), calcule les KPI comme la page Indicateurs, puis évalue ces contrôles (`tests/banc/controles.ts` : types `kpi`, `lignes`, `somme`, `distincts`, `compte`, `solde`).
- Les formules des KPI sont dans `src/lib/core/kpiRegistry.js`. Les champs lus par KPI sont dans `src/lib/core/entityFieldMap.js`.

## Ce qui reste à faire, dans l'ordre

1. **Étendre `verite_demo_modules.py`** aux autres classeurs de `../DEMO`, un par un, puis lancer le banc DEMO sur ce fichier et corriger chaque écart par une règle générale :
   - `Nordik_PleinAir_Donnees_Complet_2026.xlsx` : 7 feuilles avec lignes de titre, formules sans valeur calculée ;
   - `Entreprise_Simulation_50Ans_Canada_QC.xlsx` : 7 feuilles, titres, formules, registre d'immobilisations ;
   - `jeu_de_donnees_kpi_complet.xlsx` : ventes, marketing, clientèle, opérations, RH, trésorerie ;
   - `GESCOP_Donnees_Test_Xplorer.xlsx` et `GESCOP_Donnees_Test_Xplorer_500.xlsx` ;
   - puis les CSV simples : `products.csv`, `purchases.csv`, `sales.csv`, `transactions_v2.csv`, `transactions_test_3mois.xlsx`.
2. Relancer le **diagnostic DEMO complet**. Il n'a pas pu finir sur le commit `bc862a1` (manque de mémoire) ; il était à 73/73 juste avant.
3. `./qa/run-all.sh` (e2e Playwright, lint, typecheck) : pas encore lancé pour les lots 5 et suivants.
4. `npm run test:robustesse`, une seule fois.
5. Compléter le **rapport avant/après** dans `qa/COMPTE-RENDU.md`, avec la plus-value en chiffres.

## Points ouverts (à signaler à Issa, pas à trancher seul)

- **C5** : l'analyse annonce plus de lignes valides que l'import n'en écrit (les doublons ne sont repérés qu'à l'écriture). C'est de l'affichage seulement.
- Le revenu attribué aux campagnes est compté dans `total_revenue` (jeu 07 : 391 851) : est-ce voulu ?
- `tests/banc/jeux.ts` a encore sa propre copie des contrôles ; il pourrait réutiliser `tests/banc/controles.ts`.
- `deno.json` (non suivi, à la racine) sert aux scripts Deno locaux : ne pas le supprimer sans vérifier.

## Outils utiles

- Générer à nouveau les 10 jeux : `python tests/banc/jeux_generes/generate_all.py` (déterministe).
- Détail d'un jeu : `DUMP=1 FEUILLES=1 node tests/banc/lancer-demo.cjs jeux 09 sans-ia` (plan de lecture, lignes stockées, messages d'import).
- Les fichiers sont en CRLF : un remplacement de texte exact doit en tenir compte.
