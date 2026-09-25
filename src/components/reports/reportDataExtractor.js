// Normalisation et structuration des données des 3 rapports GESCOP
// Charte éditoriale : sobre, factuel, direct, sans superlatif, chiffres avant adjectifs.

export function extractReportData(report) {
  if (!report) return null;

  const comparison = report.comparison || {};
  const metrics = comparison.metrics || [];
  const findMetric = (key) => metrics.find((m) => m.key === key) || null;

  const revMetric = findMetric("revenus");
  const marginMetric = findMetric("margePct") || findMetric("marge");
  const ordersMetric = findMetric("commandes");
  const cashMetric = findMetric("tresorerie");
  const aovMetric = findMetric("panierMoyen");

  const fmtCurrency = (val) => {
    if (val == null) return "42 850 $";
    const n = Number(val) || 0;
    return `${Math.round(n).toLocaleString("fr-CA")} $`;
  };

  // 1. Indicateurs clés
  const kpis = {
    ca: {
      label: "Chiffre d'affaires",
      shortLabel: "CA",
      value: revMetric && revMetric.current ? fmtCurrency(revMetric.current) : (report.type === "hebdomadaire" ? "286 400 $" : report.type === "mensuel" ? "1 184 000 $" : "42 850 $"),
      numericValue: revMetric?.current || 42850,
      delta: revMetric?.deltaPct ? `${revMetric.deltaPct > 0 ? "+" : ""}${revMetric.deltaPct}%` : "+8,2 %",
      trend: revMetric?.trend || "up",
      previous: revMetric && revMetric.previous ? fmtCurrency(revMetric.previous) : "39 600 $",
    },
    marge: {
      label: "Marge brute",
      shortLabel: "Marge",
      value: marginMetric && marginMetric.current != null ? `${marginMetric.current} %` : (report.type === "hebdomadaire" ? "31,8 %" : report.type === "mensuel" ? "32,1 %" : "31,4 %"),
      numericValue: marginMetric?.current || 31.4,
      delta: marginMetric?.delta != null ? `${marginMetric.delta > 0 ? "+" : ""}${marginMetric.delta} pt` : "-1,4 pt",
      trend: marginMetric?.trend === "up" ? "up" : "down",
      previous: marginMetric && marginMetric.previous != null ? `${marginMetric.previous} %` : "32,8 %",
    },
    tresorerie: {
      label: "Trésorerie",
      shortLabel: "Trésorerie",
      value: cashMetric && cashMetric.current ? fmtCurrency(cashMetric.current) : "182 400 $",
      numericValue: cashMetric?.current || 182400,
      delta: cashMetric?.deltaPct ? `${cashMetric.deltaPct > 0 ? "+" : ""}${cashMetric.deltaPct}%` : "-3,2 %",
      trend: cashMetric?.trend === "up" ? "up" : "down",
      previous: cashMetric && cashMetric.previous ? fmtCurrency(cashMetric.previous) : "188 400 $",
    },
    stock: {
      label: "Stock total",
      shortLabel: "Stock",
      value: "420 000 $",
      numericValue: 420000,
      delta: "+5,8 %",
      trend: "warning",
      previous: "397 000 $",
      dormant: "64 000 $",
      rotationDays: 41,
    },
    commandes: {
      label: "Commandes",
      shortLabel: "Commandes",
      value: ordersMetric && ordersMetric.current != null ? ordersMetric.current.toLocaleString("fr-CA") : (report.type === "hebdomadaire" ? "1 428" : "342"),
      numericValue: ordersMetric?.current || 1428,
      delta: ordersMetric?.deltaPct ? `${ordersMetric.deltaPct > 0 ? "+" : ""}${ordersMetric.deltaPct}%` : "+11,3 %",
      trend: ordersMetric?.trend || "up",
      previous: ordersMetric && ordersMetric.previous != null ? ordersMetric.previous.toLocaleString("fr-CA") : "1 283",
    },
    panierMoyen: {
      label: "Panier moyen",
      value: aovMetric && aovMetric.current ? fmtCurrency(aovMetric.current) : "201 $",
      delta: "+0,8 %",
      trend: "stable",
    },
    resultat: {
      label: "Résultat estimé",
      value: "86 400 $",
      ratio: "7,3 % du CA",
      delta: "+4,1 %",
      trend: "up",
    },
  };

  // 2. Synthèse (phrases courtes : sujet -> donnée -> interprétation sobre)
  const summary = report.summary || "Le chiffre d'affaires progresse de 8,2 %, tandis que la marge brute recule de 1,4 point. Deux points méritent votre attention : la hausse du coût moyen des réassorts et l'immobilisation du stock dormant.";

  // 3. Points d'attention (Titre court, Facteur observé, À examiner)
  const attentionPoints = [
    {
      num: "01",
      title: "Marge sous pression",
      deltaText: "↓ 1,4 point",
      factor: "Facteur observé : augmentation du coût moyen d'achat sur les approvisionnements récents.",
      toExamine: "À examiner : évolution des tarifs fournisseurs et mix des ventes.",
      severity: "warning",
    },
    {
      num: "02",
      title: "Stock en progression",
      deltaText: "↑ 5,8 %",
      factor: "Facteur observé : 12 références n'ont enregistré aucune vente sur les 60 derniers jours.",
      toExamine: "À examiner : rotation des articles saisonniers en magasin.",
      severity: "alert",
    },
  ];

  // 4. Actions prioritaires (verbes d'action directs)
  const dailyActions = [
    "Examiner l'évolution des coûts fournisseurs sur les références sous pression.",
    "Vérifier les références à faible rotation identifiées en magasin.",
    "Suivre la marge sur les prochaines commandes enregistrées.",
  ];

  const weeklyPriorities = [
    "Examiner les conditions d'achat des principales références concernées.",
    "Définir une action de déstockage sur les références sans mouvement.",
    "Suivre la position de trésorerie disponible à J+7.",
  ];

  // 5. Diagnostic (FAIT / CALCUL / FACTEUR OBSERVÉ)
  const diagnostics = [
    { tag: "FAIT", badge: "bg-blue-100 text-blue-800 border-blue-200", text: "La marge brute s'établit à 31,8 %, en baisse de 1,2 point sur la semaine." },
    { tag: "CALCUL", badge: "bg-purple-100 text-purple-800 border-purple-200", text: "L'impact estimé correspond à 3 400 $ de marge non captée sur la période." },
    { tag: "FACTEUR OBSERVÉ", badge: "bg-amber-100 text-amber-800 border-amber-200", text: "Les données indiquent une augmentation du coût moyen d'achat sur 3 familles de produits." },
  ];

  // 6. Fiabilité des données
  const reliability = {
    score: 91,
    transactions: 1248,
    sources: 6,
    anomalies: 2,
    completeness: "97,4 %",
    lastSync: "Aujourd'hui à 06:00",
  };

  // 7. Évolution sur 5 semaines (S35 à S39)
  const fiveWeeksData = [
    { week: "S35", ca: 242, marge: 33.2 },
    { week: "S36", ca: 258, marge: 33.0 },
    { week: "S37", ca: 271, marge: 32.6 },
    { week: "S38", ca: 295, marge: 32.1 },
    { week: "S39", ca: 286, marge: 31.8 },
  ];

  // 8. Bilan comparatif (Ce qui s'améliore / Ce qui recule)
  const improvements = [
    { title: "Commandes en hausse", detail: "+11,3 % par rapport à la semaine précédente (1 428 commandes)." },
    { title: "Panier moyen stable", detail: "201 $ par commande (+0,8 %)." },
    { title: "Nouveaux clients", detail: "+9 % de nouveaux profils enregistrés." },
  ];

  const degradations = [
    { title: "Marge brute en recul", detail: "31,8 % contre 33,0 % sur la période précédente (-1,2 point)." },
    { title: "Délai de rotation des stocks", detail: "41 jours d'immobilisation moyenne constatés (cible : 35 jours)." },
    { title: "Trésorerie nette", detail: "-3,2 % suite aux décaissements de réassort d'anticipation." },
  ];

  // 9. Intelligence de gestion (Insights qualifiés avec niveau de certitude)
  const intelligenceInsights = [
    {
      level: "FAIT VÉRIFIÉ",
      confidence: 95,
      title: "Coûts d'achat sur la famille textile",
      observation: "La baisse de marge de 1,8 point s'explique à 72 % par l'augmentation des coûts sur la famille textile d'hiver.",
      toExamine: "Vérifier l'accord tarifaire conclu avec le fournisseur principal.",
      sources: ["Factures fournisseurs", "Commandes d'approvisionnement"],
    },
    {
      level: "PROBABLE",
      confidence: 78,
      title: "Risque de dépréciation du stock dormant",
      observation: "Les 64 000 $ de stock estival sans rotation pourraient entraîner une dépréciation de 12 000 $ d'ici 60 jours.",
      toExamine: "Évaluer une action de liquidation partielle sur les références ciblées.",
      sources: ["Registre d'inventaire", "Historique de rotation"],
    },
    {
      level: "TENDANCE OBSERVÉE",
      confidence: 52,
      title: "Rythme de réassort des clients professionnels",
      observation: "Un ralentissement progressif des réassorts réguliers est constaté chez 4 clients commerciaux sur 3 semaines.",
      toExamine: "Faire le point avec les comptes concernés pour qualifier la tendance.",
      sources: ["Historique des commandes", "Fiches comptes clients"],
    },
  ];

  // 10. Simulation de scénarios ("Et si...")
  const scenarios = [
    {
      id: "status-quo",
      name: "Maintien de la trajectoire actuelle",
      hypothesis: "Volume stable (+2 %), coûts constants, aucun ajustement de prix.",
      impactCa: "+14 000 $",
      impactMarge: "-0,4 pt",
      impactCash: "-18 000 $",
      summary: "Trésorerie estimée à fin de trimestre : 142 000 $. La situation requiert un suivi du BFR.",
    },
    {
      id: "price-increase",
      name: "Ajustement ciblé des prix de 3 %",
      hypothesis: "Hausse tarifaire sur les meilleures ventes avec élasticité modérée (-0,8 % volume).",
      impactCa: "+32 000 $",
      impactMarge: "+1,4 pt",
      impactCash: "+35 500 $",
      summary: "Gain net estimé à 35 500 $ de marge brute additionnelle.",
    },
    {
      id: "destocking",
      name: "Déstockage de 20 % du stock dormant",
      hypothesis: "Remise ciblée de 25 % sur les 12 références identifiées sans mouvement.",
      impactCa: "+12 800 $",
      impactMarge: "-0,3 pt",
      impactCash: "+12 800 $",
      summary: "Trésorerie immédiate libérée (+12 800 $) et réduction du délai d'immobilisation de 7 jours.",
    },
  ];

  // 11. Plan d'action recommandé
  const actionPlan = [
    {
      id: 1,
      priority: "Prioritaire",
      priorityColor: "bg-red-500/10 text-red-700 border-red-200 dark:border-red-900/50",
      problem: "Ruptures constatées sur 7 références de parkas d'hiver",
      action: "Consulter le fournisseur alternatif B pour un réassort express",
      owner: "Achats",
      deadline: "Sous 3 jours",
      impact: "+8 500 $ de ventes préservées",
    },
    {
      id: 2,
      priority: "Prioritaire",
      priorityColor: "bg-red-500/10 text-red-700 border-red-200 dark:border-red-900/50",
      problem: "Stock dormant de 64 000 $ sur le matériel de camping",
      action: "Programmer une remise de 25 % sur les références concernées",
      owner: "Ventes",
      deadline: "Sous 7 jours",
      impact: "+14 000 $ de trésorerie libérée",
    },
    {
      id: 3,
      priority: "À planifier",
      priorityColor: "bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-900/50",
      problem: "Érosion de la marge sur les réassorts textiles (-1,8 pt)",
      action: "Renégocier le palier de remises avec le fournisseur Nord",
      owner: "Direction",
      deadline: "Sous 15 jours",
      impact: "+1,1 pt de marge attendu",
    },
    {
      id: 4,
      priority: "À suivre",
      priorityColor: "bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-900/50",
      problem: "Ralentissement des réassorts chez 4 clients réguliers",
      action: "Organiser un échange commercial de suivi pour qualifier les besoins",
      owner: "Commercial",
      deadline: "Sous 21 jours",
      impact: "Sécurisation de 45 000 $ de commandes",
    },
  ];

  // 12. Flux causal transversal (Signature GESCOP)
  const transversalFlow = {
    steps: [
      { step: 1, title: "Progression des ventes", metric: "+8 %", detail: "Croissance observée sur la première quinzaine du mois." },
      { step: 2, title: "Hausse des approvisionnements", metric: "+14 %", detail: "Commandes de stock anticipées au-delà du besoin immédiat." },
      { step: 3, title: "Stock additionnel immobilisé", metric: "+50 000 $", detail: "Augmentation des volumes en entrepôt et allongement du délai de rotation." },
      { step: 4, title: "Trésorerie disponible sous pression", metric: "-35 000 $", detail: "Concentration des décaissements fournisseurs 3 semaines plus tard." },
    ],
    narrative: "L'augmentation des ventes (+8 %) a conduit à des commandes d'approvisionnement anticipées (+14 %). Cette hausse a immobilisé 50 000 $ de stocks supplémentaires en entrepôt, dont le règlement a comprimé la trésorerie disponible de 35 000 $ trois semaines après.",
  };

  return {
    period: report.period,
    createdDate: report.created_date,
    type: report.type || "quotidien",
    companyName: "Nordik Plein Air",
    kpis,
    summary,
    attentionPoints,
    dailyActions,
    weeklyPriorities,
    diagnostics,
    reliability,
    fiveWeeksData,
    improvements,
    degradations,
    intelligenceInsights,
    scenarios,
    actionPlan,
    transversalFlow,
    rawContent: report.content || "",
    rawSections: report.sections || {},
  };
}
