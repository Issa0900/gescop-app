// L'analyse IA d'un fichier : on verifie le PLAN, pas le modele.
//
// Le LLM est simule. Ce n'est pas un pis-aller : ce qu'il faut tester ici est
// justement ce qui doit tenir QUELLE QUE SOIT sa reponse — un plan invalide est
// refuse, un plan absent est remplace, et une consigne contredite par le fichier
// est corrigee. On simule donc aussi les mauvaises reponses, qui arriveront.
import {
  construireEchantillon, conventionDateProuvee, estLigneDeTotaux,
  validerPlan, verifierAvecPreuves, analyserFichier, construirePrompt,
  type PlanImport,
} from "../../base44/shared/importPlan.ts";

let echecs = 0;
const v = (ok: boolean, t: string) => { if (!ok) echecs++; console.log(`  ${ok ? "OK   " : "ECHEC"} ${t}`); };

// Le fichier tel qu'il arrive vraiment : 3 lignes d'en-tete de rapport, des
// intitules maison, un code C/D, une ligne de totaux a la fin.
const FICHIER: any[][] = [
  ["Boulangerie Saint-Roch inc."],
  ["Grand livre - mars 2026"],
  ["(export Acomba)"],
  [],
  ["Date ope.", "Libelle", "Sens", "Mtt HT reel", "Centre de cout"],
  ["25/03/26", "Vente comptoir", "C", "1 250,50", "CC-01"],
  ["02/03/26", "Facture Sysco", "D", "(864,30)", "CC-02"],
  ["11/03/26", "Vente traiteur", "C", "3 400,00", "CC-01"],
  ["TOTAUX", "", "", "3 786,20", ""],
];

const SECOURS: PlanImport = {
  entite: null, ligne_entetes: 0, lignes_ignorees: [], colonnes: [{ colonne: "col_1", champ: null }],
  confiance: "faible", explication: "Lecture par regles.", origine: "regles", corrections: [],
};

console.log("===== 1. Echantillon soumis a l'IA =====");
const ech = construireEchantillon(FICHIER);
console.log(ech.split("\n").map((l) => "     " + l).join("\n"));
v(ech.split("\n").length === 9, "les 9 lignes sont transmises, desordre compris");
v(ech.includes("TOTAUX"), "la ligne de totaux n'est PAS nettoyee avant l'envoi");
v(/^ 0 \| Boulangerie/m.test(ech), "les lignes sont numerotees a partir de 0");

console.log("\n===== 2. Preuves tirees du fichier =====");
v(conventionDateProuvee(["25/03/26", "02/03/26"]) === "JJ/MM", "25/03 prouve JJ/MM (aucun mois ne vaut 25)");
v(conventionDateProuvee(["03/25/26", "03/02/26"]) === "MM/JJ", "03/25 prouve MM/JJ");
v(conventionDateProuvee(["03/04/26", "05/06/26"]) === null, "colonne entierement ambigue : aucune preuve");
v(conventionDateProuvee(["25/03/26", "03/25/26"]) === null, "preuves contradictoires : on n'invente pas");
v(estLigneDeTotaux(["TOTAUX", "", "", "3 786,20", ""]), "ligne TOTAUX reconnue");
v(!estLigneDeTotaux(["25/03/26", "Vente comptoir", "C", "1 250,50", "CC-01"]), "ligne de donnees non confondue");

console.log("\n===== 3. Plan correct rendu par l'IA =====");
const BONNE_REPONSE = {
  entite: "Transaction",
  ligne_entetes: 4,
  lignes_ignorees: [8],
  colonnes: [
    { colonne: "Date ope.", champ: "date", convention_date: "JJ/MM" },
    { colonne: "Libelle", champ: "description" },
    { colonne: "Sens", champ: "type", valeurs: { C: "income", D: "expense" } },
    { colonne: "Mtt HT reel", champ: "amount" },
    { colonne: "Centre de cout", champ: null },
  ],
  confiance: "haute",
  explication: "J'ai lu 3 transactions du grand livre de mars 2026.",
};
const r1 = validerPlan(BONNE_REPONSE, FICHIER);
v(r1.plan !== null, "plan accepte");
v(r1.plan?.ligne_entetes === 4, "ligne d'en-tetes = 4 (les 4 premieres lignes sont ecartees)");
v(r1.plan?.lignes_ignorees.join() === "8", "ligne de totaux ecartee");
v(r1.plan?.colonnes.find((c) => c.colonne === "Centre de cout")?.champ === null, "colonne sans correspondance laissee libre");
v(r1.plan?.colonnes.find((c) => c.colonne === "Sens")?.valeurs?.D === "expense", "code D traduit en depense");

console.log("\n===== 4. L'IA se trompe : le fichier la corrige =====");
const REPONSE_FAUSSE = { ...BONNE_REPONSE, lignes_ignorees: [], colonnes: BONNE_REPONSE.colonnes.map((c) => (c.colonne === "Date ope." ? { ...c, convention_date: "MM/JJ" } : c)) };
const r2 = validerPlan(REPONSE_FAUSSE, FICHIER);
const corrige = verifierAvecPreuves(r2.plan!, FICHIER);
v(corrige.colonnes.find((c) => c.colonne === "Date ope.")?.convention_date === "JJ/MM",
  "convention MM/JJ annoncee par l'IA -> corrigee en JJ/MM par la preuve du fichier");
v(corrige.lignes_ignorees.includes(8), "ligne de totaux oubliee par l'IA -> rattrapee");
v(corrige.origine === "ia+preuves", "l'origine indique que le fichier a corrige l'analyse");
corrige.corrections.forEach((c) => console.log("       . " + c));

console.log("\n===== 5. L'IA repond n'importe quoi : rien ne passe =====");
const mauvais: [any, string][] = [
  [null, "reponse vide"],
  [{ entite: "Licorne", ligne_entetes: 4, colonnes: [] }, "entite inexistante"],
  [{ entite: "Transaction", ligne_entetes: 99, colonnes: [{ colonne: "x" }] }, "ligne d'en-tetes hors du fichier"],
  [{ entite: "Transaction", ligne_entetes: 4, colonnes: [] }, "aucune colonne"],
];
for (const [rep, libelle] of mauvais) v(validerPlan(rep, FICHIER).plan === null, `refuse : ${libelle}`);

const inventé = validerPlan(
  { entite: "Transaction", ligne_entetes: 4, colonnes: [{ colonne: "Mtt HT reel", champ: "montant_magique" }] },
  FICHIER,
);
v(inventé.plan?.colonnes[0].champ === null, "champ invente par l'IA -> colonne laissee libre, pas de rattachement force");
v(inventé.refus.some((r) => r.includes("champ inconnu")), "le refus est nomme, pas silencieux");

console.log("\n===== 6. L'IA est indisponible : l'import continue =====");
(async () => {
  const panne = await analyserFichier(async () => { throw new Error("503 service indisponible"); },
    { matrix: FICHIER, nomFichier: "grand-livre.csv", entitesPossibles: ["Transaction"], planDeSecours: SECOURS });
  v(panne.plan.origine === "regles", "repli sur le plan deterministe");
  v((panne.erreur || "").includes("indisponible"), "la panne est signalee, pas masquee");

  const bon = await analyserFichier(async () => BONNE_REPONSE,
    { matrix: FICHIER, nomFichier: "grand-livre.csv", entitesPossibles: ["Transaction"], planDeSecours: SECOURS });
  v(bon.plan.entite === "Transaction" && bon.plan.ligne_entetes === 4, "plan de l'IA retenu quand il est valide");

  console.log("\n===== 7. Le prompt ne demande jamais de valeurs =====");
  const prompt = construirePrompt(ech, "grand-livre.csv", ["Transaction", "Order"]);
  v(prompt.includes("Tu ne recopies aucune valeur"), "consigne explicite : decrire, pas transcrire");
  v(prompt.includes("N'invente jamais un nom de champ"), "interdiction d'inventer un champ");
  v(prompt.includes("25/03/26"), "l'echantillon reel est bien joint");

  console.log("\ncas en echec :", echecs);
})();
