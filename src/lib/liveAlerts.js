// Alerts derived live from current data, so the alert centre reflects the
// business right now instead of only what the last AI analysis happened to save.
// Same period rules as the scores: recent windows, complete months only.

import {
  monthlyAggComplete,
  lastVal,
  prevVal,
  trendPct,
  sumLast,
  sumPrev,
  meanOf,
  latestByKey,
} from "@/lib/periods";

function alert(level, category, title, message) {
  return { id: `live-${category}-${title}`, level, category, title, message, live: true, status: "non_lue" };
}

export function computeLiveAlerts(data) {
  const { transactions, orders, customers, campaignDaily, inventory, cashflow } = data;
  const out = [];

  const incomes = (transactions || []).filter((t) => t.type === "income");
  const txnExpenses = (transactions || []).filter((t) => t.type === "expense");
  const revMonthly = monthlyAggComplete(incomes, "date", "amount");
  const expMonthly = monthlyAggComplete(txnExpenses, "date", "amount");

  // --- Trésorerie : runway ---
  const cfSorted = (cashflow || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const latestCash = cfSorted[0]?.closing_cash || 0;
  const recentBurn = meanOf(expMonthly.slice(-3).map((e) => e.val));
  if (recentBurn > 0) {
    const runway = latestCash / recentBurn;
    if (runway < 3) {
      out.push(
        alert(
          "critique",
          "Trésorerie",
          "Trésorerie sous 3 mois de couverture",
          `Solde de ${Math.round(latestCash).toLocaleString("fr-CA")} $ pour une sortie moyenne de ${Math.round(recentBurn).toLocaleString("fr-CA")} $/mois, soit ${runway.toFixed(1)} mois de marge de manœuvre.`
        )
      );
    } else if (runway < 6) {
      out.push(
        alert(
          "important",
          "Trésorerie",
          "Couverture de trésorerie à surveiller",
          `${runway.toFixed(1)} mois de couverture au rythme de dépenses actuel.`
        )
      );
    }
  }
  if (latestCash < 0) {
    out.push(alert("critique", "Trésorerie", "Solde de trésorerie négatif", `Solde actuel : ${Math.round(latestCash).toLocaleString("fr-CA")} $.`));
  }

  // --- Finance : marge ---
  const expMap = {};
  expMonthly.forEach((e) => { expMap[e.month] = e.val; });
  const margins = revMonthly
    .filter((r) => r.val > 0)
    .map((r) => ({ month: r.month, val: ((r.val - (expMap[r.month] || 0)) / r.val) * 100 }));
  const recentMargin = meanOf(margins.slice(-3).map((m) => m.val));
  if (margins.length >= 3) {
    if (recentMargin < 0) {
      out.push(alert("critique", "Finance", "Marge négative sur 3 mois", `La marge moyenne des 3 derniers mois complets est de ${recentMargin.toFixed(0)} %.`));
    } else if (recentMargin < 10) {
      out.push(alert("important", "Finance", "Marge faible", `Marge moyenne de ${recentMargin.toFixed(0)} % sur les 3 derniers mois complets.`));
    }
  }
  const marginDrop = trendPct(lastVal(margins), prevVal(margins));
  if (margins.length >= 2 && marginDrop < -25) {
    out.push(
      alert(
        "important",
        "Finance",
        "Chute de marge d'un mois sur l'autre",
        `La marge est passée de ${prevVal(margins).toFixed(0)} % à ${lastVal(margins).toFixed(0)} % (${marginDrop.toFixed(0)} %).`
      )
    );
  }

  // --- Ventes ---
  const ordRev = monthlyAggComplete(orders || [], "date", "total");
  if (ordRev.length >= 6) {
    const rev3 = sumLast(ordRev, 3);
    const revPrev3 = sumPrev(ordRev, 3);
    const salesTrend = trendPct(rev3, revPrev3);
    if (salesTrend < -20) {
      out.push(
        alert(
          "critique",
          "Ventes",
          "Recul marqué du chiffre d'affaires",
          `Les ventes des 3 derniers mois complets reculent de ${Math.abs(salesTrend).toFixed(0)} % par rapport aux 3 mois précédents.`
        )
      );
    } else if (salesTrend < -8) {
      out.push(alert("important", "Ventes", "Ventes en repli", `Repli de ${Math.abs(salesTrend).toFixed(0)} % sur 3 mois.`));
    }
  }

  // --- Opérations : état de stock le plus récent par produit ---
  const latestInv = latestByKey(inventory || [], "product_id", "date");
  const ruptures = latestInv.filter((i) => i.stock_status === "rupture");
  const proches = latestInv.filter((i) => i.stock_status === "proche_rupture" || i.stock_status === "faible");
  const dormants = latestInv.filter((i) => i.stock_status === "dormant");
  if (ruptures.length > 0) {
    out.push(
      alert(
        ruptures.length >= 10 ? "critique" : "important",
        "Opérations",
        `${ruptures.length} produit${ruptures.length > 1 ? "s" : ""} en rupture de stock`,
        "Ventes perdues tant que le réapprovisionnement n'est pas fait."
      )
    );
  }
  if (proches.length >= 10) {
    out.push(alert("modere", "Opérations", `${proches.length} produits en stock faible`, "À réapprovisionner pour éviter la rupture."));
  }
  if (dormants.length > 0) {
    const dormantValue = dormants.reduce((s, i) => s + (Number(i.inventory_value) || 0), 0);
    out.push(
      alert(
        "modere",
        "Opérations",
        `${dormants.length} produits dormants`,
        dormantValue > 0
          ? `${Math.round(dormantValue).toLocaleString("fr-CA")} $ de capital immobilisé.`
          : "Capital immobilisé sans rotation."
      )
    );
  }

  // --- Clients : churn ---
  const totalCustomers = (customers || []).length;
  if (totalCustomers > 0) {
    const churned = (customers || []).filter((c) => c.status === "inactif" || c.status === "perdu").length;
    const churnRate = (churned / totalCustomers) * 100;
    if (churnRate >= 20) {
      out.push(alert("critique", "Clients", "Taux d'attrition élevé", `${churnRate.toFixed(0)} % des clients sont inactifs ou perdus (${churned} sur ${totalCustomers}).`));
    } else if (churnRate >= 10) {
      out.push(alert("important", "Clients", "Attrition à surveiller", `${churnRate.toFixed(0)} % des clients sont inactifs ou perdus.`));
    }
    const atRisk = (customers || []).filter((c) => Number(c.churn_risk) >= 0.7 && c.status === "actif").length;
    if (atRisk > 0) {
      out.push(alert("important", "Clients", `${atRisk} clients actifs à risque de départ`, "Risque de départ élevé : une relance est recommandée."));
    }
  }

  // --- Marketing : ROAS ---
  const spendM = monthlyAggComplete(campaignDaily || [], "date", "spend");
  const revM = monthlyAggComplete(campaignDaily || [], "date", "revenue");
  const s3 = sumLast(spendM, 3);
  if (s3 > 0) {
    const roas = sumLast(revM, 3) / s3;
    const sp3 = sumPrev(spendM, 3);
    const roasPrev = sp3 > 0 ? sumPrev(revM, 3) / sp3 : 0;
    if (roas < 1) {
      out.push(alert("critique", "Marketing", "ROAS inférieur à 1", `Chaque dollar investi rapporte ${roas.toFixed(2)} $ : les campagnes détruisent de la valeur.`));
    } else if (roasPrev > 0 && trendPct(roas, roasPrev) < -25) {
      out.push(
        alert(
          "important",
          "Marketing",
          "Rentabilité publicitaire en baisse",
          `ROAS passé de ${roasPrev.toFixed(1)}x à ${roas.toFixed(1)}x sur les 3 derniers mois complets.`
        )
      );
    }
  }

  return out;
}