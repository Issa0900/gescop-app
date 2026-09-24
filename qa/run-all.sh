#!/bin/bash
# Agent QA GESCOP — lance les 3 couches et produit qa/out/
# Usage : ./qa/run-all.sh   (depuis la racine du dépôt, après npm install)
# Code de sortie : 0 si toutes les couches passent, 1 sinon.
set -u
cd "$(dirname "$0")/.."
mkdir -p qa/out
STATUT=0
echo "== Couche 1a : build / lint / typecheck"
npm run build > qa/out/build.txt 2>&1; rc=$?; echo "build exit=$rc" | tee qa/out/static-summary.txt; [ $rc -eq 0 ] || STATUT=1
# Le contournement d'authentification des tests Playwright ne doit jamais
# atteindre le build publié (AuthContext.jsx, réservé à import.meta.env.DEV).
porte=$(grep -rl "PLAYWRIGHT_TEST" dist 2>/dev/null | wc -l)
echo "porte de test dans dist=$porte" | tee -a qa/out/static-summary.txt
[ "$porte" -eq 0 ] || { echo "ECHEC : PLAYWRIGHT_TEST présent dans dist/ (contournement d'authentification publié)"; STATUT=1; }
npx eslint . --quiet > qa/out/lint.txt 2>&1; echo "lint erreurs=$(grep -c ' error ' qa/out/lint.txt)" | tee -a qa/out/static-summary.txt
npm run typecheck > qa/out/typecheck.txt 2>&1; echo "typecheck erreurs=$(grep -c 'error TS' qa/out/typecheck.txt)" | tee -a qa/out/static-summary.txt
echo "== Couche 1b : tests du dépôt (npm test si défini, sinon Deno)"
if node -e "process.exit(require('./package.json').scripts?.test ? 0 : 1)"; then
  npm test > qa/out/npm-test.log 2>&1; rc=$?; [ $rc -eq 0 ] || STATUT=1
  echo "npm test exit=$rc | $(grep -E '^(# |ℹ )(pass|fail) ' qa/out/npm-test.log | tr '\n' ' ')" | tee -a qa/out/static-summary.txt
  UNIT_GLOB="tests/import/*.ts tests/recette/*.ts qa/recette/*.ts"
else
  UNIT_GLOB="tests/*.test.js tests/import/*.ts tests/import/*.mjs tests/recette/*.ts qa/recette/*.ts"
fi
[ -f deno.json ] || echo '{ "imports": { "@/": "./src/" }, "nodeModulesDir": "none", "unstable": ["sloppy-imports"] }' > deno.json
: > qa/out/unit-summary.tsv; mkdir -p qa/out/unit
for f in $UNIT_GLOB; do
  [ -f "$f" ] || continue
  n=$(echo "$f" | tr '/' '_')
  if [[ $f == *.test.js ]]; then timeout 300 deno test -A --no-check "$f" > "qa/out/unit/$n.log" 2>&1
  else timeout 300 deno run -A --no-check --sloppy-imports "$f" > "qa/out/unit/$n.log" 2>&1; fi
  rc=$?; [ $rc -eq 0 ] || STATUT=1
  printf "%s\t%s\t%s\n" "$f" "$rc" "$(grep -cE '^\s*(KO|FAILED|not ok)' "qa/out/unit/$n.log")" >> qa/out/unit-summary.tsv
done
awk -F'\t' '{ if ($2!=0) print "ECHEC  " $1; }' qa/out/unit-summary.tsv
echo "scripts Deno=$(wc -l < qa/out/unit-summary.tsv) échecs=$(awk -F'\t' '$2!=0' qa/out/unit-summary.tsv | wc -l)" | tee -a qa/out/static-summary.txt
echo "== Couche 1c : données de test conformes aux schémas"
node qa/check-fixtures.mjs || STATUT=1
echo "== Couche 2 : parcours navigateur (Playwright)"
[ -z "${PW_CHROMIUM:-}" ] && [ -x /opt/pw-browsers/chromium ] && export PW_CHROMIUM=/opt/pw-browsers/chromium
rm -f qa/out/findings.jsonl
(cd qa && npx playwright test -c playwright.qa.config.js --reporter=line > out/e2e-run.log 2>&1); rc=$?; [ $rc -eq 0 ] || STATUT=1
grep -E "passed|failed" qa/out/e2e-run.log || echo "ECHEC : aucun scénario navigateur exécuté (voir qa/out/e2e-run.log)"
echo "== Synthèse"
node qa/summarize.mjs
[ $STATUT -eq 0 ] && echo "RÉSULTAT : toutes les couches passent" || echo "RÉSULTAT : ÉCHEC (voir ci-dessus)"
exit $STATUT
