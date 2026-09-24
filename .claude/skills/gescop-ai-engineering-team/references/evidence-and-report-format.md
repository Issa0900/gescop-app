# Evidence bus, format de rapport et rapport final

## Evidence bus

Tout agent (toi-même sous une casquette, ou un sous-agent délégué) publie ses observations avec cette structure minimale :

```
source
file
location
observation
evidence
confidence
status
```

Aucune conclusion importante sans `evidence` associée. Un `confidence` élevé ne dispense jamais de fournir la preuve sous-jacente.

## Format de rapport d'un agent

Chaque agent (ou chaque casquette que tu adoptes) retourne, au minimum mentalement structuré ainsi avant de synthétiser pour l'utilisateur :

```json
{
  "agent": "",
  "mission": "",
  "status": "",
  "summary": "",
  "files_inspected": [],
  "evidence": [],
  "findings": [],
  "hypotheses": [],
  "contradictions": [],
  "tests_run": [],
  "confidence": 0,
  "risk": "",
  "recommendation": ""
}
```

## Classification des affirmations

Toute conclusion importante dans ta réponse à l'utilisateur doit être étiquetable :

`[FAIT]` `[CALCUL]` `[INFÉRENCE]` `[HYPOTHÈSE]` `[RECOMMANDATION]` `[NON VÉRIFIÉ]`

Ne mélange pas ces catégories dans une même affirmation — si une phrase contient à la fois un fait vérifié et une inférence, sépare-les.

## Conflict resolution

Si deux agents (ou deux hypothèses que tu explores) arrivent à des causes différentes pour le même symptôme, ne tranche jamais arbitrairement. Ouvre une tâche de résolution : cherche une preuve discriminante, un test discriminant, ou une nouvelle inspection ciblée. Résultat : `RESOLVED` ou `UNRESOLVED`. Si `UNRESOLVED` → pas d'implémentation tant que ce n'est pas résolu.

## Critères de succès — ne déclare "FIXED" que si tout est coché avec preuve

```
[ ] cause racine identifiée
[ ] preuves disponibles
[ ] correction appliquée
[ ] tests ajoutés
[ ] tests existants passés
[ ] régression vérifiée
[ ] sécurité vérifiée
[ ] performance acceptable
[ ] règles métier respectées
[ ] sortie vérifiée
[ ] documentation mise à jour si nécessaire
```

Statuts finaux autorisés, uniquement : `FIXED`, `VALIDATED`, `PARTIALLY_RESOLVED`, `BLOCKED`, `UNRESOLVED`.

## Rapport final (mission importante) — 22 points

# GESCOP ENGINEERING REPORT

1. Problème
2. Impact
3. Agents sélectionnés
4. Raisons de leur sélection
5. Fichiers inspectés
6. Architecture concernée
7. Flux analysé
8. Reproduction
9. Preuves
10. Hypothèses
11. Causes alternatives
12. Cause racine
13. Contradictions
14. Plan de correction
15. Modifications
16. Tests
17. Régressions
18. Validation métier
19. Sécurité
20. Performance
21. Risques résiduels
22. Statut final

Pour une tâche simple (LOW complexity, voir `references/risk-and-modes.md`), ce rapport complet est disproportionné — résume simplement ce qui a été fait, la preuve, et le statut. Réserve le rapport en 22 points aux missions HIGH/CRITICAL ou explicitement demandées ("audit complet", "rapport d'ingénierie").
