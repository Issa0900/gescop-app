# Compte rendu — correctifs issus de l'agent QA (24 septembre 2026)

Branche : `correctifs-qa-2026-09`. Rien n'a été publié, rien n'a été écrit dans la base de production, aucun code n'a été récupéré de Base44.

## Étape 0 — Préparation

- **Fins de ligne** : `core.autocrlf` était déjà à `true` sur ce poste ; `git status` au départ ne montrait que le dossier `qa/` non suivi, aucun faux changement. Rien de converti ni de commité à ce titre.
- **Fichier parasite `derniers ajustements"`** : à signaler, non supprimé. Contrairement à ce que dit la mission, il n'est **pas** « non suivi » : il est **suivi par git** (commité, nom exact `derniers ajustements` suivi du caractère U+F022, qui s'affiche comme un guillemet). Même chose pour un fichier `tatus` à la racine. Les deux contiennent une sortie de `git log` (codes couleur compris) : des commandes mal tapées dont la sortie a été redirigée vers un fichier, puis commitées. Les deux sont à supprimer par toi si tu le souhaites (`git rm`).
- **Outils** : Node 24.18, Deno 2.9.6, Playwright 1.63 et Chromium déjà installés ; `npm install` fait.
- **Agent QA sous Windows** : trois défauts de l'outil lui-même (pas de l'app) empêchaient la mesure ; corrigés dans `qa/` :
  1. `qa/e2e/agent-qa.spec.js` calculait son dossier avec `new URL(import.meta.url).pathname` (donne `/C:/...` sous Windows, d'où `mkdir 'C:\C:\...'` et « No tests found ») → `fileURLToPath`.
  2. `qa/run-all.sh` cherchait le nombre de tests `npm test` au format `# pass` ; Node 24 écrit `ℹ pass` → les deux formats sont lus.
  3. `qa/playwright.qa.config.js` : avec 4 navigateurs en parallèle, le serveur de dev Vite sature sous Windows (`page.goto` > 20 s, 73 échecs sur 154). 2 navigateurs sous Windows (4 ailleurs), réglable par `QA_WORKERS`.
- **Mesure de départ** (code d'origine, outil corrigé) — conforme à l'état attendu : build OK ; `npm test` 195/195 ; 27 scripts Deno OK (dont QA01) ; **154/154** scénarios navigateur ; lint 23 erreurs ; typecheck 146 erreurs. Référence conservée dans `qa/reference/` (`findings-summary-depart.json`, `static-summary-depart.txt`, `unit-summary-depart.tsv`). Constats de départ : 3 « 0 $ » sur les pages de facturation/tarifs (prix d'un forfait, pas une donnée absente), `validateDOMNesting` sur Facturation, débordements mobiles (Audit 453 px, KPI 399 px, Tâches 507 px, Paramètres 848 px), `/facturation` absente du menu.

## Lot 1 — Sécurité et confidentialité

### 1.1 Porte dérobée de test (critique) — corrigé
- `src/lib/AuthContext.jsx` : le contournement `localStorage.PLAYWRIGHT_TEST` n'est actif que si `import.meta.env.DEV` ; Vite le retire du build de production.
- Preuve : `qa/run-all.sh` (couche 1a) compte les fichiers de `dist/` contenant `PLAYWRIGHT_TEST` et échoue s'il y en a. Avant : 1 fichier ; après : 0. Les 154 scénarios navigateur (serveur de dev) passent toujours.
- `run-all.sh` rend maintenant un code de sortie 1 si une couche échoue (build, `npm test`, un script Deno, les données de test ou Playwright) ; auparavant il affichait « aucun constat » même quand aucun scénario n'avait pu tourner.

### 1.2 Fichiers financiers en accès public (majeur) — corrigé
- `src/pages/Import.jsx` : `Core.UploadPrivateFile` (rend un `file_uri`) au lieu de `Core.UploadFile` ; seul `{ file_uri, file_name }` est envoyé aux fonctions.
- Nouveau `base44/shared/fichierPrive.ts` : `urlDeLecture()` crée une URL signée de 10 min (`Core.CreateFileSignedUrl`, signature vérifiée dans `integrations.types.d.ts` : `{ file_uri, expires_in }` → `{ signed_url }`) avec le client **de l'utilisateur** (pas le rôle service : Base44 ne doit signer que ses propres fichiers) ; un ancien import avec `file_url` public reste lisible tel quel. `referenceFichier()` : ce qui est conservé sur `Import.file_url` est l'URI privée (n'ouvre rien sans signature), jamais l'URL signée.
- Branché dans `importMultiData`, `importData` et `inspectSheet` (seules fonctions qui lisent un fichier ; `reprocessImport` relit le registre, pas le fichier). Description du champ `Import.file_url` mise à jour (pas de nouveau champ, donc rien à migrer).
- Preuves : `qa/recette/QA02-fichier-prive.ts` (échoue sur le code d'origine) — signature par le client utilisateur, durée courte, ancien `file_url` accepté, erreurs claires, et **bout en bout sur le vrai `importMultiData`** : le fichier est lu par l'URL signée, l'import enregistre `private/...`, l'URL signée n'est écrite nulle part. Parcours F de l'agent : exige un appel `UploadPrivateFile`, aucun `UploadFile`/`UploadPublicFile`, et des fichiers transmis avec `file_uri` ; le faux backend répond à `CreateFileSignedUrl`.
- À vérifier en ligne (non vérifiable ici) : que `CreateFileSignedUrl` appelé depuis une fonction avec le jeton de l'utilisateur signe bien son fichier (point 4 de la liste de contrôle, et un import réel).
- Remarque : l'historique des imports n'affiche pas l'adresse du fichier (aucune occurrence de `file_url` dans `src/`) ; pour le point 4 de la liste de contrôle, l'adresse se lit dans l'onglet Réseau des outils de développement (réponse de `UploadPrivateFile`) ou dans l'enregistrement `Import` (tableau de bord Base44).

### 1.3 Notifications critiques (à vérifier) — partiellement corrigé, question ouverte
Ce que dit la documentation Base44 (pages *Backend functions > overview* et *Automations*) : une fonction appelée sans utilisateur (webhook, appel HTTP externe, automatisation) n'a **aucun contexte utilisateur** ; il faut alors tout faire en `asServiceRole`. Elle ne documente **aucun moyen de prouver** qu'un appel vient d'un workflow de l'app : le jeton de service (`Base44-Service-Authorization`) est ajouté par la plateforme à tout appel de fonction, y compris un appel anonyme. Accepter un appel sans session reviendrait donc à accepter n'importe quel appel anonyme. Je n'ai pas deviné.
- Fait : `notifyCriticalEvent` rend **401** sans session (l'exception de `auth.me()` produisait un 500) ; le destinataire vient toujours de l'enregistrement relu (`created_by_id`), jamais du corps. Les deux workflows n'envoient plus que `entity_type` et `entity_id` (`user_id`, `title`, `description`, `detail`, `financial_impact` étaient ignorés par la fonction). Preuve : `qa/recette/QA03-notification-sans-session.ts` (401 sans session, intrus refusé malgré un `user_id` fourni, courriel au propriétaire, arguments des workflows).
- **Constat supplémentaire, plus grave** : `analyzeBusiness` crée les anomalies et risques par `bulkCreate`. La documentation Base44 dit : « Entity automations only fire for single-record create, update, and delete calls… Bulk operations… do not trigger entity automations. » Si les workflows suivent la même règle que les automatisations (non précisé), **ils ne se déclenchent jamais** : aucun courriel critique ne part aujourd'hui, avec ou sans ce correctif.
- **Question pour Issa — tranchée en cours de mission** (réponse d'Issa : « seulement pour une anomalie nouvelle (même titre non vu depuis N jours) »). Mis en œuvre :
  - Nouveau `base44/shared/notificationsCritiques.ts` : `aNotifier()` retient les anomalies `severity = critique` et les risques `urgency = elevee` dont le titre (casse, accents et espaces ignorés) n'a pas été notifié depuis **`JOURS_NOUVEAUTE` = 30 jours** (N choisi par moi, une constante à changer si besoin) ; un même titre répété dans une analyse n'est notifié qu'une fois. La mémoire est l'alerte in-app créée par chaque notification (catégorie `anomaly` / `risk`), qui survit aux analyses (anomalies et risques, eux, sont effacés et recréés à chaque analyse). Une alerte sans date lisible compte comme récente (dans le doute, pas de double envoi) ; si les alertes ne peuvent pas être lues, rien n'est envoyé.
  - `analyzeBusiness` notifie lui-même après avoir créé anomalies et risques (il a la session de l'utilisateur ; destinataire = l'utilisateur connecté). Une panne d'envoi n'interrompt pas l'analyse ; la réponse compte `notifications`.
  - `notifyCriticalEvent` applique la même règle et le même courriel (code partagé) : un rappel pour un élément déjà notifié ne renvoie rien.
  - Les deux workflows sont **conservés** (sans effet : sans session, 401) — les supprimer du dépôt ne garantit pas leur suppression côté Base44 au déploiement, et ils ne peuvent plus envoyer de doublon. À supprimer dans l'éditeur Base44 si tu préfères.
  - Preuves : `qa/recette/QA04-notification-nouveautes.ts` — la règle sur des cas fixes (déjà notifiée il y a 3 jours → rien ; il y a 31 jours → renvoyée ; non critique → rien ; titre répété → une fois) et **le vrai `analyzeBusiness`** avec un client simulé : 1re analyse = 2 courriels (anomalie critique + risque élevé), 2e analyse identique = 0, 3e avec une nouvelle anomalie = 1. QA03 : rappel du même enregistrement → pas de second courriel.
  - À vérifier en ligne : point 7 de la liste de contrôle.

**Résultat `./qa/run-all.sh` après le lot 1** : RÉSULTAT « toutes les couches passent » — build OK, porte de test dans `dist/` = 0, `npm test` sans échec, 29/29 scripts Deno (QA02 et QA03 ajoutés), 154/154 scénarios navigateur, lint 23, typecheck 146 ; aucun nouveau constat par rapport au départ, aucun constat critique ou majeur. Outil QA : un préchauffage du serveur de dev (`qa/e2e/prechauffage.js`, toutes requêtes `/api` bloquées, rien ne part vers l'app en ligne) évite l'expiration du tout premier scénario pendant que Vite compile.

## Lot 2 — Intégrité des données

### 2.1 Supprimer un import laisse ses Observations (majeur) — corrigé
### 2.2 Supprimer un import efface toutes les alertes du compte (majeur) — corrigé
- La logique de `handleDelete` est sortie de `src/pages/Import.jsx` dans `src/lib/supprimerImport.js` pour être testable ; `Import.jsx` ne garde que la confirmation et les messages.
- 2.1 : les `Observation` de l'import sont supprimées par `import_id` avec la même boucle « supprimer, relire » que les lignes de l'entité ; s'il en reste, l'import est conservé (« Suppression incomplète ») pour pouvoir relancer.
- 2.2 : vérifié dans `base44/entities/Alert.jsonc` et `analyzeBusiness` : les alertes d'analyse portent sur tout le compte, aucune n'a de lien vers un import (`link_id` n'est rempli que par la notification critique, et désigne une anomalie ou un risque). Aucun lien fiable → **aucune alerte n'est supprimée** ; le message de fin dit « Relancez l'analyse pour mettre les alertes à jour. »
- Preuve : `tests/supprimer_import.test.js` (4 cas, dans `npm test`) — Observations de l'import effacées et celles de l'autre import conservées ; les 3 alertes du compte survivent ; Observations indélébiles → import conservé ; type invalide → rien supprimé. Rejoué sur l'ancienne logique (copie hors dépôt) : 3 cas sur 4 échouent.
- « Tout supprimer » n'est pas modifié (il efface déjà tout, Observations et alertes comprises).

### 2.3 Données de test en production — action d'Issa (liste de contrôle, points 2 et 3).

**Résultat `./qa/run-all.sh` après le lot 2** : toutes les couches passent — build OK, porte 0, `npm test` 199/199, 29/29 Deno, 154/154 navigateur, lint 23, typecheck 146, aucun nouveau constat.

## Lot 3 — Interface

### 3.1 Succursales et régions fictives pré-remplies (moyen) — corrigé
- Nouveau `src/lib/organisationParDefaut.js` : la seule structure par défaut, **vide** (`active_levels` de base, listes vides), importée par `Parametres.jsx` et `OrganizationPanel.jsx` (les deux copies des exemples sont supprimées). Les exemples restent en texte d'aide des champs de saisie. Une succursale ajoutée sans région choisie prend la première région saisie, plus « Grand Montréal ».
- Preuve : scénario K ajouté à l'agent (`qa/e2e/agent-qa.spec.js`) — onglet Organisation d'une entreprise sans structure : aucun exemple affiché ; « Enregistrer » n'écrit aucune liste non vide. Sur le code d'origine : échec (7 exemples affichés).
- Même défaut ailleurs, **non corrigé** (hors du périmètre décrit, demande de vraies données) : `src/components/settings/UnderstandingPanel.jsx` affiche en dur « Succursales physiques (Montréal, Québec, Laval, Lévis) » et « Degré de confiance sémantique moyen : 98.2 % » comme si c'était ce que GESCOP a compris de l'entreprise. De même, les valeurs initiales du dictionnaire (`Parametres.jsx`, « Succursale → location_id », « Coût Total ($) »…) sont enregistrées au premier « Enregistrer » et servent ensuite à l'import. À décider.

### 3.2 Textes en double dans Paramètres (moyen) — corrigé
- Recherche du motif dans tout `src/` (texte en dur immédiatement suivi de `{t("clé", "même texte")}`) : **8** occurrences, toutes dans `Parametres.jsx` (les 7 listées + le bouton de la barre du bas). Seul l'appel `t(...)` est gardé (`t` retombe sur le texte français fourni : rien ne disparaît).
- Deux doublons de la même famille trouvés en plus : le menu des onglets affichait le libellé **et** sa traduction côte à côte (« Organisation & Succursales » + « Structure & Organisation » : c'est le « Organis… Struct… » du constat 3.3) ; la barre du bas avait deux boutons « Enregistrer les modifications ». Le menu affiche maintenant le titre traduit et, dessous, sa description (`tab_*_desc`) ; un seul bouton en bas.
- Le nouveau détecteur a trouvé le même défaut dans **Paramètres > Préférences** (`components/settings/PreferencesPanel.jsx`, variante `isEn ? "…" : "même texte"`) : titre affiché deux fois, sous-titre et libellé « Langue » en double, et **deux `value`/`onChange` sur le choix de langue** (le second gagnait en silence ; le premier, qui ne changeait pas la langue de l'interface, est retiré — comportement inchangé). Une recherche de la variante `isEn` dans tout `src/` et de tous les attributs JSX en double ne trouve rien d'autre. Garde-fou : règle ESLint `react/jsx-no-duplicate-props` ajoutée à `eslint.config.js`.
- Preuve : détecteur ajouté à l'agent (`textesRepetes` : même segment de 15 caractères ou plus collé à lui-même) sur chaque page des scénarios A et B et chaque onglet de Paramètres (scénario I) → constat « texte affiché en double ». Sur l'ancien `Parametres.jsx` il signale « Centre de Configuration & Contexte Entreprise | Référentiel central… | Enregistrer les modifications » ; après correction, aucun.

### 3.3 Débordement horizontal sur mobile (mineur) — corrigé
- `Taches.jsx`, `Kpis.jsx`, barre du bas de `Parametres.jsx` : `flex-wrap` et espacement sur les barres d'actions ; `Audit.jsx` : la liste d'onglets passe à la ligne ; `components/kpis/DomainScoreList.jsx` : la colonne centrale avait `flex-1` sans `min-w-0` (le texte tronqué imposait sa largeur) et le score une largeur fixe.
- Mesure à 390 px : Paramètres 848 → 390 px, Tâches 507 → 390, Audit 453 → 390, KPI 399 → 390. Preuve : scénario C sans constat de débordement.

### 3.4 Structure HTML invalide dans Facturation (mineur) — corrigé
- `Facturation.jsx` : le `<p>` qui contenait le badge « Sécurisée » devient un `<div>` (même rendu). Preuve : plus de `validateDOMNesting` sur `/facturation`, `/parametres/facturation` et l'onglet Facturation dans l'agent.

**Résultat `./qa/run-all.sh` après le lot 3** : toutes les couches passent — build OK, porte 0, `npm test` 199/199, 30/30 Deno, **155/155** navigateur (scénario K ajouté), lint 23, typecheck **145** ; aucun nouveau constat ; disparus : les 4 débordements mobiles, les 5 `validateDOMNesting` de Facturation. Restent (déjà au départ, hors mission) : « 0 $ » sur Tarifs/Facturation (prix d'un forfait gratuit, faux positif de l'agent) et `/facturation` absente du menu (accessible par Paramètres > Abonnement).
Outil QA : deux lancements ont échoué sur l'expiration du **premier** `page.goto('/login')` (serveur de dev froid, jamais sur une page modifiée) ; sous Windows la navigation a maintenant 45 s (20 s ailleurs) et le préchauffage charge 4 pages jusqu'au repos du réseau.

## Lot 4 — Intelligence artificielle

### 4.1 Modèle obsolète pour l'enrichissement par site web (moyen) — corrigé
- Liste des modèles acceptés par `InvokeLLM` : la documentation Base44 en ligne ne la donne pas (pages *AI integrations*, *Backend functions*), mais le SDK utilisé par les fonctions (`npm:@base44/sdk@0.8.48`, `InvokeLLMParams.model`) la fixe : `gpt_5_mini`, `gemini_3_flash`, `gpt_5_4`, `gpt_5_6_sol`, `gpt_5_6_luna`, `gemini_3_1_pro`, `claude_sonnet_4_6`, `claude_opus_4_6`, `claude_opus_4_7`, `claude_opus_4_8`, `claude-sonnet-5`. `claude-3-5-sonnet` n'en fait pas partie.
- `enrichFromWebsite` utilise maintenant `gemini_3_flash` (rapide, comme les autres appels courts de l'app ; l'appel demande la recherche web `add_context_from_internet`, assurée par les modèles Gemini chez Base44 d'après la description du SDK « Google Search, Maps, and News »). Le choix est centralisé dans `base44/shared/modelesLLM.ts` (liste de référence + `MODELE_ENRICHISSEMENT_WEB`).
- Preuve : `qa/recette/QA05-modeles-llm.ts` — la liste de référence est identique à celle du SDK installé, et chaque `model: "…"` des fonctions y figure ; sur le code d'origine, `enrichFromWebsite` échoue (« claude-3-5-sonnet » refusé). Le vrai comportement (nom et secteur pré-remplis) ne se vérifie qu'en ligne : point 6 de la liste de contrôle.
- **À trancher par Issa** : `importMultiData` (lecture des fichiers par l'IA) et `scanExternalRadar` utilisent `gemini_3_8_flash`, **absent de la liste du SDK 0.8.48**. Non modifié (hors du périmètre décrit, et je ne peux pas savoir si le serveur Base44 l'accepte déjà). Si ce nom est refusé, l'import retombe sur les règles déterministes (prévu et annoncé à l'écran) et le radar échoue. QA05 l'affiche en « note » sans échouer ; à remplacer par `gemini_3_flash` si l'éditeur Base44 ne le propose pas.

**Résultat `./qa/run-all.sh` après le lot 4** : toutes les couches passent — build OK, porte 0, `npm test` 199/199, **31/31** Deno (QA05 ajouté), 155/155 navigateur, lint 23, typecheck 145, aucun nouveau constat.

## Lot 5 — Hygiène

- `npm run lint:fix` : **23 → 0 erreur** de lint ; il n'a retiré que des imports inutilisés (`AuthLayout.jsx`, `Facturation.jsx`, `Manuel.jsx`, `Tarifs.jsx`), vérifié ligne à ligne. Rien à corriger à la main. Restent 34 avertissements (variables inutilisées), hors objectif.
- Typecheck : **146 → 145** erreurs (plafond de 146 respecté ; la baisse date du lot 3).
- `AGENTS.md`, section « ACTUAL PIPELINE STATUS » : paragraphe « Correctifs de l'agent QA (24 Sept 2026) » ajouté (ce qui a changé, et ce qui reste ouvert).
- Outil QA : le scénario G (erreur d'import) a expiré une fois sur `setInputFiles` (3 s) pendant que `/importer` s'affichait sous charge ; F et G ont maintenant 15 s pour cette étape (F et G rejoués 4 fois : 8/8).

**Résultat `./qa/run-all.sh` après le lot 5** : toutes les couches passent — build OK, porte 0, **lint 0**, typecheck 145, `npm test` 199/199, 31/31 Deno, 155/155 navigateur, aucun nouveau constat par rapport au départ.

---

## Bilan final

| | Départ | Fin |
|---|---|---|
| Build | OK | OK |
| `PLAYWRIGHT_TEST` dans `dist/` | 1 fichier | **0** (contrôlé) |
| `npm test` | 195/195 | **199/199** (+ `supprimer_import`) |
| Scripts Deno | 27/27 | **31/31** (+ QA02 à QA05) |
| Scénarios navigateur | 154/154 | **155/155** (+ K) |
| Lint (erreurs) | 23 | **0** |
| Typecheck (erreurs) | 146 | **145** |
| Constats critiques / majeurs | 0 / 0 (l'agent ne voyait pas les failles du lot 1) | 0 / 0 |
| Constats moyens / mineurs | 3 / 10 | 3 / 1 (restants hors mission, voir lot 3) |

Commits sur `correctifs-qa-2026-09` : lot 1, lot 1.3 (suite, après ta réponse), lot 2, lot 3, lot 4, lot 5. Rien n'a été publié, poussé, ni écrit dans la base de production.

**Décisions prises en cours de route** (toutes réversibles) : fenêtre de nouveauté des courriels critiques = 30 jours (`JOURS_NOUVEAUTE`) ; modèle d'enrichissement = `gemini_3_flash` ; workflows d'alerte conservés (sans effet) ; outil QA adapté à Windows (chemins, 2 navigateurs, 45 s de navigation, préchauffage sans appel réseau).

**Points ouverts à trancher**
1. `gemini_3_8_flash` (import IA, radar) n'est pas dans la liste des modèles du SDK 0.8.48 — vérifier dans l'éditeur Base44, sinon passer à `gemini_3_flash` (lot 4).
2. `UnderstandingPanel.jsx` affiche une compréhension inventée (succursales Montréal/Québec/Laval/Lévis, « 98,2 % ») ; les valeurs initiales du dictionnaire sont enregistrées au premier « Enregistrer » (lot 3).
3. Fichiers parasites suivis par git à la racine : `derniers ajustements` (+ U+F022) et `tatus` (étape 0) — à supprimer (`git rm`) si tu le souhaites.
4. `deno.json` : créé par `qa/run-all.sh` s'il manque, laissé non suivi ; `deno.lock` est modifié à chaque lancement des scripts Deno, jamais commité.
5. Les deux workflows d'alerte peuvent être supprimés dans l'éditeur Base44.

## Liste de contrôle d'Issa (après `npm run deploy`, s'il décide de publier)

1. Navigateur privé sur l'app en ligne, ajouter `PLAYWRIGHT_TEST=true` dans le stockage local (outils de développement), recharger : on doit rester sur la page de connexion.
2. Connecté avec son compte : Importer, « Tout supprimer », puis importer un fichier de test, noter le chiffre d'affaires sur la page KPI, réimporter le même fichier : le chiffre ne doit pas bouger. (Rappel lot 2.3 : c'est aussi le moment de vider les données de test déjà en ligne avec « Tout supprimer ».)
3. Supprimer cet import : la page KPI revient à « non mesuré » et les alertes des autres imports sont toujours là (un message invite à relancer l'analyse).
4. L'adresse du fichier téléversé ne s'ouvre pas en navigation privée. Elle n'est pas affichée dans l'historique des imports : la relever dans l'onglet Réseau des outils de développement (réponse de `UploadPrivateFile`, champ `file_uri`) ou dans l'enregistrement `Import` du tableau de bord Base44. Vérifier aussi que l'import lui-même a réussi (c'est ce qui prouve que la fonction obtient bien l'URL signée).
5. Paramètres > Organisation : aucune succursale fictive ; titres affichés une seule fois (aussi dans Préférences).
6. Onboarding avec l'adresse d'un vrai site web : le nom et le secteur se pré-remplissent.
7. Lancer une analyse qui produit une anomalie critique (ou un risque d'urgence élevée) : le courriel arrive. Relancer l'analyse : **pas** de second courriel pour le même titre (règle des 30 jours). Vérifier aussi qu'une alerte « anomaly » apparaît dans la cloche.
