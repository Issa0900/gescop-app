// Croisements deterministes : ce qu'aucune source ne revele seule.
//
// Le « moteur de croisement » etait une consigne donnee a l'IA (« croise ces
// sources ») : aucun calcul ne comparait deux sources entre elles. En
// production, les campagnes s'attribuaient 6,5 fois le chiffre d'affaires, la
// paie pesait 3 fois le CA avec des periodes datees dans le futur, et la
// tresorerie montait pendant que le resultat plongeait — sans une seule alerte.
//
// Chaque regle compare deux sources, sur les KPI du moteur (memes chiffres que
// les ecrans), et renvoie un constat chiffre avec son origine. Aucune regle ne
// corrige les donnees : elle dit ce qui ne tient pas ensemble et ou regarder.

import { preparerPeriodes, kpisTotal, kpisParFenetre, moisDe } from "./kpiPeriodes";
import { fluxTresorerieMensuels } from "../metrics";
import { memoDonnees } from "./memoDonnees";

const fmt$ = (v) => `${Math.round(v).toLocaleString("fr-CA")} $`;
const fmtN = (v, d = 1) => v.toLocaleString("fr-CA", { maximumFractionDigits: d });
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const aUnChamp = (rows, champ) => (rows || []).some((r) => r?.[champ] !== undefined && r?.[champ] !== null && r?.[champ] !== "");
const somme = (rows, champ) => (rows || []).reduce((s, r) => s + num(r?.[champ]), 0);
const V = (m, id) => { const x = m?.get(id)?.value; return Number.isFinite(x) ? x : null; };

// Source marketing la plus complete : le tableau recapitulatif des campagnes
// couvre toutes les campagnes ; les releves quotidiens, souvent une partie.
function sourceCampagnes(data, champ) {
  if (aUnChamp(data.campaigns, champ)) return { total: somme(data.campaigns, champ), source: `tableau des campagnes, ${data.campaigns.length} lignes` };
  if (aUnChamp(data.campaignDaily, champ)) return { total: somme(data.campaignDaily, champ), source: `relevés quotidiens, ${data.campaignDaily.length} lignes` };
  return null;
}

const ENTITES_DATEES = [
  ["payrolls", "paie", "total_cost"],
  ["orders", "commandes", null],
  ["transactions", "transactions", "amount"],
  ["expenses", "dépenses", "amount"],
  ["cashflow", "trésorerie", null],
  ["campaignDaily", "campagnes (quotidien)", "spend"],
];

/**
 * @param {Object} data  meme objet que useKpiEngine / useDonneesKpi
 * @param {{ aujourdhui?: Date }} [options]
 * @returns {{ id: string, niveau: "critique"|"important"|"modere", domaines: string[], titre: string, constat: string, action: string, chiffres: Object }[]}
 */
function detecterCroisementsBrut(data = {}, { aujourdhui = new Date() } = {}) {
  const out = [];
  const prep = preparerPeriodes(data, { aujourdhui });
  const tot = kpisTotal(prep, ["total_revenue", "payroll_total", "order_count", "net_income"]);
  const ca = V(tot, "total_revenue");

  // 1. Revenus attribues par les campagnes vs chiffre d'affaires total.
  const attribues = sourceCampagnes(data, "revenue");
  if (attribues && ca && attribues.total > ca) {
    const ratio = attribues.total / ca;
    out.push({
      id: "revenus_attribues_superieurs_ca",
      niveau: ratio >= 2 ? "critique" : "important",
      domaines: ["marketing", "finance"],
      titre: "Les campagnes s'attribuent plus que tout le chiffre d'affaires",
      constat: `Les campagnes déclarent ${fmt$(attribues.total)} de revenus (source : ${attribues.source}), soit ${fmtN(ratio)} fois le chiffre d'affaires total (${fmt$(ca)}). Une même vente est comptée par plusieurs plateformes, ou les revenus attribués sont surévalués : le ROAS déclaré ne mesure pas ce que la publicité rapporte réellement.`,
      action: "Piloter le budget marketing sur les ventes réellement enregistrées par canal, pas sur le ROAS déclaré par les plateformes.",
      chiffres: { revenus_attribues: attribues.total, chiffre_affaires: ca, ratio },
    });
  }

  // 2. Conversions declarees vs commandes reelles.
  const conversions = sourceCampagnes(data, "conversions");
  const commandes = V(tot, "order_count");
  if (conversions && commandes && conversions.total > commandes * 1.05) {
    const ratio = conversions.total / commandes;
    out.push({
      id: "conversions_superieures_commandes",
      niveau: ratio >= 2 ? "important" : "modere",
      domaines: ["marketing", "ventes"],
      titre: "Plus de conversions déclarées que de commandes",
      constat: `Les campagnes déclarent ${fmtN(conversions.total, 0)} conversions (source : ${conversions.source}) pour ${fmtN(commandes, 0)} commandes réelles, soit ${fmtN(ratio)} fois plus. Le coût par conversion affiché est donc sous-estimé d'autant.`,
      action: "Vérifier ce que chaque plateforme compte comme conversion (visite, panier, achat) et rapprocher les achats des commandes.",
      chiffres: { conversions: conversions.total, commandes, ratio },
    });
  }

  // 3. Nouveaux clients attribues vs nouveaux clients reels.
  const nouveaux = sourceCampagnes(data, "new_customers");
  const clientsDates = (data.customers || []).filter((c) => c?.acquisition_date).length;
  if (nouveaux && clientsDates && nouveaux.total > clientsDates * 1.05) {
    out.push({
      id: "nouveaux_clients_attribues",
      niveau: "modere",
      domaines: ["marketing", "clients"],
      titre: "Plus de nouveaux clients attribués que de clients acquis",
      constat: `Les campagnes s'attribuent ${fmtN(nouveaux.total, 0)} nouveaux clients (source : ${nouveaux.source}) alors que la base clients n'en compte que ${fmtN(clientsDates, 0)} avec une date d'acquisition. Le coût d'acquisition client (CAC) calculé sur ces chiffres est trop bas.`,
      action: "Calculer le CAC sur les clients réellement acquis pendant la période des campagnes.",
      chiffres: { nouveaux_attribues: nouveaux.total, clients_acquis: clientsDates },
    });
  }

  // 4. Masse salariale vs chiffre d'affaires.
  const paie = V(tot, "payroll_total");
  if (paie && ca && paie > ca) {
    const ratio = paie / ca;
    out.push({
      id: "paie_superieure_ca",
      niveau: ratio >= 2 ? "critique" : "important",
      domaines: ["rh", "finance"],
      titre: "La masse salariale dépasse le chiffre d'affaires",
      constat: `La paie importée totalise ${fmt$(paie)}, soit ${fmtN(ratio)} fois le chiffre d'affaires (${fmt$(ca)}). C'est ce qui rend la marge nette aussi négative. Avant d'y voir un problème de rentabilité, vérifiez l'import : montants annuels saisis comme mensuels, périodes en double, ou paie d'un autre périmètre que les ventes importées.`,
      action: "Contrôler quelques lignes de paie contre les relevés de paie réels, puis réimporter si nécessaire.",
      chiffres: { masse_salariale: paie, chiffre_affaires: ca, ratio },
    });
  }

  // 5. Couverture de la paie par rapport a l'effectif.
  const employes = (data.employees || []).filter((e) => e?.employee_id && !/depart|inactif|inactive|terminated/i.test(String(e.status || ""))).length;
  if (employes >= 10 && (data.payrolls || []).length > 0) {
    const parMois = new Map();
    for (const p of data.payrolls) {
      const m = moisDe(p);
      if (!m || !p.employee_id) continue;
      if (!parMois.has(m)) parMois.set(m, new Set());
      parMois.get(m).add(String(p.employee_id));
    }
    if (parMois.size > 0) {
      const moyenne = [...parMois.values()].reduce((s, e) => s + e.size, 0) / parMois.size;
      if (moyenne < employes * 0.5) {
        out.push({
          id: "paie_couverture_partielle",
          niveau: "modere",
          domaines: ["rh"],
          titre: "La paie ne couvre qu'une partie de l'effectif",
          constat: `La paie importée compte en moyenne ${fmtN(moyenne)} employés par mois pour ${fmtN(employes, 0)} employés actifs dans la liste du personnel. Le coût moyen par employé et la masse salariale mensuelle ne décrivent donc pas toute l'entreprise.`,
          action: "Importer la paie de tous les employés, ou retirer de la liste ceux qui ne font plus partie de l'effectif.",
          chiffres: { employes_par_mois: moyenne, employes_actifs: employes },
        });
      }
    }
  }

  // 6. Lignes datees apres aujourd'hui.
  const aujourdhuiISO = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, "0")}-${String(aujourdhui.getDate()).padStart(2, "0")}`;
  const futurs = [];
  for (const [cle, libelle, champ] of ENTITES_DATEES) {
    const lignes = (data[cle] || []).filter((r) => {
      const m = moisDe(r);
      if (!m) return false;
      const brut = String(r.date ?? r.period ?? r.pay_period ?? "");
      return brut.length >= 10 ? brut.slice(0, 10) > aujourdhuiISO : m > aujourdhuiISO.slice(0, 7);
    });
    if (lignes.length === 0) continue;
    const mois = [...new Set(lignes.map(moisDe))].sort();
    futurs.push({ libelle, lignes: lignes.length, mois, montant: champ ? somme(lignes, champ) : null });
  }
  if (futurs.length > 0) {
    const detail = futurs.map((f) => `${f.libelle} : ${f.lignes} ligne(s), ${f.mois[0]}${f.mois.length > 1 ? ` → ${f.mois[f.mois.length - 1]}` : ""}${f.montant ? `, ${fmt$(f.montant)}` : ""}`).join(" ; ");
    out.push({
      id: "lignes_datees_futur",
      niveau: futurs.some((f) => f.libelle === "paie" || f.libelle === "commandes") ? "important" : "modere",
      domaines: ["donnees"],
      titre: "Des lignes sont datées après aujourd'hui",
      constat: `${detail}. Elles comptent dans les totaux de la période importée, mais pas dans les tendances ni dans les derniers mois : ce sont des prévisions, ou des dates mal lues à l'import.`,
      action: "Vérifier le format de date du fichier source (jour/mois inversés) ou retirer les lignes prévisionnelles de l'import.",
      chiffres: { sources: futurs },
    });
  }

  // 7. Tresorerie et resultat qui racontent deux histoires (3 derniers mois).
  const flux = fluxTresorerieMensuels(data.cashflow, aujourdhui).slice(-3);
  const fen = kpisParFenetre(prep, ["net_income", "total_revenue"]);
  const resultat3 = V(fen.trim, "net_income");
  const ca3 = V(fen.trim, "total_revenue");
  if (flux.length === 3 && resultat3 !== null) {
    const fluxMois = flux.reduce((s, p) => s + p.net, 0) / 3;
    const resultatMois = resultat3 / 3;
    const ecart = Math.abs(fluxMois - resultatMois);
    const seuil = Math.max(1000, 0.25 * Math.abs(ca3 || 0) / 3);
    if (Math.sign(fluxMois) !== Math.sign(resultatMois) && ecart > seuil) {
      out.push({
        id: "tresorerie_contredit_resultat",
        niveau: "important",
        domaines: ["tresorerie", "finance"],
        titre: resultatMois < 0 ? "La trésorerie monte alors que le résultat est en perte" : "Le résultat est positif mais la trésorerie baisse",
        constat: `Sur les 3 derniers mois complets, le relevé de trésorerie varie de ${fluxMois >= 0 ? "+" : ""}${fmt$(fluxMois)} par mois, alors que le résultat calculé est de ${resultatMois >= 0 ? "+" : ""}${fmt$(resultatMois)} par mois. ${resultatMois < 0
          ? "Des charges comptées dans le résultat ne sortent pas de ce compte (paie payée ailleurs, charges à payer), ou elles sont surévaluées dans l'import."
          : "Des ventes ne sont pas encore encaissées, ou des sorties (investissements, remboursements) n'apparaissent pas dans les charges."}`,
        action: "Rapprocher, pour un mois donné, les sorties du relevé bancaire et les charges importées (paie, dépenses).",
        chiffres: { flux_tresorerie_mois: fluxMois, resultat_mois: resultatMois },
      });
    }
  }

  const ordre = { critique: 0, important: 1, modere: 2 };
  return out.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
}


// Meme calcul pour tous les ecrans qui partagent les memes donnees (memoDonnees).
export const detecterCroisements = memoDonnees(detecterCroisementsBrut, (_d, opts) => (opts?.aujourdhui ?? new Date()).toISOString().slice(0, 10));
