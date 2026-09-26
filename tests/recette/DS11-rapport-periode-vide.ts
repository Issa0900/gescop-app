// Reconstruction : un rapport comparant deux periodes -- si la periode
// courante n'a AUCUNE donnee importee alors que la precedente en avait, une
// comparaison naive dit "-100%" (marge effondree) alors que la verite est
// "donnee non importee" (sec10/sec16 de l'audit). Depuis le 25 sept. 2026 les
// chiffres viennent du moteur KPI de l'ecran (rapportChiffres.js) ; le
// serveur construit la comparaison avec comparaisonDepuisChiffres.
import { lireChiffresRapport, comparaisonDepuisChiffres, blocChiffresRapport } from "../../base44/shared/chiffresRapport.ts";

let e = 0;
const t = (b: boolean, msg: string) => { if (!b) e++; console.log(`${b ? "ok  " : "KO  " } ${msg}`); };

const envoi = (courant: number | null, precedent: number | null) => ({
  chiffres: {
    version: 1, type: "mensuel",
    periode: { debut: "2026-04-01", fin: "2026-04-30", libelle: "avril 2026" },
    precedente: { debut: "2026-03-01", fin: "2026-03-31", libelle: "mars 2026" },
    indicateurs: [{
      id: "gross_margin_pct", nom: "Marge brute (%)", unite: "%",
      courant: { valeur: courant, statut: courant === null ? "non mesuré" : "mesuré" },
      precedent: { valeur: precedent, statut: precedent === null ? "non mesuré" : "mesuré" },
    }],
  },
});

console.log("== Mois courant vide, mois precedent mesure ==");
const ch = lireChiffresRapport(envoi(null, 45))!;
const m = comparaisonDepuisChiffres(ch).metrics[0];
t(m.trend === "non-mesurable", `trend = "${m.trend}" (attendu "non-mesurable", jamais un delta -100% invente)`);
t(m.deltaPct === null && m.delta === null, `delta = ${m.delta}, deltaPct = ${m.deltaPct} (attendus null)`);
t(/Marge brute \(%\) : non mesuré/.test(blocChiffresRapport(ch)), "le texte donne a l'IA dit explicitement « non mesuré »");

console.log("\n== Non-regression : deux periodes mesurees ==");
const m2 = comparaisonDepuisChiffres(lireChiffresRapport(envoi(40, 45))!).metrics[0];
t(m2.trend === "down" && m2.delta === -5, `comparaison normale (trend=${m2.trend}, delta=${m2.delta} pt)`);

console.log("\n== Valeur non numerique envoyee : jamais reprise telle quelle ==");
const ch3 = lireChiffresRapport({ chiffres: { indicateurs: [{ id: "x", nom: "X", courant: { valeur: "1 000 000", statut: "mesuré" } }] } })!;
t(ch3.indicateurs[0].courant.valeur === null && ch3.indicateurs[0].courant.statut === "non mesuré", "texte a la place d'un nombre -> non mesuré");

console.log("\ncas en echec :", e);
