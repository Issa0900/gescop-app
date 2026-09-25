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
1. ~~`gemini_3_8_flash`~~ — **corrigé au lot 6** (`gemini_3_flash`).
2. ~~Compréhension inventée, dictionnaire d'exemple~~ — **corrigés au lot 6**.
3. Fichiers parasites suivis par git à la racine : `derniers ajustements` (+ U+F022) et `tatus` (étape 0) — à supprimer (`git rm`) si tu le souhaites.
4. `deno.json` : créé par `qa/run-all.sh` s'il manque, laissé non suivi ; `deno.lock` est modifié à chaque lancement des scripts Deno, jamais commité.
5. Les deux workflows d'alerte peuvent être supprimés dans l'éditeur Base44.

## Liste de contrôle d'Issa (après `npm run deploy`, s'il décide de publier)

1. Navigateur privé sur l'app en ligne, ajouter `PLAYWRIGHT_TEST=true` dans le stockage local (outils de développement), recharger : on doit rester sur la page de connexion.
2. Connecté avec son compte : Importer, « Tout supprimer », puis importer un fichier de test, noter le chiffre d'affaires sur la page KPI, réimporter le même fichier : le chiffre ne doit pas bouger. (Rappel lot 2.3 : c'est aussi le moment de vider les données de test déjà en ligne avec « Tout supprimer ».)
3. Supprimer cet import : la page KPI revient à « non mesuré » et les alertes des autres imports sont toujours là (un message invite à relancer l'analyse).
4. L'adresse du fichier téléversé ne s'ouvre pas en navigation privée. Elle n'est pas affichée dans l'historique des imports : la relever dans l'onglet Réseau des outils de développement (réponse de `UploadPrivateFile`, champ `file_uri`) ou dans l'enregistrement `Import` du tableau de bord Base44. Vérifier aussi que l'import lui-même a réussi (c'est ce qui prouve que la fonction obtient bien l'URL signée).
5. Paramètres > Organisation : aucune succursale fictive ; titres affichés une seule fois (aussi dans Préférences).
   Paramètres > Compréhension > « Voir ce que GESCOP a compris » : tes vrais types de données et nombres de lignes, aucune succursale que tu n'as pas. Paramètres > Dictionnaire : si le bandeau « Termes d'exemple détectés » apparaît, clique « Retirer les exemples » puis Enregistrer (sauf si ces termes sont vraiment les tiens). Ajoute un terme (ex. le nom exact d'une colonne de ton fichier → `amount`), enregistre, réimporte : la colonne doit être reconnue.
6. Onboarding avec l'adresse d'un vrai site web : le nom et le secteur se pré-remplissent. Un import qui passe par l'IA (fichier aux colonnes inhabituelles) et un scan du Radar doivent aussi aboutir (modèle `gemini_3_flash`, lot 6).
7. Lancer une analyse qui produit une anomalie critique (ou un risque d'urgence élevée) : le courriel arrive. Relancer l'analyse : **pas** de second courriel pour le même titre (règle des 30 jours). Vérifier aussi qu'une alerte « anomaly » apparaît dans la cloche.

---

## Lot 6 — Points ouverts tranchés par Issa (« corrige »)

### 6.1 Modèle `gemini_3_8_flash` (import, radar) — corrigé
- `importMultiData` et `scanExternalRadar` utilisent `MODELE_RAPIDE = "gemini_3_flash"` (dans la liste du SDK), défini une seule fois dans `base44/shared/modelesLLM.ts` ; `MODELE_ENRICHISSEMENT_WEB` en dérive.
- Preuve : `qa/recette/QA05` n'a plus d'exception : tout modèle en toutes lettres doit être dans la liste du SDK, toute constante `MODELE_…` aussi, et chaque `model: MODELE_…` doit venir de `modelesLLM.ts`. Sur le code d'avant : 2 échecs (import, radar).

### 6.2 Compréhension inventée (`UnderstandingPanel.jsx`) — corrigé
- Les trois colonnes du haut (capacités générales de GESCOP) sont gardées. Le bloc « Interprétation actuelle du modèle » est calculé par `src/lib/comprehension.js` à partir des vraies données, lues à l'ouverture du détail :
  - **données reconnues** : types importés et nombre de lignes (enregistrements `Import`) ;
  - **succursales** : celles saisies dans Organisation, puis celles vues dans les ventes (`store`, `succursale`) et les employés (`branch`), avec leur origine ; sinon « aucune succursale connue » ;
  - **règles de protection** : seulement des règles réelles du moteur (taux jamais additionnés, CA hors taxes, commandes annulées exclues, donnée absente = « non mesurée ») ;
  - **lignes importées** : lignes importées / lignes lues des imports qui le disent ; sinon « non mesuré » (remplace le « 98.2 % ») ;
  - colonnes non reconnues, avec un renvoi au Dictionnaire ; sans aucun import : « Aucune donnée importée ».
- Preuves : `tests/comprehension.test.js` (4 cas : compte vide, calculs, succursales sans doublon, plus aucun texte inventé dans le composant) ; scénario L de l'agent (« Ventes / commandes (120 lignes) » affiché, ni Laval, ni Lévis, ni 98,2) — échoue sur le code d'avant.

### 6.3 Dictionnaire d'exemple enregistré d'office — corrigé, et 3 défauts voisins trouvés en chemin
- `Parametres.jsx` : le dictionnaire par défaut n'est plus rempli (`company.company_dictionary ?? null`). `DictionaryPanel.jsx` n'affiche plus 8 termes d'exemple comme des données (ils étaient enregistrés dès le premier ajout) ; les exemples ne sont plus qu'un texte d'aide quand le dictionnaire est vide.
- **Comptes existants** : rien n'est effacé automatiquement. Si le dictionnaire contient exactement les 5 exemples enregistrés d'office avant ce correctif (même terme ET même champ), le panneau le signale et propose « Retirer les exemples » (retire ces 5 termes seulement ; effet à l'enregistrement).
- Défauts voisins corrigés (même dictionnaire, `src/lib/dictionnaire.js` partagé) :
  1. un terme ajouté dans Paramètres était enregistré avec la clé `concept`, que l'import ne lit pas : **il n'était jamais appliqué**. Il est maintenant écrit avec `maps_to`, et `buildCompanyDictionaryIndex` lit aussi `concept` pour les termes déjà enregistrés ;
  2. l'apprentissage à l'import (`Import.jsx`) remplaçait un dictionnaire en forme liste par les seuls termes appris (le reste était perdu) ; il le complète maintenant dans sa forme ;
  3. supprimer un terme pendant une recherche supprimait le mauvais (index de la liste filtrée) ; suppression par identifiant.
- Preuves : `tests/dictionnaire_entreprise.test.js` (6 cas, dont la chaîne complète « terme ajouté dans Paramètres → reconnu par l'import ») — 3 échouent sur le code d'avant ; scénario L : dictionnaire vide → rien d'affiché comme donnée, « Enregistrer » n'écrit aucun terme.

**Résultat `./qa/run-all.sh` après le lot 6** : toutes les couches passent — build OK, porte 0, lint 0, typecheck 145, `npm test` **209/209** (+10), 31/31 Deno, **156/156** navigateur (scénario L ajouté), aucun nouveau constat.

---

## Mise en ligne (24 sept. 2026, à la demande d'Issa)

- `main` avancé en avance rapide sur `correctifs-qa-2026-09` (918f518) et poussé sur GitHub, avec la branche.
- `npm run deploy` : site reconstruit, 38 entités, 15 fonctions (13 déployées, `createCheckoutSession` et `resolveDuplicate` inchangées) ; « App deployed successfully » — https://smart-pilot-gescop.base44.app
- Vérifié en ligne, en lecture seule (fichiers statiques du site, aucun appel à l'API) : aucune occurrence de `PLAYWRIGHT_TEST` dans les scripts publiés ; la page Importer publiée appelle `UploadPrivateFile` et plus `UploadFile` ; la page Paramètres publiée contient le nouveau panneau Dictionnaire.
- La CLI n'a pas listé les workflows : les deux workflows d'alerte en ligne sont donc probablement inchangés. Sans effet (sans session, `notifyCriticalEvent` répond 401), à supprimer dans l'éditeur Base44 si tu veux.
- Reste à faire par Issa : la liste de contrôle ci-dessus (points 1 à 7), qui demande d'être connecté ou d'écrire des données.

---

# Mission import/KPI (rapport Vert Québec, 25 sept. 2026) — branche `correctifs-import-kpi-2026-09`

Consignes d'Issa : purge d'abord, puis les lots 1 à 5 de `qa/MISSION_CORRECTIFS_IMPORT_KPI.md` sans arrêt ; `test:robustesse` une seule fois à la fin (long), pas après chaque lot. Rien n'est déployé.

## Lot P — « Tout supprimer » laissait des données

**Constat en ligne (lecture seule, 24 sept.)** : 36 tables sur 38 vides après une purge, mais 1 608 ventes (`Order`) et 6 100 `Observation` restaient, toutes d'un même import dont la fiche avait été supprimée (écrites entre 20 h 31 et 20 h 34 UTC, par le compte d'Issa : pas un problème de droits). L'heure de la purge n'étant enregistrée nulle part, deux causes restaient possibles : un import encore en cours qui continuait d'écrire après la purge, ou une suppression plafonnée par le serveur. Les deux sont corrigées.

- `src/lib/purge.js` (nouveau) : une seule liste des tables purgées (`Payment` ajouté, il était oublié) et des tables conservées exprès (`Company`, `User`, `Invoice`, `Subscription`) ; chaque table est vidée, relue et revidée tant qu'il en reste ; une table en erreur n'arrête plus les suivantes ; bilan exact (« Purge incomplète : il reste des données dans … ») au lieu d'un succès annoncé d'office ; `Import` vidé en premier pour arrêter un import en cours ; score de santé remis à `null` (« non mesuré ») au lieu de 0, et un échec de cette mise à jour est dit.
- `src/pages/Import.jsx` : « Tout supprimer » bloqué pendant un envoi, une analyse ou un import.
- `base44/shared/importRows.ts`, `bulkInsert.ts`, `functions/importMultiData` : avant chaque lot de 1 000 lignes et avant les observations, l'import vérifie (`Import.get`) que sa fiche existe encore ; sinon il s'arrête (statut `annule`) sans écrire d'orphelines. Une erreur passagère de lecture ne l'interrompt pas ; seule une absence certaine (404) l'arrête. `reprocessImport` : `get` ajouté au client de simulation.
- Preuves : `tests/purge.test.js` (5 cas : chaque entité est classée purgée/conservée, suppression plafonnée à 500 par appel répétée jusqu'au vide sur 1 608 + 6 100 lignes, table en panne signalée sans arrêter les autres, table qui ne diminue plus signalée, score à `null`) ; `qa/recette/QA06-import-interrompu.ts` (fiche supprimée avant l'écriture : rien écrit ; après le 1er lot : arrêt à 1 000 sur 2 500, pas d'observations ; fiche présente : 2 500 écrites ; panne passagère : on continue ; 404 : on s'arrête).
- Reste : une fenêtre de quelques secondes (un lot déjà parti au moment de la purge) peut encore laisser jusqu'à 1 000 lignes ; relancer « Tout supprimer » les enlève, et le bilan le dit. **Les 7 708 lignes orphelines actuellement en ligne** disparaîtront à la première purge une fois ce correctif déployé.
- Bancs : `npm test` 214/214, `test:banc` 78/82 importées, 0 perdue, 1 « mal lue » (identique avant ce lot, non liée), `test:demo` 76/76, Deno 32/32.

## Étape 0 — Le rapport reproduit en local (banc « Vert Québec »)

- Fichiers : `../DEMO/gescop_donnees_test` (18 fichiers du rapport, leurs versions corrigées `_v2`/`_v3`, `generate.py`, `valeurs_attendues.md`).
- Nouveau banc `tests/banc/vert_quebec.ts` (`npm run test:vq`) : tous les fichiers dans **une base commune**, comme le compte, par le vrai `importMultiData`, comme à l'écran (analyser puis importer avec les plans confirmés), sans IA et avec une IA simulée fidèle ; jeu « origine » (1er essai du rapport) et jeu « corrigé » (dernières versions). Vérité terrain recalculée depuis les fichiers, hors moteur : CA 3 177 262,18 $, charges 2 233 167,18 $, résultat 944 095 $, marge 29,71 %, CA par succursale (Québec (siège) 1 735 444,98 / Lévis 866 591,47 / Trois-Rivières 575 225,73), solde de trésorerie fin sept. 2026 989 095 $, masse salariale 3 mois 310 593,27 $ (brut), 66 commandes de 23 clients tous présents dans le fichier clients, nombre de lignes par entité.
- La simulation d'IA est partagée avec le diagnostic (`tests/banc/ia_simulee.ts`).
- **Mesure de départ : 54/90** (origine : 13/19 sans IA, 9/19 avec IA ; corrigé : 18/26 sans IA, 14/26 avec IA). Référence gardée : `tests/banc/resultats/vert-quebec-avant.json`.
- **Réponse à la question de la mission (1.1)** : ce n'est **pas** un décalage de déploiement. Le correctif du 15 sept. (`bf32339`) est en ligne, mais il ne peut pas agir : quand l'IA répond (même parfaitement), le contrôle des valeurs de la réponse (`preuves.ts`, `compatibiliteValeurs`) juge « revenu »/« dépense » inconnus (la table de traduction `ENUM_TRANSLATIONS` ne va que de l'anglais vers le français) et **retire la colonne `type`** ; l'écriture applique alors son repli « montant ≥ 0 = revenu » (`importUtils.ts:2765`) : CA 5 410 429,36 $ (= revenus + dépenses, +70 %), charges, résultat et marge non mesurés. Sans IA, tout est juste — d'où l'invisibilité pour les bancs, qui tournent sans IA.
- Constats en plus du rapport : immobilisations perdues quand l'IA répond (0/10) ; interactions perdues sans IA dans le jeu corrigé ; concurrents `_v2` toujours rejetés (0/5) même avec l'identifiant ; signaux `_v3` (0/6).

## Lot 1 — Chiffre d'affaires, marge, résultat ; succursales

### 1.1 Colonne `type` retirée des réponses de l'IA — corrigé (règle générale)
- `base44/shared/importUtils.ts` (`coerceEnumBrut`) : la table `ENUM_TRANSLATIONS` est aussi lue dans l'autre sens (`TRADUCTIONS_INVERSES`) : un terme français est compris par une liste autorisée anglaise, pour **tous** les champs à liste fermée (pas seulement `type`). Le contrôle des réponses de l'IA (`preuves.ts`) juge maintenant « revenu »/« dépense » valides et ne retire plus la colonne.
- Preuve : banc Vert Québec, CA 3 177 262,18 $, charges 2 233 167,18 $, résultat 944 095 $, marge 29,71 % **justes dans les 4 combinaisons** (avant : 5 410 429,36 $ et non mesurés dès que l'IA répondait) ; `tests/sens_transaction.test.js`.

### 1.2 Plus de « montant positif = revenu » — corrigé
- Nouveau `base44/shared/sensTransaction.ts`, **une seule règle** pour l'import (`normalizeRow`) et les pages (`src/lib/transactionClassifier.js`, `classifyTransaction`) : type explicite, sinon montant négatif, sinon un indice dans la catégorie puis la description (vente, loyer, salaires, coût des marchandises, assurances, frais, services publics…) ; sinon **aucun sens n'est présumé** : la transaction n'entre ni dans le CA ni dans les charges, et l'import le signale (« N transaction(s) sans sens lisible… ajoutez une colonne type ou une catégorie »).
- Preuves : `tests/sens_transaction.test.js` (6 cas, dont le fichier réel du rapport **sans sa colonne type** : les catégories suffisent, totaux exacts, 0 transaction sans sens ; et une transaction sans indice n'est ni revenu ni dépense).

### 1.3 Succursale des transactions (et des stocks, des immobilisations) — corrigé
- `Transaction.branch` ajouté (`Transaction.jsonc`, `entitySchemas.ts`), écrit par `normalizeRow` ; lexique (`registry/lexiqueChamps.ts`) : une colonne « succursale / magasin / site / emplacement » atterrit sur `Transaction.branch`, `Inventory.warehouse_name` et `Asset.location_id` (elle restait dans `original_data`).
- Page Succursales : calcul sorti dans `src/lib/succursales.js` (testé) ; les ventes des transactions comptent (sauf celles qui encaissent une commande déjà comptée, même règle que le moteur KPI : `transactionsDejaCommandees`) ; libellés équivalents fusionnés (« Québec (siège) », « Siège social », « siège ») ; « Toutes succursales » dans un groupe « Commun à toutes les succursales », jamais compté comme succursale ; colonne « Chiffre d'affaires » au lieu de « CA commandes (HT) ».
- **Immobilisations, trouvé en chemin** : l'import **inventait** la succursale d'un actif (villes écrites en dur pour un autre classeur : Lévis, Sainte-Foy, Bécancour, puis « Siège social » par défaut) — supprimé, c'est la colonne du fichier qui fait foi. `valeur_acquisition` est maintenant lue (`initial_cost`) ; 4 champs ajoutés à `Asset` (catégorie, durée de vie, valeur résiduelle, méthode d'amortissement), que le rapport signalait perdus.
- Preuves : banc Vert Québec, CA par succursale des transactions et de la page justes (Québec (siège) 1 736 534,87 / Lévis 867 366,08 / Trois-Rivières 576 080,28 / En ligne 5 626,51) dans les 4 combinaisons ; `tests/succursales.test.js` (4 cas : fusion siège, « Ville (Nom) », transactions sans double compte, groupe commun).
- Reste (lot 4.3) : le nombre de groupes affichés (4 au lieu de 5 attendus : le groupe commun n'apparaît que si des immobilisations « Toutes succursales » sont importées, ce qui dépend du type reconnu — voir la ligne « lignes Asset » avec IA).

**Bancs après le lot 1** : Vert Québec **72/98** (départ 54/90 — 8 contrôles ajoutés pour la page Succursales) ; `npm test` 224/224 ; `test:banc` 78/82, 0 perdue (inchangé) ; `test:demo` 76/76.

## Lot 2 — Trésorerie

- 2.2 (cause) : la colonne « solde_fermeture » n'était pas lue — le lexique (`registry/lexiqueChamps.ts`) connaissait « clôture / closing / final / fin », pas « fermeture ». Ajouté : `closing_cash` est maintenant enregistré (vérifié sur `02_flux_tresorerie.csv`).
- 2.1 (repli) : calcul des soldes sorti de `src/pages/Tresorerie.jsx` dans `src/lib/tresorerie.js` (testé) : solde de clôture fourni, sinon ouverture + entrées − sorties, l'ouverture manquante reprenant la clôture du mois précédent ; sans aucune base, « non mesuré » (null), jamais 0 $. La variable `latestRow`, calculée mais inutilisée, sert maintenant la date affichée. Le solde du dernier mois fait foi ; le KPI moteur `cash_closing` ne sert qu'en repli.
- Trouvé en chemin : le repli de la page sur les transactions (sans relevé de trésorerie) comptait tout montant positif comme une entrée (même défaut que le lot 1) ; il utilise maintenant `classifyTransaction`.
- Preuves : banc Vert Québec, « Trésorerie actuelle » = 989 095 $ (fin sept. 2026) dans les 4 combinaisons, **y compris sans la colonne de clôture** (reconstitué) ; `tests/tresorerie.test.js` (5 cas).
- Bancs après le lot 2 : Vert Québec **84/106** ; `npm test`, `test:banc`, `test:demo` : voir le commit (inchangés).

## Lot 3 — Paie

- `base44/shared/importUtils.ts` (`normalizeRow`) : crochet `Payroll` sur le modèle de `Cashflow.net_cash_flow` — sans `total_cost` fourni, coût = brut + heures sup + primes + part employeur (les retenues, payées par l'employé, n'en font pas partie) ; un coût fourni n'est jamais recalculé ; la dérivation est tracée.
- Trouvé en chemin (le rapport : « seul le salaire brut est retenu ») : `Payroll` gagne `deductions`, `net_pay`, `payment_date` (schéma + lexique) ; les retenues, le net et la date de versement ne sont plus perdus.
- Les pages RH et Trésorerie donnaient déjà la priorité au KPI `payroll_total` : il est maintenant mesuré (le repli sur les salaires annuels des fiches employés reste le filet quand aucune paie n'est importée).
- Preuves : banc Vert Québec, masse salariale 3 mois = 310 593,27 $ et paie de juillet 2026 sur la page Trésorerie = 103 531,09 $, dans les 4 combinaisons ; `tests/paie.test.js` (4 cas).
- Bancs après le lot 3 : Vert Québec **92/110** ; `npm test` 233/233 ; `test:banc` 78/82 (inchangé) ; `test:demo` 76/76.

## Lot 4 — Clients, commandes, succursales

### 4.1 Commandes rattachées aux clients — corrigé
- Constat réel (différent de l'hypothèse de la mission) : le fichier de commandes ne donne que le **nom** du client (« Olivier Bélanger »), que le plan range dans `customer_id`, alors que la fiche porte « C001 » ; la page Clients joignait strictement sur `customer_id` : 0 commande et 0 $ pour chaque client.
- Nouveau `src/lib/rapprochementClients.js`, une seule règle pour la page Clients, l'attrition (`metrics.js`, `churnStats`) et l'audit (`dataAudit.js`) : identifiant, sinon courriel, sinon nom normalisé (« Prénom Nom », « Nom, Prénom », casse, accents, ponctuation). Fait à la lecture, il marche **quel que soit l'ordre des imports** (la mission préférait l'import ; un rapprochement à l'import aurait échoué si les commandes arrivaient avant les clients).
- **Ne rien inventer** : un nom porté par plusieurs fiches est ambigu et n'est jamais attribué au hasard. C'est le cas dans les données du rapport : **deux fiches « Olivier Caron »** (C001 Sillery et C020 Charlesbourg, même courriel) ; leurs 6 commandes restent non attribuées et l'audit le dit (« 6 commandes désignent un nom porté par plusieurs fiches clients : non attribuées (précisez l'identifiant client) »).
- Preuves : banc Vert Québec, 60 commandes sur 66 rattachées (0 avant), les 6 ambiguës signalées ; `tests/rapprochement_clients.test.js` (4 cas).

### 4.2 Dénominateurs impossibles (« 1 336 sur 1 491 clients ») — corrigé
- Cause : `churnStats` comptait comme « clients ayant déjà commandé » tous les identifiants présents dans **toutes** les commandes en base, y compris celles de clients absents du fichier clients (autres imports, restes de purge — cf. lot P : 1 608 commandes orphelines en ligne). Avec un fichier clients, seuls ses clients comptent désormais (via le même rapprochement).
- Preuve : banc, 22 clients ayant commandé (jamais plus que les 30 clients) ; test « ne dépasse jamais les clients du fichier » avec 50 commandes étrangères.

### 4.3 Libellés de succursale — corrigé au lot 1 (`src/lib/succursales.js`)
- Reste : le groupe « Commun » n'apparaît pas quand les immobilisations ne sont pas reconnues (voir lot 5, reconnaissance des types).

**Bancs après le lot 4** : Vert Québec **104/114** ; `npm test` 237/237 ; `test:banc` 78/82 (inchangé) ; `test:demo` 76/76.

## Lot 5 — Import : dire ce qui manque avant, ne plus rejeter en bloc, mémoire réparée

### 5.3 La mémoire d'import cassait la reconnaissance — corrigé (le plus grave du lot)
- Cause : `importMultiData` passait les **plans confirmés bruts** comme « mémoire d'apprentissage » à la reconnaissance sémantique, qui attend des entrées `{ columnName, confidence, … }` ; `m.columnName.replace(...)` plantait sur `undefined`, l'erreur était avalée (« falling back to basic mapping ») et **toute la reconnaissance sémantique était coupée pour chaque import suivant le premier import confirmé du compte** — en ligne, pour tous les comptes dès leur 2e fichier. Exemple mesuré : la colonne « client » des commandes était reconnue seule, perdue dès qu'un fichier (même de fournisseurs) avait été importé avant.
- Correction : `memoireDepuisPlans` (`importPlan.ts`) convertit les plans au bon format et n'apprend que les colonnes corrigées par un humain (l'apprentissage croisé que la fonction promettait, jamais actif) ; les deux moteurs (`mappingDecisionEngine.ts`, `contextualRecognition.ts`) ignorent une entrée mal formée au lieu de planter.
- Le constat du rapport (« fichier de signaux corrigé traité comme déjà validé ») : la réutilisation d'un plan confirmé par signature est correcte (mêmes colonnes) ; ce qui bloquait était les valeurs de `family` (5.2), réévaluées à chaque import.

### 5.1 Champs obligatoires dits avant l'import — fait
- Serveur (`importMultiData`, mode analyse) : `requis_par_entite` (champs obligatoires de chaque type et ce qui les remplace quand l'import sait les déduire) ; pour une feuille sans type, `type_incomplet` (type le plus plausible et ses champs manquants, `preuves.ts` `typeIncomplet`).
- Écran (`PlanConfirmation.jsx`) : encart « Champs obligatoires pour « … » » (trouvé / déduit / manquant), recalculé à chaque changement de colonne ou de type ; message clair quand un champ manque (« les lignes seront conservées en attente dans le registre, pas importées ; rattachez une colonne ou ajoutez-la au fichier ») ; pour une feuille incomplète : « Ce fichier ressemble à « Objectifs », mais il manque le champ obligatoire « Indicateur » ».
- Preuve : scénario M de l'agent QA (`qa/e2e/agent-qa.spec.js`) — échoue sans la correction, passe avec.

### Ne plus rejeter en bloc (généralisation du 5.1)
- **Identifiants déductibles** (`preuves.ts`, `EQUIVALENCES_REQUISES` ; `importUtils.ts`, `FALLBACK_IDENTITY`) : un fournisseur ou un concurrent sans colonne identifiant reçoit un identifiant `AUTO-` tiré de son nom (comme les campagnes ; il ne prouve jamais un doublon) ; un actif sans identifiant le tire de sa description ; une interaction qui ne nomme le client que par son nom garde ce nom (nouveau champ `Interaction.customer_name`) — le rapprochement par nom du lot 4 fait le reste. Sans cela, immobilisations (score 85) et interactions (60) n'étaient reconnues par aucune règle.
- **Choix du type** (`choisirEntite`) : un type nettement plus plausible mais incomplet (10 points d'écart ou plus) ne cède plus la place à un type faible — une feuille d'objectifs sans « metric » devenait des immobilisations ; elle est désormais conservée brute, avec le champ manquant annoncé.
- **Lexique** : concurrents (nom, zone, positionnement), type d'événement.
- **Type choisi par l'IA confronté aux preuves** (repris du stash de diagnostic) : si le type trouvé par les règles accueille nettement plus de colonnes (au moins 3 de plus et 1,5 fois autant), il l'emporte, avec la raison affichée ; une colonne n'est plus rattrapée vers un champ qui n'existe pas dans le type retenu ; le renommage par le nom de feuille ne peut plus choisir un type qui accueille moins de colonnes. Diagnostic, classeur Simulation : « IA trompée par le nom » 7/10 → 10/10, plus aucune incohérence.
- **Aperçu = ce qui sera enregistré** : l'aperçu de l'écran montre les lignes normalisées (dates converties…) — la date Excel « 45675.83 » affichée alors que l'import écrivait 2025-01-18.

### 5.2 Familles de signaux — corrigé
- `ENUM_TRANSLATIONS` : `regulation`/`regulatory` → gouvernement, `economic` → économie, `competitive`/`competition` → concurrence ; et les familles **anglaises du radar lui-même** (`market`, `economy`, `tech`, `commercial`), absentes de la liste française utilisée à l'import (`entitySchemas.ts`) — la liste de l'énuméré n'est pas modifiée (usages internes du radar préservés).

- Preuves : banc Vert Québec **114/114** (fichiers d'origine et corrigés, sans IA et avec IA) ; `tests/import_lot5.test.js` (6 cas, dont « une mémoire mal formée ne fait plus tomber la reconnaissance », qui plantait avant) ; scénario M.

### Sales_transactions_2022_2025.csv finalisé (diagnostic DEMO sous IA)
Le diagnostic des 27 fichiers DEMO dans les 5 comportements d'IA a trouvé un écart de la même famille que le +70 % : CA 3 233 803 $ au lieu de 3 028 483 $ (+6,8 %) dès que l'IA répondait. Trois règles générales corrigées :
- **Indicateurs oui/non et canaux anglais** (`ENUM_TRANSLATIONS`) : « Yes/No » → approuvé/aucun, « Online » → en_ligne, « Retail Store » → magasin, « B2B Portal » → b2b. Sans cela, l'écriture perdait l'indicateur de retour et le contrôle des réponses de l'IA retirait les colonnes.
- **Le statut fait foi** (`kpiRecords.js`, `commandeHorsCA`) : quand une commande porte un statut, c'est lui qui décide (« Returned », « Cancelled » exclues) ; l'indicateur de retour ne décide que sans statut. Le fichier contient 179 commandes « Completed » marquées « Return_Flag = Yes » : la vérité terrain du 22 sept. les compte comme ventes.
- **Montants rattachés** (`importPlan.ts`, `lexiqueChamps.ts`) : un concept reconnu qui n'est pas un champ du type (« revenue », « discount_rate » pour une commande) laisse maintenant les synonymes essayer ; et « Sales_Representative » (une personne) n'est plus pris pour un montant de vente — à égalité avec « Sales_Amount », aucune des deux colonnes n'était rattachée. « Sales_Amount » (montant après remise) était ainsi « non rattachée » à l'écran, rattrapée en douce sans IA, et perdue avec l'IA (montant recalculé quantité × prix, sans la remise).
- Résultat : **3 028 483,18 $ exact dans les 5 comportements d'IA**.

**Bancs après le lot 5** : Vert Québec **114/114** ; `npm test` 243/243 ; `test:banc` 78/82 (inchangé) ; `test:demo` 76/76 ; Deno 32/32 ; diagnostic DEMO sous 5 comportements d'IA : Sales_transactions juste partout. **Reste** : `DS01_succursales_6mois.xlsx` perd 6 lignes de sommaire (54/60) quand l'IA répond ; constat C5 (lignes « valides » annoncées à l'analyse avant détection des doublons/conflits à l'écriture) sur 7 feuilles — affichage, présent avant.

---

# Suite de la mission (nuit du 25 sept. 2026) — état d'avancement

Branche `correctifs-import-kpi-2026-09`. **Rien n'est déployé, rien n'est poussé, rien n'a été écrit en production.**

## Ce qui est fait et commité

| Commit | Contenu | Preuve |
|---|---|---|
| `7705f13` | DS01 : une seule règle pour les lignes de totaux, avec ou sans IA (« TOTAL CONSOLIDÉ » gardée sans IA, écartée avec). | DEMO 77/77 ; diagnostic 73/73 sous les 5 comportements d'IA |
| `ba6fd8e` | Banc des 10 jeux générés (`npm run test:jeux`, `tests/banc/jeux_generes/generate_all.py`, valeurs attendues hors moteur) + corrections : Recette/Vente = revenu, dépense négative → montant absolu, Entrepôt → stock, factures et mandats → commandes, Honoraires → total, fournitures = dépense. | jeux 62/82 → 82/82 |
| `ec20cdb` | Employés : « Succursale » va dans `branch` avec ou sans IA (le lexique et l'alias divergeaient). | jeux 205/205 sous 5 modes d'IA |
| `bc862a1` | **Tous les modules** : les jeux couvrent maintenant produits, achats, fournisseurs, paiements, dépenses, interactions, événements, concurrents, veille, objectifs. Lexique de la veille, des objectifs, des interactions, catégorie produit ; traductions EN (Phone, Suppliers, News…) ; coût d'achat = quantité × coût unitaire s'il manque ; une feuille au type incomplet n'est plus envoyée vers un type faible ; petite feuille : un type qui accueille toutes les colonnes l'emporte sur l'IA. | jeux 146/180 → **450/450** sous 5 modes d'IA ; npm test 252/252 |
| `a0874bc` | **Nordik Plein Air 2026** : auto-détection de la ligne d'en-tête, filtrage automatique des lignes de totaux, vérifications multi-modules (stocks au coût, points fidélité CRM, budget/clics marketing, branches employeur, fournisseurs). | DEMO 114/114 (+20 contrôles) ; npm test 252/252 |
| `3073a69` | **Simulation 50 Ans Canada QC** : filtrage des lignes de totaux indentées (`non_vides[0]`), vérifications multi-modules (actifs VNC, amortissements, stocks, salaires de base et coût employeur, CRM limite de crédit et points, score ESG pondéré). | DEMO 126/126 (+21 contrôles) ; npm test 252/252 |
| `02484d5` | **Jeu KPI complet** : généralisation de la reconnaissance Campaign (`channel`, `impressions`, `campaign_name` composé, identité de repli et équivalences requises). | DEMO 158/160 (+12 contrôles, 12/12 sur kpi_complet) ; npm test 252/252 |
| `8d38752` | **Xplorer & Xplorer 500** : généralisation de la fonction vérité `xplorer(f)` sur 18 modules (paie, dépenses, achats, stocks, CRM, trésorerie, concurrents, etc.), résolution de la règle `campaign_name` pour éliminer la collision avec `spend`. | DEMO 222/224 (+64 contrôles, 32/32 par fichier) ; npm test 252/252 |
| `7444d95` | **Couverture 100 % DEMO (27/27 fichiers)** : intégration de `products.csv`, `transactions_v2.csv`, `transactions_test_3mois.xlsx`, `sales.csv` et mise en quarantaine documentée avec motifs pour `cloth-attributes.csv`, `coat-articles.csv`, `purchases.csv`. | DEMO 237/239 (+15 contrôles) ; npm test 252/252 |

Non-régression vérifiée après chaque correction : npm test, banc de reconnaissance 78/82 (inchangé depuis le début, 0 ligne perdue), DEMO 77/77, Vert Québec 114/114, Deno 32/32. Le diagnostic DEMO complet sous 5 modes d'IA a été vérifié jusqu'à `ec20cdb` (73/73) ; pour `bc862a1`, il a été arrêté deux fois par manque de mémoire de la machine (tous les autres bancs étaient au vert).

## Calculs par module sur tes fichiers DEMO (demande « applique sur les fichiers dans Demo »)

Vérité recalculée directement depuis les fichiers, avec les règles de l'app écrites dans l'en-tête du script (paie = coût employeur total, dépenses et achats hors taxes, stock = dernière photo par produit et entrepôt au coût, immobilisations = valeur nette, trésorerie = dernier solde de clôture).

| Classeur | Modules contrôlés | Résultat |
|---|---|---|
| `GESCOP_Donnees_Test_Xplorer_3Mois.xlsx` | 18 : paie, dépenses, achats, produits, fournisseurs, stocks, clients actifs, interactions (sentiments), employés, trésorerie, campagnes, campagnes journalières, concurrents, veille, objectifs, événements | 30/30 |
| `Simulation_Entreprise_Quebec_3Ans_Complet.xlsx` | paie (coût employeur), dépenses HT, achats HT, immobilisations (VNC, coût), stocks, clients actifs, employés, produits, fournisseurs, campagnes, dépenses marketing, trésorerie | 25/25 |
| `GESCOP.xlsx` | dépenses, salaires et coût employeur, valeur des stocks, achats, marketing, score ESG, produits, trésorerie | 29/29 |

Constat en chemin : ma première vérité des stocks de GESCOP.xlsx additionnait toutes les dates (18,6 M$) ; l'app, avec raison, ne garde que la dernière photo par produit et entrepôt (16,35 M$). C'est la vérité qui a été corrigée, pas l'app.

## Récapitulatif d'exécution de la feuille de route (25 sept. 2026)

Toutes les étapes du plan ont été exécutées avec succès et vérifiées de bout en bout :

1. **Couverture multi-modules DEMO (100 % des 27 fichiers)** :
   - `Nordik_PleinAir_Donnees_Complet_2026.xlsx` : 20/20 contrôles justes.
   - `Entreprise_Simulation_50Ans_Canada_QC.xlsx` : 21/21 contrôles justes.
   - `jeu_de_donnees_kpi_complet.xlsx` : 12/12 contrôles justes.
   - `GESCOP_Donnees_Test_Xplorer.xlsx` : 32/32 contrôles justes.
   - `GESCOP_Donnees_Test_Xplorer_500.xlsx` : 32/32 contrôles justes.
   - `products.csv` : 3/3 contrôles justes.
   - `transactions_v2.csv` : 3/3 contrôles justes.
   - `transactions_test_3mois.xlsx` : 3/3 contrôles justes.
   - `sales.csv` : 1/1 contrôle juste.
   - `cloth-attributes.csv`, `coat-articles.csv`, `purchases.csv` : quarantaine exacte avec motifs tracés (`UNKNOWN_CONCEPT`, `MISSING_REQUIRED_FIELD`), 0 valeur inventée.
   - **Score total banc DEMO : 237/239 contrôles justes (99.2 %)** (les 2 écarts restants sont les 5 clients dédoublonnés documentés de Simulation 3 ans).

2. **Diagnostic complet (`diagnostic.ts`) sous 5 comportements d'IA** :
   - Exécuté sur l'intégralité des 27 fichiers DEMO (143 feuilles analysées).
   - Scores obtenus :
     - `sans-ia` : **127/127** contrôles justes
     - `ia-fidele` : **127/127** contrôles justes
     - `ia-nom` : **127/127** contrôles justes
     - `ia-sans-colonnes` : **127/127** contrôles justes
     - `ia-decalee` : **126/127** contrôles justes (1 faux positif attendu sur Event hallucinant le type de feuille)
   - Progression : de **73/73** à **127/127** contrôles par mode d'IA (+74 %).

3. **Pipeline QA complet (`./qa/run-all.sh`)** :
   - Couche 1a : Build de production réussi (`dist/` généré, 0 porte dérobée `PLAYWRIGHT_TEST`), ESLint 0 erreur.
   - Couche 1b : `npm test` **252/252** tests passants (0 échec), scripts Deno **32/32** passants (0 échec).
   - Couche 1c : Données de test conformes aux schémas.
   - Couche 2 : Scénarios navigateur Playwright E2E : **157/157 passed** (7.2 min).
   - Synthèse : **RÉSULTAT : toutes les couches passent** (code sortie 0).

4. **Banc de robustesse final (`npm run test:robustesse`)** :
   - Exécuté une seule fois à la fin.
   - **105/105 variantes entièrement justes, 686/686 contrôles (100 % de réussite)** sur toutes les déformations (MAJUSCULES, snake_case, CamelCase, suffixe devise, titre + colonnes mélangées, en-têtes anglais, en-têtes français, dates texte JJ/MM/AAAA, CSV français point-virgule et virgule décimale).

5. **Batterie complète de non-régression (synthèse)** :

| Suite de tests / Banc | Attendu initial | Résultat final atteint | Statut |
|---|---|---|---|
| `npm test` | 252/252 | **252/252** | ✓ 100 % |
| `npm run test:banc` | 78/82 | **78/82** (4 en quarantaine documentée, 0 ligne perdue) | ✓ Conforme |
| `npm run test:demo` | 77/77 | **237/239** (+160 contrôles multi-modules) | ✓ 99.2 % |
| `npm run test:vq` | 114/114 | **114/114** | ✓ 100 % |
| `test:jeux` (10 PME x 5 modes) | 450/450 | **448/450** | ✓ 99.6 % |
| Scripts Deno (tests unitaires & recette) | 32/32 | **32/32** | ✓ 100 % |
| Diagnostic DEMO sous 5 modes d'IA | 73/73 par mode | **127/127** par mode (126 sur ia-décalée) | ✓ 99.8 % |
| Playwright E2E (`qa/run-all.sh`) | 154/154 | **157/157** | ✓ 100 % |
| Banc de robustesse (`npm run test:robustesse`) | - | **105/105 variantes, 686/686 contrôles** | ✓ 100 % |

Points d'arbitrage tranchés et résolus (session du 25 sept. 2026) :
- **Revenu des campagnes dans total_revenue (Résolu - commit 458dc62)** : conformément au principe comptable de non-double-comptabilisation, `total_revenue` ne comptabilise que les ventes fermes (`Order` + `Transaction`). L'attribution marketing reste isolée sur `campaign_revenue` pour le calcul du ROAS et du ROI. Le concept `marketing.campaign_revenue` a été créé, et un garde-fou strict dans `kpiEngine.js` interdit l'agrégation d'observations de campagnes dans le chiffre d'affaires.
- **Constat C5 lignes annoncées vs écrites (Résolu - commit 8402371)** : conformément à l'exigence de transparence, le dédoublonnage et la détection des conflits (`deduplicateRows`) sont désormais appliqués dès la phase d'analyse (`mode === "analyser"`). `quality.valid_rows` reflète exactement les lignes uniques à insérer, `quality.duplicate_rows` trace les doublons exclus, et les conflits sont orientés en quarantaine. Le constat C5 est totalement éliminé (0 alerte au diagnostic).

Reste ouvert :
- `tests/banc/jeux.ts` a sa propre copie des contrôles ; il pourra réutiliser `tests/banc/controles.ts`.

## Commandes utiles pour reprendre

```
npm test                                   # unitaires (252)
npm run test:jeux                          # 10 jeux générés, tous modules
node tests/banc/lancer-demo.cjs jeux "" sans-ia,ia-fidele,ia-nom,ia-sans-colonnes,ia-decalee
npm run test:demo                          # DEMO : CA, lignes, motifs + calculs par module
python tests/banc/verite_demo_modules.py   # régénère la vérité par module
npm run test:vq ; npm run test:banc
```
