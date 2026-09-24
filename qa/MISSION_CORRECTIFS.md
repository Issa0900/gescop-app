# Mission : correctifs issus de l'agent QA (24 septembre 2026)

Ce fichier s'adresse à Claude Code, dans VS Code, sur le dépôt `gescop-app` (Windows, dossier `Desktop\GESCOP\gescop-app`). Il décrit une série de correctifs à exécuter d'affilée, lot par lot, avec une vérification automatique après chaque lot.

## Règles de travail

1. Lire `AGENTS.md` avant toute modification et respecter sa directive (système d'aide à la décision, ne jamais bloquer l'utilisateur sur un détail de format).
2. Ce dépôt est la version de référence : c'est lui qui correspond à l'app publiée. Ne jamais récupérer le code stocké dans Base44 (`base44` pull, sync, checkpoint restore) par-dessus ce dossier : il est en retard de plusieurs commits.
3. Ne rien publier. Aucun `npm run deploy`, aucune commande `base44 deploy`. La mise en ligne est la décision d'Issa, à la fin.
4. Ne rien écrire dans la base de production (pas de script qui appelle l'API de l'app en ligne).
5. Travailler sur une branche dédiée, un commit par lot, messages en français.
6. Enchaîner les lots sans attendre de validation. S'arrêter et demander à Issa seulement si : un test échoue encore après trois approches différentes, une action est irréversible, ou une correction exige de changer le comportement métier au-delà de ce qui est décrit ici.
7. Chaque correctif s'accompagne d'un test qui échoue avant et passe après. Ajouter ce test à la suite existante (`tests/` pour `npm test`, `qa/recette/` pour un test Deno, `qa/e2e/agent-qa.spec.js` pour un parcours navigateur).

## Étape 0 — Préparation

1. Fins de ligne. `git status` montre environ 462 fichiers modifiés : ce sont uniquement des fins de ligne Windows (vérifié : `git diff --ignore-cr-at-eol` est vide). Exécuter `git config core.autocrlf true`, puis vérifier que `git status` ne liste plus que de vrais changements. Ne pas commiter de conversion de fins de ligne.
2. Un fichier parasite nommé `derniers ajustements"` traîne à la racine (non suivi). Le signaler à Issa dans le compte rendu, ne pas le supprimer.
3. `git switch -c correctifs-qa-2026-09`.
4. Outils : `npm install`, Deno (`npm i -g deno` ou `winget install DenoLand.Deno`), navigateur de test `npx playwright install chromium`. Le script de l'agent est en bash : l'exécuter depuis Git Bash (terminal par défaut de Claude Code sous Windows).
5. Mesure de départ : `./qa/run-all.sh`. Garder `qa/out/findings-summary.json` et `qa/out/static-summary.txt` comme référence. État attendu au départ : build OK, `npm test` 195/195, 27 scripts Deno OK (dont QA01), 154 scénarios navigateur passés, lint 23 erreurs, typecheck 146 erreurs.

## Lot 1 — Sécurité et confidentialité

### 1.1 Porte dérobée de test active en production (critique)
- Constat : `src/lib/AuthContext.jsx`, ligne 22. Avec `localStorage.PLAYWRIGHT_TEST = "true"`, un visiteur non connecté entre dans l'app publiée en tant que test@example.com (vérifié en ligne le 24 sept.).
- Correction : n'activer ce contournement que si `import.meta.env.DEV` est vrai, pour qu'il disparaisse du build de production. Les tests Playwright tournent sur le serveur de développement et doivent continuer de passer.
- Test : après `npm run build`, aucune occurrence de `PLAYWRIGHT_TEST` dans `dist/` (ajouter ce contrôle à `qa/run-all.sh`, couche 1a, en échec si trouvé).

### 1.2 Fichiers financiers téléversés en accès public (majeur)
- Constat : `src/pages/Import.jsx`, ligne 123 : `Core.UploadFile` renvoie une URL publique. Les fichiers de ventes, paie et trésorerie des clients sont lisibles par quiconque a le lien, ce qui contredit la mention Loi 25 affichée dans l'app.
- Correction : téléverser avec `Core.UploadPrivateFile` (retourne `file_uri`). Côté fonctions (`importMultiData`, `importData`, `inspectSheet`, `reprocessImport`, et toute autre fonction qui relit `file_url`), obtenir une URL signée de courte durée avec `Core.CreateFileSignedUrl` avant lecture ou extraction. Vérifier la signature exacte de ces méthodes dans `node_modules/@base44/sdk/dist/modules/integrations.types.d.ts`. Conserver la compatibilité avec les anciens imports dont `file_url` est une URL publique.
- Test : le parcours F de `qa/e2e/agent-qa.spec.js` doit constater `UploadPrivateFile` et plus aucun `UploadFile`/`UploadPublicFile` ; adapter le faux backend pour `CreateFileSignedUrl`.

### 1.3 Notifications critiques peut-être muettes (à vérifier, puis corriger)
- Constat : `base44/functions/notifyCriticalEvent/entry.ts` exige maintenant que l'appelant soit le propriétaire de l'anomalie ou du risque (`record.created_by_id !== caller.id`), ce qui ferme bien la faille de courriels envoyés à n'importe qui. Mais les workflows `base44/workflows/Alerte Anomalie Critique.jsonc` et `Alerte Risque Majeur.jsonc` appellent cette fonction automatiquement, sans doute sans session utilisateur. Dans ce cas, `auth.me()` échoue et plus aucun courriel critique ne part.
- Démarche : lire la documentation Base44 sur l'invocation de fonctions par les workflows (contexte d'authentification de `invoke_backend_function`). Si le workflow s'exécute sans utilisateur, accepter cet appel uniquement s'il est authentifié comme appel de service (selon ce que Base44 fournit), relire l'enregistrement en rôle service et prendre son `created_by_id` comme destinataire. Ne jamais recommencer à faire confiance au `user_id` du corps de requête. Retirer ce paramètre des deux workflows s'il n'est plus utilisé. Sans session et sans preuve d'appel de service : répondre 401 (aujourd'hui l'exception produit un 500).
- Si la documentation ne permet pas de trancher, ne pas deviner : consigner la question dans le compte rendu et passer au point suivant.

## Lot 2 — Intégrité des données

### 2.1 Supprimer un import laisse ses KPI (majeur)
- Constat : dans `handleDelete` de `src/pages/Import.jsx`, les lignes de l'entité et les `ImportIssue` sont supprimées par `import_id`, mais pas les `Observation`. Or le moteur KPI additionne les Observations : après suppression d'un import, son chiffre d'affaires reste affiché. La purge totale, elle, les efface bien.
- Correction : ajouter `Observation.deleteMany({ import_id: imp.id })` dans la même boucle de vérification que l'entité (supprimer, relire, conserver l'import si des lignes survivent).
- Test : un test navigateur ou unitaire qui importe, supprime, et vérifie qu'il ne reste aucune Observation de cet import.

### 2.2 Supprimer un import efface toutes les alertes du compte (majeur)
- Constat : `src/pages/Import.jsx`, ligne 364 environ : `Alert.deleteMany({ category: { $in: ["anomalie", "risque", "opportunite"] } })`, sans lien avec l'import supprimé.
- Correction : ne supprimer que les alertes liées aux enregistrements de cet import (champ `link_id` ou équivalent, à vérifier dans `base44/entities/Alert.jsonc`). Si aucun lien fiable n'existe, ne supprimer aucune alerte et afficher « relancez l'analyse pour mettre les alertes à jour ».
- Test : deux imports, une alerte liée à chacun ; supprimer le premier laisse l'alerte du second.

### 2.3 Données de test déjà en production (action d'Issa, pas de Claude Code)
Issa confirme que l'app en ligne ne contient que ses propres tests. Après publication des correctifs, il utilisera « Tout supprimer » sur la page Importer puis réimportera ses fichiers de test. Rien à coder ici ; le rappeler dans la liste de contrôle finale.

## Lot 3 — Interface

### 3.1 Succursales et régions fictives pré-remplies (moyen)
- Constat : `src/pages/Parametres.jsx` (vers la ligne 133) et `src/components/settings/OrganizationPanel.jsx` (valeurs par défaut) injectent des régions, succursales et départements inventés (Grand Montréal, Laurentides, Succursale Laval, etc.). Ils s'affichent comme s'ils étaient ceux de l'entreprise et sont sauvegardés au premier « Enregistrer ».
- Correction : une seule structure par défaut, vide (`active_levels` avec les niveaux de base, listes vides), définie à un seul endroit et importée par les deux fichiers. Les exemples peuvent rester comme texte d'aide (placeholder), jamais comme données.
- Test : onglet Organisation avec une entreprise sans structure : aucune région ni succursale affichée ; « Enregistrer » n'écrit aucune liste non vide.

### 3.2 Textes en double dans Paramètres (moyen)
- Constat : une migration vers la traduction `t(...)` a laissé le texte en dur à côté de l'appel, à 7 endroits de `src/pages/Parametres.jsx` (lignes 323, 327, 358, 364, 426, 430, 504) : le titre s'affiche « Centre de Configuration & Contexte EntrepriseCentre de Configuration & Contexte Entreprise », le bouton « Enregistrer les modificationsEnregistrer les modifications ».
- Correction : garder uniquement l'appel `t(...)`. Chercher le même motif dans tout `src/` (texte en dur immédiatement suivi de `{t("clé", "même texte")}`).
- Test : ajouter à l'agent QA une détection de texte répété consécutivement (même segment de 15 caractères ou plus collé à lui-même) sur chaque page.

### 3.3 Débordement horizontal sur mobile (mineur)
- Constat (390 px de large) : Paramètres 923 px, Tâches 548 px, Audit 491 px, KPI 442 px. Les barres de boutons d'en-tête et le menu des onglets de Paramètres ne passent pas à la ligne. Dans le menu des onglets, le libellé et sa description sont écrasés sur une seule ligne (« Organis… Struct… »), même sur ordinateur.
- Correction : `flex-wrap` et espacement vertical sur les barres d'actions ; libellé et description des onglets l'un sous l'autre.
- Test : scénario C de l'agent sans constat de débordement.

### 3.4 Structure HTML invalide dans Facturation (mineur)
- Constat : avertissement React `validateDOMNesting` : un `Badge` (div) est placé dans un `<p>` sur `/facturation`, `/parametres/facturation` et l'onglet Facturation.
- Correction : remplacer le `<p>` parent par un `<div>` ou rendre le badge en `span`.
- Test : plus aucun `console.error` sur ces pages dans l'agent QA.

## Lot 4 — Intelligence artificielle

### 4.1 Modèle obsolète pour l'enrichissement par site web (moyen)
- Constat : `base44/functions/enrichFromWebsite/entry.ts`, ligne 52 : `model: "claude-3-5-sonnet"`. Les autres fonctions utilisent des modèles Gemini récents.
- Correction : vérifier la liste des modèles acceptés par `InvokeLLM` dans la documentation Base44, puis aligner sur un modèle supporté (ou retirer le paramètre pour utiliser le défaut).
- Test : impossible sans l'app en ligne ; l'ajouter à la liste de contrôle finale d'Issa.

## Lot 5 — Hygiène

- `npm run lint:fix`, puis corriger à la main ce qui reste, jusqu'à 0 erreur de lint.
- Typecheck : ne pas viser zéro (l'essentiel est du bruit de typage JSDoc des composants), mais le nombre d'erreurs ne doit pas dépasser 146.
- Mettre à jour la section « ACTUAL PIPELINE STATUS » de `AGENTS.md` avec les points corrigés ici.

## Après chaque lot

1. `./qa/run-all.sh`.
2. Critère de passage : build OK ; `npm test` sans échec ; tous les scripts Deno OK ; aucun constat critique ou majeur dans `qa/out/findings-summary.json` pour les points du lot ; pas de nouveau constat par rapport à la mesure de départ.
3. Ajouter un paragraphe à `qa/COMPTE-RENDU.md` : ce qui a changé (fichiers), le test qui le prouve, ce qui reste ou ce qui a été reporté, et pourquoi.
4. Commit du lot.

## Fin de mission

Remettre à Issa, dans `qa/COMPTE-RENDU.md`, un bilan final et la liste de contrôle suivante, à faire lui-même après avoir décidé de publier (`npm run deploy`) :

1. Navigateur privé sur l'app en ligne, ajouter `PLAYWRIGHT_TEST=true` dans le stockage local (outils de développement), recharger : on doit rester sur la page de connexion.
2. Connecté avec son compte : Importer, « Tout supprimer », puis importer un fichier de test, noter le chiffre d'affaires sur la page KPI, réimporter le même fichier : le chiffre ne doit pas bouger.
3. Supprimer cet import : la page KPI revient à « non mesuré » et les alertes des autres imports sont toujours là.
4. Ouvrir l'adresse du fichier téléversé (visible dans l'historique des imports) dans un navigateur privé : elle ne doit pas s'afficher.
5. Paramètres > Organisation : aucune succursale fictive ; titres affichés une seule fois.
6. Onboarding avec l'adresse d'un vrai site web : le nom et le secteur se pré-remplissent.
7. Créer une anomalie critique (ou attendre la prochaine analyse qui en produit une) : le courriel arrive.

## Invite à coller dans Claude Code

> Lis `AGENTS.md` puis `qa/MISSION_CORRECTIFS.md`, et exécute la mission en entier : étape 0, puis les lots 1 à 5 dans l'ordre, avec `./qa/run-all.sh` et un commit après chaque lot. Respecte les règles de travail du fichier, en particulier : ne rien publier, ne jamais récupérer le code de Base44 par-dessus ce dépôt, ne rien écrire dans la base de production. Ne t'arrête que dans les cas prévus par la règle 6. Termine par le bilan et la liste de contrôle dans `qa/COMPTE-RENDU.md`.
