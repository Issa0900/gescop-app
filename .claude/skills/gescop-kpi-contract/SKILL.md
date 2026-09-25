---
name: gescop-kpi-contract
description: Contrat de calcul des KPI financiers de GESCOP (chiffre d'affaires, commandes, panier moyen, ARPC, coût des ventes, marge brute, taux de marge, OPEX, EBITDA, paie, résultat net, effectif, ratio RH, trésorerie, inventaire) et méthode pour PROUVER qu'un KPI est juste en exécutant le vrai moteur. À utiliser avant toute création ou modification d'une formule dans src/lib/core/kpiRegistry.js, kpiEngine.js, kpiRecords.js ou kpiPeriodes.js, pour tout audit « ce chiffre est-il juste ? », « le KPI est faux », « pourquoi ce ratio a changé », ou quand un écran affiche un chiffre qui ne correspond pas au fichier importé. Ne pas utiliser pour l'import (reconnaissance des colonnes) : seulement pour ce qui se passe une fois les lignes stockées.
---

# Contrat de calcul des KPI GESCOP

Règles de calcul décidées avec Issa (25 sept. 2026) après l'audit du moteur. Elles priment sur les commentaires de code et sur `guide_complet_des_kpis_et_analyses_avanc_es.md` quand ils divergent. Toute règle nouvelle ou modifiée s'ajoute ici, avec sa date.

## Principes

1. **Inconnu n'est pas zéro.** Une donnée absente donne `null` (Non mesuré), jamais `0`. Interdit dans `calculate()` : `deps.x || 0` sur une dépendance qui peut manquer, sauf si le KPI déclare cette dépendance dans `dependancesOptionnelles` ou `sourcesAlternatives` et que l'absence est signalée.
2. **Le statut suit le chiffre.** Un KPI calculé à partir d'une source partielle (`UNKNOWN`) ou absente (`NOT_MEASURED`) hérite de ce statut, y compris quand cette source est elle-même un KPI calculé dans le même lot (`computeKpiBatch`). Un résultat `null` est toujours `NOT_MEASURED`.
3. **Une règle générale, jamais un cas de fichier** (voir `qa/REPRISE.md`). Chaque règle doit tenir sur un fichier qu'on n'a jamais vu.
4. **Même période pour tout ce qu'on combine.** Un KPI qui combine des flux de plusieurs sources (ventes, dépenses, paie) se calcule sur les mois où **toutes** ces sources ont des lignes. Le KPI porte alors `periodeCommune` et la carte le dit (« calculé sur N mois communs »). Aucune proratisation, aucune extrapolation.
5. **Mots entiers pour les statuts.** Jamais `status.includes("actif")` : « inactif » le contient.

## Les 15 KPI critiques

| KPI (id) | Règle | Non mesuré quand |
|---|---|---|
| Chiffre d'affaires (`total_revenue`) | Somme HT des ventes (`montantHT`), nette de remises, sans annulations ni retours (`commandeHorsCA`), avoirs déduits. Une transaction qui encaisse une commande importée n'est pas recomptée. Hors revenu attribué aux campagnes. | ni commande ni transaction de recette |
| Montant HT d'une ligne (`montantHT`) | `total_revenue` s'il existe. Sinon le sous-total ; la remise n'en est retranchée que si le sous-total est brut (preuve : qté × prix, ou sous-total + taxe + livraison ≠ total). Sinon total − taxe : **un total est après remise** sauf preuve contraire (qté × prix = total − taxe). | aucun montant |
| Commandes (`order_count`) | Commandes **distinctes** (`order_id`), ventes seulement (`estVente`). | aucune commande |
| Panier moyen (`aov`) | (CA des commandes + avoirs) / commandes distinctes. | aucune commande identifiée |
| ARPC (`arpu`) | CA HT des ventes qui portent un client / **clients distincts ayant acheté** dans la période. Ne lit pas `Customer.status`. | aucune vente rattachée à un client |
| Coût des ventes (`cogs_total`) | Somme de `Order.cost` / `total_cost` des lignes comptées dans le CA. | pas de colonne de coût |
| Marge brute (`gross_margin_amount`) | CA − coût des ventes. | CA ou coût absent (jamais « coût = 0 ») |
| Taux de marge (`gross_margin_pct`) | Marge brute / CA × 100. | marge non mesurée ou CA nul |
| OPEX (`total_expense` + `payroll_total`) | Dépenses d'exploitation (dédoublonnées des transactions) + paie. Pas le coût des ventes. | ni dépense ni paie |
| EBITDA (`ebitda`) | CA − coût des ventes − dépenses − paie, **avant** amortissement, intérêts et impôts. Ne dépend pas du registre d'immobilisations. Période commune. | CA absent, ou ni dépense ni paie |
| Paie (`payroll_total`) | Somme du coût employeur (`Payroll.total_cost`). | aucune paie |
| Résultat net (`net_income`) | EBITDA − amortissement de la période (DPA annuelle × jours / 365) quand un registre d'immobilisations existe. Intérêts et impôts : non importés, non retranchés. `total_charges` = CA − résultat net, par construction. Période commune. | comme l'EBITDA |
| Effectif (`employee_count`) | Employés distincts des fiches `Employee` dont le statut n'indique pas un départ (inactif, terminé, quitté, parti, ancien, inactive, terminated, left, former). Paie seulement si aucune fiche employé. | aucune fiche ni paie |
| Ratio RH (`rh_expense_ratio`) | Paie / CA × 100, période commune. | paie ou CA absent |
| Trésorerie (`cash_closing`) | Dernier solde de clôture par date (page : `latestCashBalance`). Autonomie : `metrics.runwayMonths` (0 si solde ≤ 0). Le `cash_runway` du registre n'est pas affiché : ne pas l'afficher sans le corriger. | aucun relevé |
| Inventaire (`inventory_value_total`) | Somme, par produit × entrepôt, du dernier relevé, au coût. | aucun relevé valorisé |

Taux d'amortissement : fourni en fraction (0,30) ou en pourcentage (30). Un taux > 1 est un pourcentage et se divise par 100 (`tauxDpa`).

## Méthode de preuve (obligatoire avant de dire « c'est juste » ou « c'est corrigé »)

1. **Écrire le cas en données** : un petit JSON par entité (`orders`, `expenses`, `payrolls`, `employees`, `customers`, `cashflow`, `inventory`, `assets`, `transactions`…) avec le résultat attendu calculé à la main.
2. **L'exécuter sur le vrai moteur** avec la sonde du skill :
   ```bash
   node --import ./tests/register-npm.mjs .claude/skills/gescop-kpi-contract/scripts/sonde-kpi.mjs cas.json net_income,ebitda,net_margin_pct
   ```
   Elle affiche valeur, statut et période commune de chaque KPI. Une fenêtre « 3 mois » ou « mois » se teste avec `--fenetre trim` ou `--fenetre mois --aujourdhui 2026-07-10`.
3. **Transformer le cas en test** dans `tests/` (qui échoue avant la correction), puis corriger la règle générale.
4. **Batterie** (`qa/REPRISE.md`) : `npm test`, `npm run test:banc`, `node tests/banc/lancer-demo.cjs jeux "" sans-ia,ia-fidele,ia-nom,ia-sans-colonnes,ia-decalee`, et `npm run test:demo` quand `../DEMO` est présent. Lint et typecheck ne doivent pas gagner d'erreur.

## Pièges connus

- `computeKpiBatch` calcule les dépendances d'abord et ne garde que leur valeur dans le contexte : le statut vit dans `context._statuts`. Tout nouveau chemin de calcul doit le remplir.
- `determineTemporalContext` prend la période des **ventes** (Order/Transaction) : `period_days` sert aux ratios en jours et à la proratisation de l'amortissement, pas au flux de trésorerie.
- Deux calculs d'autonomie de trésorerie existent (`kpiRegistry.cash_runway` et `metrics.runwayMonths`) : seul le second est juste et affiché.
- `montantHT` rend `NaN` quand aucun montant n'existe : toujours filtrer par `Number.isFinite`.
- La LTV (`arpu / churn`) mélange un revenu de période et un taux d'attrition sur toute la base : indicatif seulement.
