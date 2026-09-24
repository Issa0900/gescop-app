# Risque, autonomie et modes opératoires

## Niveaux de complexité → taille d'équipe

- **LOW** — un seul agent expert (ou toi-même sous une casquette) suffit.
- **MEDIUM** — 2 à 4 agents.
- **HIGH** — plusieurs spécialistes + Critic + QA + Business Guardian.
- **CRITICAL** — équipe complète + double validation + tests renforcés.

## Matrice de risque à évaluer avant d'agir

Impact utilisateur, impact données, impact KPI, impact financier, impact sécurité, impact architecture, probabilité de régression. Plus le risque est élevé, plus le niveau de validation requis augmente et plus l'autonomie doit diminuer.

## Niveaux d'autonomie

- **LEVEL 0 — OBSERVE** : lecture uniquement.
- **LEVEL 1 — ANALYZE** : analyse et diagnostic.
- **LEVEL 2 — PROPOSE** : plan de correction, pas d'implémentation.
- **LEVEL 3 — IMPLEMENT** : modification contrôlée.
- **LEVEL 4 — VALIDATE** : tests + review.
- **LEVEL 5 — AUTONOMOUS** : réservé aux opérations à faible risque et procédures déjà validées ; les opérations critiques (DB, RLS, migration destructive, KPI financier) restent sous contrôle explicite de l'utilisateur, quel que soit le niveau de confiance atteint.

Exemples : un correctif UI mineur peut se faire en autonomie élevée ; une modification de KPI demande une validation renforcée ; une modification DB/RLS demande une validation critique ; une migration destructive demande une autorisation explicite avant toute exécution — jamais présumée.

## Mode read-only par défaut (Phase 1 de l'audit)

Les agents inspectent, cherchent, analysent, testent, profilent, reproduisent — sans modifier le code tant que le plan n'est pas validé.

## Mode incident (problème critique détecté)

1. Arrêter les modifications non nécessaires.
2. Préserver les preuves.
3. Identifier l'impact.
4. Isoler le problème.
5. Constituer une équipe.
6. Reproduire.
7. Corriger.
8. Tester.
9. Vérifier le métier.
10. Documenter l'incident.

## Mode nouvelle fonctionnalité

```
REQUIREMENTS → BUSINESS RULES → ARCHITECTURE → DATA MODEL → IMPLEMENTATION PLAN
→ DEVELOPMENT → QA → BUSINESS VALIDATION → REGRESSION
```

## Mode refactoring

Ne jamais refactorer uniquement parce que le code "semble mauvais". Avant de refactorer :
```
CURRENT BEHAVIOR → DEPENDENCIES → CONTRACTS → TESTS → TARGET ARCHITECTURE
```

## Conflict resolution

Voir `references/evidence-and-report-format.md#conflict-resolution`.

## Cas prioritaire : colonne/donnée inconnue (UNKNOWN)

Une colonne comme `XYZ_2026` ne doit **jamais** faire planter un import valide simplement parce que le dictionnaire ne la connaît pas. Chemin attendu :

```
RAW HEADER → NORMALIZE → PROFILE → SEARCH CANDIDATES → ANALYZE VALUES
→ ANALYZE CONTEXT → ANALYZE RELATIONS → CHECK CONTRADICTIONS → DECIDE
```

Résultat possible : `VALID`, `AMBIGUOUS`, `UNKNOWN`, `INVALID` — jamais `CRASH`.

Un `UNKNOWN` doit pouvoir circuler tout du long du pipeline sans être perdu ni transformé en erreur :
```
IMPORT → SEMANTIC → QUALITY → DATABASE → UI → AUDIT → LEARNING → REPROCESSING
```

## Propriétés à garantir sur le pipeline d'import/sémantique/KPI

1. Ajouter une colonne inconnue ne doit pas faire planter un import valide.
2. Modifier la casse d'un header ne doit pas créer arbitrairement un nouveau concept.
3. Une donnée ambiguë ne doit pas devenir automatiquement certaine.
4. Une donnée originale (RAW) ne doit jamais être détruite par le mapping.
5. Un import répété doit être contrôlé par l'idempotence (fingerprint).
6. Un KPI ne doit pas utiliser une donnée sémantiquement non validée.
7. Une correction ne doit pas casser les fonctionnalités précédentes (non-régression).

Ces 7 propriétés sont de bons candidats de tests à écrire/vérifier quand le sujet touche import, mapping ou KPI — voir aussi `orchestrator.md` pour les repères techniques réels du repo (`base44/shared/*`, `base44/functions/importMultiData/entry.ts`).

## Single source of truth

Avant de créer un nouveau moteur ou une nouvelle fonction de mapping/validation, cherche s'il existe déjà (Software Architect, `references/agent-registry.md`). Réutilise ou améliore plutôt que dupliquer — ce repo a un historique documenté de duplications introduites par des agents lancés en parallèle sans coordination (voir `orchestrator.md`, section "Historique connu").
