# Fiche de capacités GESCOP — vérifiée contre le code réel

Établie le 2026-09-25, à partir de la branche `correctifs-import-kpi-2026-09` (commit `3f75026`), par lecture directe du code (`gescop-app/`), pas de la documentation seule. **À revérifier avant chaque cycle de vente si la branche a beaucoup changé** — cette fiche se périme.

Convention (Section 1 du skill) : **RÉELLE** = codé, branché bout-en-bout, testé ou vérifiable dans ce dépôt. **PRÉVUE** = objectif documenté (North Star), pas encore livré. **POSSIBLE** = faisable avec l'architecture actuelle, pas commencé. **NON DISPONIBLE** = hors de portée, à ne jamais évoquer commercialement.

---

## RÉELLE — vérifié dans le code, à utiliser sans réserve

**Import et reconnaissance de données**
- Import Excel/CSV multi-fichiers avec reconnaissance automatique du type de feuille et des colonnes (`base44/functions/importMultiData`), y compris fichiers en anglais, casse variable, colonnes renommées, dates en formats mixtes.
- Traduction/lexique FR/EN par mots, pas seulement par nom exact de colonne (`registry/lexiqueChamps.ts`).
- Dictionnaire par entreprise : les corrections faites par l'utilisateur sont mémorisées et réutilisées sur les futurs imports (`Company.company_dictionary`, appliqué dans le pipeline d'import — corrigé et vérifié le 24 sept 2026).
- Détection et gestion des doublons : conservés et signalés si non prouvés, exclus seulement si preuve (identifiant métier ou réimport). Jamais de perte silencieuse de ligne.
- Retraitement sans réimport quand le dictionnaire change (`reprocessImport`).
- Sécurité des fichiers importés : upload privé, URL signée à durée limitée, protection SSRF sur toute URL de fichier traitée côté serveur.
- Couverture mesurée (banc interne) : 27 fichiers réels/synthétiques, 237/239 contrôles multi-modules justes ; robustesse 100 % sur 105 variantes de format.

**Calcul et KPI**
- KPI financiers et opérationnels calculés à partir des données réellement importées (pas de valeur inventée) : CA hors taxes, panier moyen, marge, BFR, DSO/DPO, coût par employé, etc. — un KPI sans donnée suffisante est marqué "non mesuré", jamais 0 par défaut.
- Une seule règle de calcul par KPI, partagée entre toutes les pages (tableau de bord, indicateurs, clients, produits, RH, alertes, audit).
- Détection d'incohérences croisées (`croisements.js`) : commande vs facture, prix vendu vs catalogue, succursale vendeur vs vente, dépassement de budget, devises mélangées.
- Multi-devises avec taux de change fournis par l'entreprise ; une vente en devise étrangère sans taux est exclue du calcul plutôt qu'additionnée à faux.

**Alertes et détection**
- Alertes automatiques sur anomalies critiques et risques majeurs, avec notification email — anti-spam intégré (pas de répétition de la même alerte sous 30 jours).
- Page Audit : cohérence des données à travers les modules (pas seulement des KPI isolés).

**Veille externe (signaux macro)**
- `Radar.jsx` + fonction backend `scanExternalRadar` : recherche réelle sur internet (`add_context_from_internet: true`, pas une invention du modèle), source et URL publique exigées pour chaque signal, distinction explicite fait/hypothèse, fenêtre de fraîcheur 90 jours. **C'est un vrai pilier "signaux externes" fonctionnel** — à ne pas confondre avec `externalSignalEngine.ts` (fichier différent, orphelin, voir plus bas).
- Suivi de concurrents déclarés par l'utilisateur (`CompetitorsManager`).

**Recommandations et décisions**
- `Recommendation` générée par IA à partir de l'analyse réelle des données (`analyzeBusiness`), avec statut suivi (converti/rejeté) — pas un texte statique.
- `Decision` et `Goal` : objectifs stratégiques et décisions suivis comme des enregistrements réels, pas un module de façade.

**Simulateur et prévisions**
- `Previsions.jsx` / `Simulateur.jsx` s'appuient sur les vraies séries financières calculées (`financialMonthlySeries`, `useDonneesKpi`), pas une IA qui invente une courbe.

**Sécurité**
- Scan de sécurité récent (base au 19 sept, corrections vérifiées au 25 sept) : SSRF corrigé sur toutes les fonctions d'import, contrôle d'accès corrigé sur les notifications, RLS restreint sur Invoice/Subscription, aucune clé API en dur, aucune dépendance npm vulnérable connue.

---

## ⚠️ PRÉVUE — objectif documenté, pas encore livré (ne jamais présenter comme actif)

- **Fusion qualitatif + externe dans l'analyse IA** : `analyzeBusiness` calcule des signaux qualitatifs et un graphe de contexte, mais son prompt final ne les utilise pas encore (calcul fait, résultat jeté) — le "croisement des 3 piliers" du North Star n'est donc réel qu'entre quantitatif et externe (Radar), pas encore avec le qualitatif (feedback client, sentiment employé).
- **Décision et preuve automatisées par IA** (`decisionEngine.ts`, `evidenceEngine.ts`) : code écrit mais explicitement marqué "simulation", jamais branché à un vrai appel modèle. Ne pas vendre "l'IA valide vos décisions automatiquement".

## POSSIBLE — techniquement faisable, non commencé

- Connexion directe à des systèmes tiers (comptabilité, CRM, banque) au lieu de l'import de fichier manuel — l'architecture (entités, pipeline de normalisation) le permettrait, rien n'est construit aujourd'hui dans ce sens.
- Ancien module d'éligibilité/recommandation de KPI (`base44/shared/core/kpi/*`) — supprimé le 18 sept car il dupliquait la vraie logique ; s'il y a une demande commerciale pour "quels KPI activer", il faudrait reconstruire sur la base actuelle, pas le ressortir.

## NON DISPONIBLE — à ne jamais évoquer

- Toute intégration API en temps réel avec un logiciel tiers (Acomba, QuickBooks, Shopify, banque) — aucune n'existe dans le code, seul l'import de fichier fonctionne.
- Décision autonome prise par l'IA à la place du dirigeant — contraire au positionnement central de GESCOP (Section 33 du skill) et non implémenté.

---

## Notes pour la vente

- **Le seul flux de données prouvé aujourd'hui est l'import de fichier.** Toute promesse d'intégration "en direct" avec un logiciel du prospect est une hypothèse à qualifier, pas un fait.
- **Le pilier "signaux externes" (Radar) est réel** — c'est un argument différenciant vérifiable, contrairement à ce que suggérait une lecture rapide de `AGENTS.md` (qui documente un moteur différent et orphelin, pas Radar).
- **Le pilier "qualitatif" n'est pas encore fusionné** dans l'analyse IA — ne pas promettre "GESCOP croise vos données financières avec le feedback client" tant que ce n'est pas corrigé.
- Avant une démo, vérifier que la branche testée est bien celle qui contient ces correctifs (`correctifs-import-kpi-2026-09` ou fusionnée dans `main`).
