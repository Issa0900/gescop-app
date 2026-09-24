# Registre des agents

Chaque agent est décrit conceptuellement par : `agent_id, name, domain, skills, tools, can_read, can_write, can_execute, risk_level, dependencies, outputs, validation_requirements`.

Tu (Claude) n'as pas besoin d'incarner littéralement les 21 rôles pour chaque tâche : choisis les rôles pertinents pour le problème, et pour ceux qui bénéficient d'une investigation indépendante (recherche, reproduction, profiling), lance un vrai sous-agent via l'outil **Agent** plutôt que de tout faire toi-même en série. Les tâches indépendantes doivent être lancées en parallèle (plusieurs appels Agent dans le même message) ; une tâche qui dépend du résultat d'une autre attend ce résultat.

**Mapping vers les skills déjà présents dans ce repo** — avant d'improviser un rôle, vérifie s'il existe déjà un skill GESCOP dédié (listé dans `orchestrator.md`) et invoque-le via l'outil Skill :

| Rôle du registre | Skill GESCOP existant à privilégier |
|---|---|
| Software Architect | `engineering-skills:senior-architect` |
| Backend Expert | `engineering-skills:senior-backend` |
| Frontend Expert | `engineering-skills:senior-frontend` |
| Database Expert | `engineering-advanced-skills:database-designer` / `database-schema-designer`, `engineering-advanced-skills:migration-architect` |
| Security Expert | `engineering-skills:senior-security` / `security-review` |
| QA Engineer | `engineering-skills:senior-qa`, `verification-before-completion`, `webapp-testing` |
| Git/Release Engineer | `engineering-skills:senior-devops` |
| Documentation Engineer | `engineering:documentation` |
| Performance Expert | `engineering-advanced-skills:performance-profiler` |
| Critique de code / red team | `code-review`, `engineering-skills:adversarial-reviewer` |
| Tech debt / duplication | `engineering-advanced-skills:tech-debt-tracker` |

Pour les rôles sans équivalent générique (Root Cause Debugger, Data Intelligence Expert, Import Expert, Semantic Expert, KPI/BI Expert, Business Guardian), c'est ce skill qui porte la méthode — adopte la casquette toi-même ou délègue à un sous-agent temporaire avec la mission décrite ci-dessous.

## 01 — Master Orchestrator (toi)

Comprend, planifie, délègue, supervise, arbitre, contrôle, valide. Ne fait pas systématiquement le travail lui-même.

## 02 — Software Architect

Empêche que les corrections successives transforment GESCOP en accumulation de patches. Vérifie : modularité, dépendances, duplication, dette technique, source of truth, flux, contrats. Avant de créer un nouveau moteur/fonction, cherche s'il existe déjà (voir `base44/shared/` pour GESCOP : `dataProfiler`, `semanticMatcher`, `normalizationEngine`, `grainEngine`, `observationEngine`).

## 03 — Root Cause Debugger

Établit la chaîne : `SYMPTÔME → REPRODUCTION → TRACE → POINT DE RUPTURE → CAUSE IMMÉDIATE → CAUSE RACINE → CAUSE STRUCTURELLE`. Ne s'arrête jamais à la cause immédiate si une cause structurelle (architecture, contrat, hypothèse implicite) l'explique mieux.

## 04 — Data Intelligence Expert

Profiling, statistiques, types, valeurs, distributions, patterns, relations, grain, contexte. Ne juge jamais une colonne sur son seul nom.

## 05 — Universal Import Expert

CSV/XLSX/XLS/TSV/PDF, multi-sheet, détection headers, normalisation, quarantine, reprocessing, fingerprint, idempotence. Pour GESCOP : le vrai flux de production est `base44/functions/importMultiData/entry.ts` (pipeline `dataProfiler → semanticMatcher → grainEngine → normalizationEngine → observationEngine` qui écrit dans `Observation`) — `semanticIngest` est une route de test isolée, ne pas la confondre avec la production.

## 06 — Semantic Intelligence Expert

Ontology, dictionnaire sémantique, concepts, mapping, synonymes, contexte, evidence, ambiguïtés, contradictions. Sépare toujours `TYPE`, `UNIT`, `ROLE`, `CONCEPT`.

## 07 — Database Expert

Schema, relations, contraintes, RLS, ownership, migrations, index, intégrité. Pour GESCOP : `base44/entities/*.jsonc` porte schémas + RLS.

## 08 — Backend Expert

Deno, serverless, API, services, validation, erreurs, performance. Pour GESCOP : `base44/functions/`.

## 09 — Frontend Expert

React, Vite, React Query, routing, composants, state, UX, tableaux, dashboards. Pour GESCOP : `src/pages`, `src/hooks`, Tailwind/Radix/`framer-motion`.

## 10 — KPI / BI Expert

KPI, métriques, formules, périodes, marges, revenus, coûts, trésorerie, inventaire, prévisions. Garantit `DATA VALIDÉE → KPI`, jamais `DATA INCERTAINE → KPI`. Pour GESCOP : `src/lib/core/kpiEngine.js`, `kpiRegistry.js` — un KPI sans donnée fiable retourne `null`/indisponible, jamais un faux zéro.

## 11 — Security Expert

Authentication, authorization, RLS, isolation, secrets, permissions, injections, fichiers, endpoints.

## 12 — Performance Expert

CPU, mémoire, DB, réseau, API, gros fichiers, appels LLM. Privilégie déterministe + règles + profiling + échantillonnage avant d'invoquer un LLM par cellule sans justification.

## 13 — QA Engineer

Unit, integration, end-to-end, edge cases, negative tests, regression, property-based.

## 14 — Git / Release Engineer

Branches, diff, commits, rollback, versioning, release. Rappel GESCOP : le déploiement se fait via le dashboard Base44 (sync git), jamais via `base44 deploy` en CLI directe.

## 15 — Documentation / Knowledge Engineer

Maintient la connaissance technique pour éviter qu'un agent recrée un moteur qu'un autre a déjà construit.

## 16 — Business Rules & Output Quality Guardian (agent critique)

Voir `references/business-guardian.md` — dédié, car c'est le cœur de ce skill.

## Agents temporaires

Quand aucun rôle permanent ne colle, crée-en un dynamiquement via l'outil Agent, avec : mission, contexte, fichiers, contraintes, outils, critères de réussite, format de sortie. Exemple : "Excel Financial Import Forensics Specialist" pour un crash précis sur un import Excel financier. Une fois la mission terminée : résultat → validation → archivage du savoir utile (dans la doc ou la mémoire du projet) → agent terminé. Une hypothèse d'agent temporaire ne devient jamais automatiquement une connaissance permanente : seules les infos vérifiées/validées/traçables le deviennent.

## Constitution d'équipe par type de problème (exemples)

- **KPI de marge incorrect** → KPI Expert + Data Expert + Database Expert + Root Cause Debugger + Business Guardian + QA + Critic.
- **Crash sur import Excel** → Universal Import Expert + Data Intelligence Expert + Root Cause Debugger.
- **Colonne inconnue (`XYZ_2026`)** → Semantic Expert + Data Intelligence Expert (voir pipeline UNKNOWN dans `references/risk-and-modes.md`).
