# Mission : correctifs issus du rapport de test d'import et de fiabilité (25 septembre 2026)

Ce fichier s'adresse à Claude Code, dans VS Code, sur le dépôt `gescop-app` (Windows, dossier
`Desktop\GESCOP\gescop-app`). Il traduit en correctifs concrets les constats du rapport
`Rapport_test_GESCOP_1.docx` (18 fichiers, PME fictive « Vert Québec Inc. », ~850 lignes,
octobre 2025 à septembre 2026), testé sur l'app publiée `smart-pilot-gescop.base44.app`.

Contrairement à la mission du 24 septembre (`MISSION_CORRECTIFS.md`, sécurité/UI/IA), celle-ci
porte sur la chaîne import → mapping → KPI, déjà instrumentée par les bancs `tests/banc/`
(reconnaissance, DEMO, robustesse). La méthode de travail de ce dépôt est de corriger la règle
générale, jamais un cas particulier, et de le prouver par un banc plutôt que par une relecture
visuelle (mémoire : « Penser macro »).

## Constat qui change l'ordre des lots

Le correctif du type de transaction (revenu/dépense), qui semble être la cause racine du
problème n°1 ci-dessous, existe déjà dans ce dépôt : `base44/shared/importUtils.ts:2698-2707`
(commit `bf32339`, inclus dans le Lot 6 du 24 septembre, déployé le même jour d'après le
dernier compte rendu). Le rapport a pourtant été produit le lendemain sur l'app publiée et
constate quand même un chiffre d'affaires gonflé de 66 à 74 %. Deux explications possibles,
à départager avant d'écrire le moindre correctif sur ce point :

1. le correctif n'a pas réellement atteint la version publiée testée (décalage de déploiement) ;
2. le correctif ne couvre pas le cas du rapport (en-tête différent de `type` après canonicalisation,
   colonne concurrente qui écrase `r.type` plus loin dans le pipeline, ou agrégation du tableau de
   bord qui ne passe pas par `classifyTransaction`/`isIncome`/`isExpense`).

**Étape 0, avant le Lot 1 : obtenir d'Issa les 18 fichiers utilisés pour le rapport** (ou à
défaut les régénérer selon la méthode décrite en page 1 du rapport) et les ajouter comme
nouveau corpus de banc, sur le modèle de `tests/banc/demo.ts` / `../DEMO` : vérité terrain
calculée hors moteur (le rapport donne déjà, dans son tableau « Fiabilité des calculs », les
valeurs de référence : CA août 333 803 $, CA 12 mois 3 177 262 $, charges 2 233 167 $, marge
29,7 %, résultat net 944 095 $, trésorerie ≈ 884 462 $ fin août, masse salariale ≈ 340 000 $,
rémunération annuelle 1 242 373 $, 30 clients, CA par succursale ≈ 3,18 M$). Faire tourner ce
nouveau banc **avant tout correctif** : s'il est déjà vert sur le point n°1, ne pas y toucher
et concentrer le Lot 1 sur les points réellement rouges ; s'il est rouge, on aura une preuve
reproductible localement au lieu de deviner sur la seule lecture du rapport.

## Règles de travail

1. Lire `AGENTS.md` avant toute modification.
2. Ce dépôt est la version de référence ; ne jamais écraser son code avec un `pull`/`checkpoint
   restore` depuis Base44.
3. Ne rien publier (`npm run deploy`, `base44 deploy`) : décision d'Issa à la fin.
4. Ne rien écrire dans la base de production.
5. Une branche dédiée (`correctifs-import-kpi-2026-09`), un commit par lot, messages en français.
6. Enchaîner les lots sans attendre de validation, sauf blocage réel (test qui échoue encore
   après trois approches, action irréversible, ou changement de comportement métier qui dépasse
   ce document).
7. Chaque correctif s'accompagne d'un test qui échoue avant et passe après, ajouté au banc
   pertinent (`tests/banc/`) plutôt qu'à un test isolé, pour que la robustesse (85/85 variantes)
   reste garantie.
8. Terminer chaque lot par `npm run test:banc && npm run test:demo && npm run test:robustesse`
   et un paragraphe dans `qa/COMPTE-RENDU.md` (ce qui a changé, la preuve, ce qui reste).

## Lot 1 — Chiffre d'affaires, marge et résultat net (racine du problème, priorité 1)

### 1.1 Confirmer ou infirmer la régression sur `Transaction.type`
- Constat : voir « Constat qui change l'ordre des lots » ci-dessus. `classifyTransaction`
  (`src/lib/transactionClassifier.js:129-136`) se replie sur le signe du montant quand `type`
  est vide (`amount >= 0 → "income"`) ; si les dépenses du fichier sont stockées en montant
  positif (comme dans le fichier du rapport), une perte silencieuse de `type` compte tout comme
  du revenu — exactement l'écart observé (+66 % à +74 %).
- Démarche : lancer le banc issu de l'Étape 0 avec le vrai fichier de transactions du rapport.
  Si le CA calculé est correct → fermer ce point sans y toucher. Si le CA est encore gonflé,
  instrumenter `normalizeRow` (`base44/shared/importUtils.ts:2695-2707`) pour tracer, sur ce
  fichier précis, la valeur de `rawType` par ligne et vérifier qu'elle atteint bien
  `Transaction.type` en base (pas seulement en mémoire dans `normalizeRow`).
- Correction si régression confirmée : selon la cause trouvée — en-tête non canonicalisé,
  écrasement plus loin dans le pipeline, ou agrégation du tableau de bord qui ne passe pas par
  `isIncome`/`isExpense`.
- Test : le banc de l'Étape 0 doit retomber sur 333 803 $ (août) et 3 177 262 $ (12 mois), et
  rester dans le banc de robustesse pour couvrir les variantes d'en-tête.

### 1.2 Durcir le repli de `classifyTransaction` contre les pertes silencieuses de type
- Constat : même sans régression du mapping, le repli « montant positif = revenu »
  (`src/lib/transactionClassifier.js:134-135`) est risqué par construction : toute future perte
  de `type` (nouveau champ non reconnu, fichier atypique) se traduira par un CA gonflé sans
  aucun signal, exactement le symptôme décrit dans le rapport.
- Correction : quand `type` est absent, ne pas présumer « revenu » par défaut. Soit exclure la
  ligne du CA et la signaler (`ImportIssue` ou anomalie sur le tableau de bord, à l'image du
  traitement déjà fait pour les dates futures), soit exiger un second indice (compte, catégorie)
  avant de classer. Documenter le choix retenu en commentaire, comme le fait déjà le code voisin.
- Test : un cas du banc de robustesse avec des transactions sans colonne `type` du tout doit
  produire un signalement explicite plutôt qu'un CA silencieusement gonflé.

### 1.3 Ajouter `branch`/`succursale` au schéma `Transaction`
- Constat : `base44/entities/Transaction.jsonc` n'a aucune propriété succursale/branche. Une
  colonne « succursale » reconnue par l'IA à l'analyse n'a nulle part où atterrir : elle est
  reportée comme colonne non mappée (`base44/shared/importRows.ts:146-160`, `unmappedColumns`)
  et reste seulement dans `original_data`, invisible aux calculs.
- Correction : ajouter une propriété (`branch_id` ou `location`, à harmoniser avec le champ déjà
  utilisé par `Order`/`Employee`, voir Lot 3) au schéma `Transaction`, la mapper dans
  `normalizeRow`, et la propager jusqu'à la page Succursales.
- Test : le banc DEMO/Étape 0 doit répartir le CA des transactions par succursale et non plus
  seulement par commandes.

## Lot 2 — Trésorerie

### 2.1 Calculer un solde de repli quand `closing_cash` est absent ou nul
- Constat : `src/pages/Tresorerie.jsx:58` — `byMonthCash[m].solde = Number(c.closing_cash) || 0`,
  sans repli sur `opening_cash + cash_in - cash_out`. Une variable `latestRow` est calculée
  (ligne 46) mais jamais utilisée : le branchement prévu pour le solde courant a été laissé de
  côté.
- Correction : si `closing_cash` est absent/`NaN`, calculer `opening_cash + cash_in - cash_out`
  pour chaque mois ; utiliser `latestRow` (ou son équivalent une fois corrigé) pour le solde
  courant affiché en tête de page, au lieu de partir directement à 0.
- Test : un cas de banc avec un flux de trésorerie complet mais sans colonne `closing_cash`
  doit afficher un solde courant proche de celui calculé manuellement (≈ 884 462 $ fin août sur
  les données du rapport), et le graphique doit retrouver une échelle cohérente avec les
  montants réels (fini le 0-4 $).

### 2.2 Vérifier le mapping de `closing_cash` lui-même
- Constat : le rapport dit la colonne « fournie mais non retenue » alors que le mapping dans
  `importUtils.ts` (lignes 27-28, 572-580, 2465-2466) semble large. Vérifier avec le fichier
  réel du rapport si le nom exact de la colonne canonicalise bien vers `closing_cash`.
- Test : ajouter la variante d'en-tête concernée (si elle diffère) au banc de robustesse.

## Lot 3 — Paie non utilisée par les modules

### 3.1 Dériver `Payroll.total_cost` quand il est absent
- Constat : `Payroll.total_cost` n'est pas obligatoire ; beaucoup de fichiers fournissent plutôt
  `regular_pay`/`overtime`/`bonus`/`employer_cost`. `src/lib/core/kpiRegistry.js:100-117`
  (`payroll_total`) ne lit que `total_cost` : sans lui, l'indicateur reste toujours nul, même
  avec 75 fiches de paie importées à 100 %.
- Correction : dans `base44/shared/importUtils.ts`, ajouter un crochet de récupération pour
  `Payroll` qui calcule `total_cost = regular_pay + overtime + bonus + employer_cost` quand le
  champ n'est pas fourni directement — sur le modèle des crochets déjà existants pour
  `Order.total_revenue` (ligne ~2929) et `Cashflow.net_cash_flow` (ligne ~2802).
- Test : le banc doit retrouver la masse salariale des 3 derniers mois (≈ 340 000 $ sur les
  données du rapport) sur la page Trésorerie (qui ne doit plus afficher « Aucune donnée de
  paie ») et sur la page Ressources humaines, à la place — ou en complément vérifié — du repli
  actuel sur la somme des salaires annuels déclarés.
- Remarque : le repli actuel (somme des salaires annuels, `src/pages/RessourcesHumaines.jsx:69-76`)
  reste correct comme filet de sécurité en l'absence de paie ; le garder, mais donner la priorité
  à la vraie donnée de paie dès qu'elle est disponible.

## Lot 4 — Rapprochement clients / commandes et succursales

### 4.1 Rapprocher les commandes aux clients par nom quand l'identifiant manque
- Constat : `src/pages/Clients.jsx:74-87` joint strictement sur `o.customer_id === c.customer_id`.
  Le crochet de récupération `customer_name → customer_id` (`importUtils.ts:1777`) est
  désactivé pour `Order` car ce schéma a déjà son propre champ `customer_name`
  (condition `!schemaFields.includes("customer_name")`, fausse pour `Order`) : `Order.customer_id`
  reste donc vide quand le fichier ne fournit qu'un nom, alors que `Customer.customer_id` est,
  lui, généré indépendamment à l'import des clients. Même nom, identifiants différents → jointure
  toujours vide, malgré 66 commandes et 30 clients importés avec succès chacun de leur côté.
- Correction : soit assouplir la condition du crochet pour qu'il s'applique aussi à `Order`
  quand `customer_id` est vide même si `customer_name` existe sur le schéma, soit ajouter un
  repli explicite côté page Clients (normaliser et comparer les noms quand les identifiants ne
  correspondent à rien). Préférer la première option (une seule règle, dans le pipeline d'import,
  plutôt qu'un correctif dans chaque page consommatrice).
- Test : le banc doit retrouver, pour chacun des 30 clients de la donnée de test, un nombre de
  commandes et un chiffre d'affaires total cohérents avec les 66 commandes importées, au lieu de
  0 partout.

### 4.2 Investiguer les dénominateurs impossibles de la page Clients
- Constat : « 1 336 sur 1 491 clients ayant déjà commandé » et « 1 384 clients ayant commandé »
  (`src/lib/core/kpiRegistry.js:818`, `src/lib/dataAudit.js:155`) n'ont aucun rapport avec les 30
  clients réels du test. Hypothèse à vérifier en priorité : ces indicateurs comptent des lignes
  (`Order`, voire toutes les lignes historiquement importées tous comptes/tests confondus via
  `src/hooks/useDonneesKpi.js`, sans filtrage par client distinct ni par le jeu de données courant)
  plutôt que des clients distincts.
- Correction : une fois la cause confirmée, faire compter des `customer_id` (ou noms normalisés)
  **distincts**, et vérifier que le calcul se limite bien aux données de l'entreprise/du jeu de
  test courant.
- Test : sur le banc de 30 clients / 66 commandes, ces deux indicateurs doivent afficher des
  valeurs cohérentes avec 30, jamais des centaines.

### 4.3 Fusionner les libellés de succursale équivalents
- Constat : `src/pages/Succursales.jsx:28-38` (`getLoc`) ne fait que retirer un suffixe
  `"(Ville)"` et trimmer les espaces — aucune normalisation de casse, d'accents, ni de
  dictionnaire de synonymes. « siège », « Siège social » et le défaut « Non assigné »
  (ligne 11) restent trois clés distinctes au lieu d'être fusionnées ou clairement séparées des
  trois lieux physiques réels (Québec, Lévis, Trois-Rivières).
- Correction : normaliser (minuscule, sans accent, espaces) avant de servir de clé de
  regroupement, et fusionner les libellés équivalents connus (« siège » / « siège social ») dans
  un seul intitulé. Une fois 1.3 fait (succursale sur les transactions), ce point doit aussi
  résoudre la disparition du CA sous « Non assigné » (105 573 $ sur 113 919 $ dans le rapport).
- Test : le banc doit afficher exactement les 3 succursales réelles (plus, si pertinent, un seul
  regroupement « siège »/non assigné clairement nommé), sans doublon de libellé.

## Lot 5 — Import : documenter les champs obligatoires et éviter le rejet en bloc

### 5.1 Afficher les champs obligatoires avant le téléversement
- Constat : `src/pages/Import.jsx` ne mentionne nulle part les champs requis. Ils ne sont
  vérifiés qu'après coup, dans `base44/shared/importRows.ts:194-219` (`missingRequired`), et
  seulement visibles dans le message de rapport post-import. Six fichiers sur dix-huit ont ainsi
  été rejetés en bloc (0 ligne importée) sans qu'aucune indication préalable ne permette de
  deviner le champ manquant (`Supplier.supplier_id`, `Competitor.competitor_id`, `Goal.metric`,
  `Event.event_type`, `ExternalSignal.family` — `Campaign.campaign_id` a déjà un crochet de
  récupération et n'est donc probablement plus concerné).
- Correction : dans l'écran d'import, une fois le type de fichier détecté (ou dans l'écran
  « Voici ce que j'ai compris »), afficher la liste des champs obligatoires du type détecté et
  signaler ceux qui n'ont pas de correspondance trouvée, avant l'enregistrement — pas seulement
  après un rejet.
- Test : scénario navigateur (`qa/e2e/agent-qa.spec.js`) qui importe un fichier fournisseurs
  sans `supplier_id` et vérifie que l'écran de confirmation signale le champ manquant avant que
  l'utilisateur ne confirme.

### 5.2 Documenter la liste fermée de `ExternalSignal.family`
- Constat : `base44/entities/ExternalSignal.jsonc:17-35` définit un champ obligatoire `family`
  avec un énuméré fermé qui mélange deux vocabulaires (anglais interne : `market`,
  `competitors`, `commercial`, `tech`, `economy`, `legal`, `territory_resources`, `ecosystem` ;
  français orienté import : `gouvernement`, `economie`, `marche`, `concurrence`, `fournisseurs`,
  `consommateurs`, `actualites`). Aucune des valeurs testées dans le rapport
  (`regulation`/`regulatory`) n'existe dans l'un ou l'autre vocabulaire — le plus proche est
  `legal`/`gouvernement`, jamais suggéré à l'écran.
- Correction : ajouter `regulation`/`regulatory` (et leurs variantes usuelles) au dictionnaire de
  synonymes déjà présent pour ce champ (`base44/shared/importUtils.ts:1954-1981`), qui couvre le
  français mais pas ces termes anglais. Ne pas modifier la liste de l'énuméré lui-même sans
  vérifier tous les usages internes (`radarRegistry.ts`), pour ne pas casser la génération
  interne de veille.
- Test : ajouter un cas au banc de robustesse import avec une colonne `family` valant
  `regulation`/`regulatory`/`competitive` et vérifier qu'elle est correctement rapprochée de
  `legal`/`gouvernement` ou `competitors`/`concurrence` plutôt que rejetée.

### 5.3 Vérifier que la mémorisation du mapping ne masque pas un fichier corrigé
- Constat : `base44/shared/core/mappingMemory.ts` et `src/components/import/PlanConfirmation.jsx:119`
  réutilisent une décision de mapping de colonne déjà validée pour un type de fichier donné
  (« Lecture déjà validée par vous pour ce type de fichier »). Le rapport observe qu'un fichier
  de signaux externes corrigé a été traité comme déjà validé sans être réévalué. Le mécanisme
  retrouvé ne semble agir qu'au niveau du nom de colonne, pas de la validation des valeurs
  ligne par ligne — à confirmer.
- Démarche : reproduire précisément le scénario du rapport (import rejeté, correction du
  fichier, réimport) sur le banc de reprise (`tests/banc/reprise.ts` ou équivalent) pour
  déterminer si la mémorisation empêche une réévaluation complète ou si le problème est ailleurs
  (ex. clé de signature de fichier trop large).
- Correction : si confirmé, invalider la mémorisation de mapping pour un type de fichier dès que
  son contenu (colonnes ou signature) change, et pas seulement se fier au nom du type de fichier.
- Test : un fichier de signaux externes rejeté puis corrigé (nouvelle colonne `family` valide)
  doit être réévalué et accepté, pas simplement réaffiché comme « déjà validé ».

## Après chaque lot

1. `npm run test:banc && npm run test:demo && npm run test:robustesse` (plus le nouveau banc de
   l'Étape 0 une fois créé).
2. Critère de passage : aucune régression sur les scores de référence existants (76/76 DEMO,
   85/85 variantes de robustesse) et progression mesurable sur le nouveau banc.
3. Paragraphe dans `qa/COMPTE-RENDU.md` : ce qui a changé, la preuve, ce qui reste ou a été
   reporté et pourquoi.
4. Commit du lot, message en français.

## Fin de mission

Remettre à Issa, dans `qa/COMPTE-RENDU.md`, un bilan comparant les indicateurs du tableau
« Fiabilité des calculs » du rapport (valeur calculée vs valeur affichée) avant/après ce
chantier, et confirmer explicitement si l'écart sur le chiffre d'affaires (Lot 1.1) provenait
d'un défaut de déploiement ou d'un cas non couvert par le correctif déjà présent dans le dépôt.

## Invite à coller dans Claude Code

> Lis `AGENTS.md` puis `qa/MISSION_CORRECTIFS_IMPORT_KPI.md`, et exécute la mission en entier :
> Étape 0, puis les lots 1 à 5 dans l'ordre, avec les bancs (`test:banc`, `test:demo`,
> `test:robustesse`) et un commit après chaque lot. Ne rien publier, ne jamais récupérer le
> code de Base44 par-dessus ce dépôt, ne rien écrire dans la base de production. Pour le Lot 1,
> commence obligatoirement par vérifier si la régression est reproductible avant de modifier du
> code. Termine par le bilan dans `qa/COMPTE-RENDU.md`.
