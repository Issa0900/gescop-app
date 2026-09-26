# Consigne de déploiement — pour l'agent qui déploie

Rédigée le 26 sept. 2026. Elle se suffit à elle-même. Suis-la **dans l'ordre** et **arrête-toi** à la première condition d'arrêt rencontrée : ne tente pas de contourner le problème, rapporte-le à Issa.

## Ce qu'on déploie

La branche `claude/quirky-curie-xxw5va` : la branche `correctifs-import-kpi-2026-09` d'Issa, plus l'audit et les corrections du moteur KPI et des rapports (voir `AGENTS.md`, section « Audit du moteur KPI »). `main` (`d96a17c`, la version en ligne depuis le 24 sept.) en est un ancêtre direct : l'avance rapide suffit, sans fusion. Application : https://smart-pilot-gescop.base44.app

## Interdits absolus

1. Ne jamais réécrire l'historique : ni `push --force`, ni `rebase`, ni `reset` sur une branche distante.
2. Ne jamais modifier le code, ni désactiver ou ignorer un test pour « faire passer » une étape. Un échec est une condition d'arrêt.
3. Ne jamais supprimer de données en ligne : pas de « Tout supprimer », pas de suppression d'import ou d'entité.
4. Ne jamais lancer `base44 pull`, une synchronisation ou la restauration d'un checkpoint par-dessus le dossier local.
5. Ne jamais ajouter au dépôt les fichiers de `../DEMO` (le dépôt est public).
6. Ne jamais déployer autre chose que `main`, avancé exactement comme indiqué ci-dessous.

## Étape 1 — Préparer `main`

```bash
git status                     # ARRÊT si des modifications non commitées existent
git fetch origin
git checkout main
git pull --ff-only origin main
git merge --ff-only origin/claude/quirky-curie-xxw5va
git merge-base --is-ancestor 1ef2cdb HEAD && echo "correctif rapports présent"
```

**ARRÊT si :** le `merge --ff-only` refuse (ce ne serait plus une avance rapide), ou si la dernière ligne n'affiche pas « correctif rapports présent ».

## Étape 2 — Vérifier avant de publier

```bash
npm ci
npm test
npm run build
```

- `npm test` : attendu **0 échec** (315 réussis et 1 ignoré, ou plus si des tests ont été ajoutés). **ARRÊT** au premier échec.
- `npm run build` : doit réussir. **ARRÊT** sinon.
- Pour information seulement, sans bloquer : `npm run lint` (1 erreur connue dans `src/pages/Produits.jsx`) et `npm run typecheck` (146 erreurs connues, antérieures). Si ces nombres **augmentent**, **ARRÊT**.

## Étape 3 — Pousser `main`

```bash
git push origin main
```

**ARRÊT si** le push est refusé. Ne jamais forcer.

## Étape 4 — Déployer

```bash
npx base44 login               # seulement si la session a expiré
npm run deploy                 # = npx base44 build && npx base44 deploy --yes
```

Attendu : « App deployed successfully ». Ce déploiement envoie **ensemble** le schéma `Report` (nouveau champ `chiffres`), la fonction `generateReport` et l'interface. Ne déploie jamais l'un sans les autres. **ARRÊT** sur toute erreur ; ne relance pas plus d'une fois.

## Étape 5 — Vérifier en ligne

Avec le compte d'Issa. Seules actions permises : lecture, et génération d'un rapport. Note le résultat de chaque point (OK / KO + ce qui est vu).

1. **Page Indicateurs :** relever le chiffre d'affaires du dernier mois complet.
2. **Rapports :** générer un rapport **mensuel**.
   - Le nom affiché est celui de l'entreprise d'Issa, jamais « Nordik Plein Air ».
   - Son chiffre d'affaires est **identique** à celui relevé au point 1.
   - Aucun chiffre n'est sans lien avec les données : dans l'ancienne version, on voyait par exemple « 1 184 000 $ », « 420 000 $ », « 91 % » ou « 98,4 % ».
   - Le résumé de l'IA cite les mêmes chiffres que les cartes. C'est la seule partie impossible à tester hors ligne : décris précisément tout écart.
3. **Diaporama :** il occupe tout l'écran et on peut parcourir les diapositives. Exporter aussi en PowerPoint et ouvrir le fichier.
4. **Ancien rapport :** en ouvrir un (généré avant ce déploiement) ; il s'affiche avec l'avertissement « ancien calcul ».
5. **Rapports hebdomadaire et quotidien :** chacun s'ouvre, et sa période se termine à la dernière vente importée.
6. **Finance et RH :** les pages s'affichent sans erreur. Les KPI peuvent différer d'avant (EBITDA avant amortissement, effectif sans les employés partis, remises, « période commune ») : c'est voulu, ne le signale pas comme une anomalie.
7. **Console du navigateur :** aucune erreur rouge sur `/rapports`, `/kpis`, `/finance`, `/rh`.

## En cas de problème en ligne : revenir en arrière

Seulement si un point de l'étape 5 est bloquant, par exemple une page qui ne s'affiche plus ou un rapport impossible à générer :

```bash
git checkout d96a17c           # version en ligne avant ce déploiement
npm ci && npm run deploy
git checkout main
```

Ne touche pas à `main` sur GitHub. Rapporte ensuite à Issa ce qui a échoué.

## Rapport à rendre à Issa

- **Commit déployé :** `git rev-parse --short HEAD`.
- **Étape 2 :** résultat de `npm test` (réussis / échecs), du build, et les nombres du lint et du typecheck.
- **Étape 4 :** sortie du déploiement.
- **Étape 5 :** OK ou KO pour chaque point, avec ce qui a été vu. Pour le point 2, les deux chiffres d'affaires côte à côte.
- **Retour arrière :** s'il y en a eu un, pourquoi.
