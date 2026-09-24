// Jeu de données fictif mais réaliste pour une PME québécoise, une ou
// plusieurs lignes par entité, avec des libellés « signature » faciles à
// retrouver dans le DOM. Les dates sont relatives à aujourd'hui pour que les
// filtres « ce mois-ci / 3 derniers mois » aient toujours de la matière.
const mois = (n, jour = 5) => {
  const d = new Date();
  d.setDate(jour);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

const transactions = [];
for (let m = 0; m < 6; m++) {
  transactions.push(
    { id: `t-r${m}`, date: mois(m, 5), amount: 42000 + m * 1500, type: 'revenu', category: 'Ventes', description: 'Ventes du mois' },
    { id: `t-d${m}`, date: mois(m, 12), amount: 27000 + m * 800, type: 'depense', category: 'Fournitures', description: 'Achats marchandises' },
    { id: `t-s${m}`, date: mois(m, 20), amount: 9000, type: 'depense', category: 'Salaires', description: 'Paie' },
  );
}

export const RICH = {
  Company: [{
    id: 'co1', name: 'Quincaillerie Signature Inc.', sector: 'Commerce de détail', location: 'Québec, QC',
    employee_count: 12, currency: 'CAD', health_score: 68, onboarded: true,
    dimension_scores: { finance: 70, ventes: 64, clients: 72, operations: 60 }, last_analysis_date: mois(0, 1),
    company_dictionary: [],
  }],
  Transaction: transactions,
  Order: [
    { id: 'o1', order_id: 'ORD-1', customer_id: 'CLI-1', date: mois(0, 3), total: 250, payment_status: 'paye', status: 'livree' },
    { id: 'o2', order_id: 'ORD-2', customer_id: 'CLI-2', date: mois(1, 8), total: 1250, payment_status: 'en_attente', status: 'en_cours' },
  ],
  Customer: [
    { id: 'c1', customer_id: 'CLI-1', first_name: 'Client', last_name: 'SignatureTest', segment: 'vip', status: 'actif', churn_risk: 0.2, total_revenue: 12000, acquisition_date: mois(8) },
    { id: 'c2', customer_id: 'CLI-2', first_name: 'Marie', last_name: 'Tremblay', segment: 'regulier', status: 'actif', churn_risk: 0.7, total_revenue: 3400, acquisition_date: mois(2) },
  ],
  Product: [
    { id: 'pr1', product_id: 'PROD-1', product_name: 'Marteau Signature 16oz', category: 'Outils', selling_price: 29.99, purchase_cost: 12, inventory_level: 4, reorder_point: 10, status: 'actif', monthly_sales: 30 },
    { id: 'pr2', product_id: 'PROD-2', product_name: 'Perceuse sans fil', category: 'Outils', selling_price: 149, purchase_cost: 90, inventory_level: 40, reorder_point: 5, status: 'actif', monthly_sales: 6 },
  ],
  Inventory: [{ id: 'in1', product_id: 'PROD-1', date: mois(0, 1), opening_stock: 20, purchases: 0, units_sold: 16, closing_stock: 4, unit_cost: 12, inventory_value: 48 }],
  Purchase: [{ id: 'p1', purchase_id: 'CMD-9001', date: mois(1), supplier_id: 'SUP-1', product_id: 'PROD-1', quantity: 10, unit_cost: 12, total_cost: 120, delay_days: 3, status: 'retard' }],
  Supplier: [{ id: 's1', supplier_id: 'SUP-1', supplier_name: 'Fournisseur Zenith Signature', country: 'Canada', average_delivery_days: 7, quality_score: 88, reliability_score: 91, status: 'actif' }],
  Campaign: [{ id: 'ca1', campaign_id: 'CAMP-1', campaign_name: 'Campagne Signature Hiver', channel: 'google_ads', spend: 1000, revenue: 5000, clicks: 800, impressions: 20000, status: 'active', start_date: mois(2) }],
  CampaignDaily: [{ id: 'cd1', campaign_id: 'CAMP-1', date: mois(0, 2), spend: 50, clicks: 40, impressions: 1000, revenue: 260 }],
  Cashflow: [0, 1, 2, 3].map((m) => ({ id: `cf${m}`, date: mois(m, 1), opening_cash: 70000, cash_in: 48000, cash_out: 42000 + m * 1000, net_cash_flow: 6000 - m * 1000, closing_cash: 76000 - m * 1000 })),
  Expense: [{ id: 'ex1', date: mois(0, 9), amount: 1800, category: 'Loyer', supplier: 'Immeubles QC', recurring: true }],
  Employee: [
    { id: 'em1', employee_id: 'EMP-1', first_name: 'Luc', last_name: 'Gagnon', department: 'Ventes', role: 'Vendeur', hire_date: mois(20), salary: 42000, status: 'actif' },
    { id: 'em2', employee_id: 'EMP-2', first_name: 'Sophie', last_name: 'Roy', department: 'Admin', role: 'Gérante', hire_date: mois(40), salary: 61000, status: 'actif' },
  ],
  Payroll: [{ id: 'pa1', employee_id: 'EMP-1', period: mois(0).slice(0, 7), regular_pay: 3500, overtime: 200, employer_cost: 600, total_cost: 4300 }],
  Goal: [{ id: 'g1', goal_id: 'GOAL-1', domain: 'ventes', metric: 'Objectif CA Signature Q1', target: 100000, current: 42000, period: '2026-Q1', status: 'en_cours', priority: 'elevee' }],
  Event: [{ id: 'e1', event_id: 'EVT-1', date: mois(0, 10), event_type: 'Rupture Stock Signature', description: 'Incident logistique', impact_area: 'operations' }],
  Interaction: [{ id: 'i1', interaction_id: 'INT-1', date: mois(0, 12), customer_id: 'CLI-1', channel: 'telephone', subject: 'Plainte Signature Livraison', sentiment: 'negatif', resolved: false }],
  ExecutiveSummary: [{ id: 'x1', summary_id: 'SUM-1', location_id: 'LOC-1', succursale: 'Succursale Signature Nord', period: mois(1).slice(0, 7), total_revenue: 55000, total_cost: 32000, gross_margin: 42, total_orders: 210 }],
  Anomaly: [{ id: 'an1', title: 'Anomalie Signature dépenses', description: 'Hausse de 38 % des fournitures', severity: 'elevee', status: 'nouvelle', financial_impact: -3200, detected_date: mois(0, 14), dimension: 'finance' }],
  Risk: [{ id: 'ri1', title: 'Risque Signature trésorerie', description: 'Runway sous 4 mois', category: 'finance', probability: 0.6, impact: 'eleve', status: 'ouvert' }],
  Opportunity: [{ id: 'op1', title: 'Opportunité Signature B2B', description: 'Contrats entrepreneurs', financial_impact: 18000, status: 'nouvelle', category: 'ventes' }],
  Recommendation: [{ id: 're1', title: 'Recommandation Signature stock', situation: 'Stock bas', action: 'Réapprovisionner PROD-1', priority: 'haute', status: 'nouvelle', financial_impact: 2500 }],
  Alert: [{ id: 'al1', title: 'Alerte Signature stock bas', message: 'PROD-1 sous le seuil', level: 'critique', category: 'anomalie', status: 'non_lue', created_date: mois(0, 15) }],
  Task: [{ id: 'ta1', title: 'Tâche Signature relancer client', status: 'a_faire', priority: 'haute', due_date: mois(-1, 1) }],
  Decision: [{ id: 'd1', title: 'Décision Signature Test', status: 'a_decider', predicted_impact: 5000, confidence_pct: 70 }],
  Report: [{ id: 'r1', type: 'mensuel', period: mois(1).slice(0, 7), summary: 'Résumé Signature', created_date: mois(0, 2) }],
  AnalysisRun: [{ id: 'ar1', run_date: mois(0, 1), health_score: 68, dimension_scores: { finance: 70 }, counts: { anomalies: 1 } }],
  Kpi: [{ id: 'k1', name: 'Marge brute', value: 35, unit: '%', period: mois(0).slice(0, 7), domain: 'finance' }],
  Observation: [{ id: 'ob1', observation_type: 'quantitative', concept: 'finance.revenue', value: 42000, date: mois(0, 5), source_id: 'ventes.csv', confidence: 0.9 }],
  ExternalSignal: [{ id: 'es1', title: 'Signal Signature taux directeur', source: 'Banque du Canada', domain: 'economie', impact: 'moyen', date: mois(0, 4), description: 'Baisse de 25 pb' }],
  Competitor: [{ id: 'cp1', competitor_id: 'COMP-1', name: 'Concurrent Signature', website: 'https://exemple.com', market_position: 'challenger' }],
  Import: [{ id: 'im1', file_name: 'ventes-signature.csv', entity_type: 'Order', status: 'complete', rows_processed: 120, rows_quarantined: 2, created_date: mois(0, 2) }],
  Asset: [{ id: 'as1', asset_id: 'IMMO-1', description: 'Camion de livraison Signature', acquisition_date: mois(14), dpa_class: '10', dpa_rate: 30, initial_cost: 48000, accumulated_depreciation: 14400, net_book_value: 33600 }],
  Invoice: [{ id: 'iv1', invoice_number: 'F-0001', amount: 49, currency: 'CAD', status: 'paid', plan_id: 'pro', paid_at: mois(0, 1) }],
  Payment: [{ id: 'pay1', payment_id: 'PAY-1', order_id: 'ORD-1', date: mois(0, 3), status: 'paye', amount: 250, method: 'carte' }],
  Subscription: [{ id: 'sub1', plan_id: 'pro', status: 'active', provider: 'stripe', current_period_start: mois(0, 1), current_period_end: mois(-1, 1), cancel_at_period_end: false }],
  User: [{ id: 'test-user', role: 'admin', privacy_consent_accepted: true }],
};

// Réponses factices des fonctions backend (forme alignée sur le code réel).
export const FUNCTIONS = {
  analyzeBusiness: { success: true, health_score: 68, anomalies: 1, risks: 1, opportunities: 1, recommendations: 1 },
  chatAssistant: { response: 'Réponse Signature de l\'assistant : votre marge brute est de 35 %.', sources: [], confidence: 0.8 },
  generateReport: { report: { id: 'r2', type: 'mensuel', period: '2026-08', summary: 'Rapport Signature généré', content: '## Rapport Signature' }, summary: 'Rapport Signature généré', content: '## Rapport Signature' },
  scanExternalRadar: { created: 2, rejected: 0 },
  enrichFromWebsite: { company_info: { name: 'Quincaillerie Signature', sector: 'Commerce de détail' } },
};
