// Verite terrain des 27 fichiers du dossier DEMO (../DEMO), recalculee
// directement depuis les fichiers, sans le moteur de l'app (audit du
// 22 septembre 2026). Chaque attente est un chiffre que l'utilisateur doit
// voir, ou une ligne qu'il doit retrouver en base.
//
//   kpi     valeur attendue du KPI (page Indicateurs) ; null = « non mesurable »
//           (aucun chiffre ne doit etre affiche, et surtout pas 0)
//   lignes  nombre de lignes attendues par entite apres import
//   motifs  nombre minimal de lignes du registre par motif (ImportIssue.reason_code)
//   sans    motifs qui ne doivent PAS apparaitre (ex. faux doublons)

export interface VeriteDemo {
  fichier: string;
  note?: string;
  kpi?: Record<string, number | null>;
  lignes?: Record<string, number>;
  motifs?: Record<string, number>;
  sans?: string[];
}

export const VERITE_DEMO: VeriteDemo[] = [
  {
    fichier: "Nordik_PleinAir_Donnees_Complet_2026.xlsx",
    note: "Classeur coherent : prix, couts, clients, vendeurs se recoupent a 100 %. Formules sans valeur calculee.",
    kpi: { total_revenue: 381047.96, gross_margin_pct: 55.17, ebitda: null, avg_employee_cost: null, dso: null, bfr: null, cpc: 0.79 },
    lignes: { Order: 1200, Customer: 150, Employee: 10, Supplier: 7, Inventory: 12, Campaign: 6 },
  },
  {
    fichier: "GESCOP.xlsx",
    note: "Total = TTC (TPS 5 % + TVQ 9,975 %) ; Remise en $ ; CA HT = Sous-total.",
    kpi: {
      total_revenue: 575158.4, gross_margin_amount: 254054.75, gross_margin_pct: 44.17, aov: 1150.32,
      net_income: -1332472.79, avg_employee_cost: 90519.44, cpc: 1.13, cpm: 44.83, roas: 3.02, dso: 27.86,
    },
    lignes: { Order: 500, Customer: 500, Product: 500, Inventory: 500, Employee: 500, Expense: 500, Cashflow: 500, Supplier: 500, Purchase: 500, Campaign: 500 },
  },
  {
    fichier: "Entreprise_Simulation_50Ans_Canada_QC.xlsx",
    note: "864 formules sans valeur : Prix_Net = Brut x (1 - Remise), HT = Qte x Net, taxes selon la province.",
    kpi: { total_revenue: 159638.58, gross_margin_pct: 50.24, avg_employee_cost: 76970.93, ebitda: null },
    lignes: { Order: 143, Customer: 15, Inventory: 50, Employee: 10, Supplier: 10, Asset: 12 },
  },
  {
    fichier: "Sample - Superstore.csv",
    note: "Montants a 3-4 decimales (22.368) ; dates americaines MM/JJ/AAAA ; Row ID identifie chaque ligne.",
    kpi: { total_revenue: 2297200.86 },
    lignes: { Order: 9994 },
    sans: ["DUPLICATE_RECORD"],
  },
  {
    fichier: "Sales_transactions_2022_2025.csv",
    note: "45 vrais doublons (meme Transaction_ID) ; commandes annulees et retournees exclues du CA ; 6 pays.",
    kpi: { total_revenue: 7128771.28 },
    lignes: { Order: 18000 },
  },
  {
    fichier: "E-Commerce Sales Analytics.csv",
    kpi: { total_revenue: 5109775.74 },
    lignes: { Order: 5000 },
  },
  {
    fichier: "DS02_commandes_ecommerce_6mois.xlsx",
    note: "Seul un montant TTC est fourni : il doit compter (signale TTC), pas disparaitre.",
    kpi: { total_revenue: 1301611.4 },
    lignes: { Order: 4659 },
  },
  {
    fichier: "DS03_marketing_6mois.xlsx",
    note: "Une ligne par campagne et par semaine : serie hebdomadaire, pas 7 campagnes.",
    kpi: { marketing_spend: 83595.1, roas: 4.68, cpc: 0.92 },
    lignes: { CampaignDaily: 85 },
    sans: ["DUPLICATE_RECORD"],
  },
  {
    fichier: "DS01_succursales_6mois.xlsx",
    note: "Resume mensuel par succursale (Periode = AAAA-MM).",
    lignes: { ExecutiveSummary: 60 },
  },
  {
    fichier: "clean_final_data.csv",
    note: "Une ligne par commande (OrderID unique), pas par client.",
    kpi: { total_revenue: 3162844 },
    lignes: { Order: 49222 },
  },
  {
    fichier: "orders.csv",
    note: "50 120 lignes dont 120 repetitions exactes d'un meme OrderID (doublons prouves) et 35 sans date (quarantaine, jamais de date inventee) : 49 965 commandes.",
    lignes: { Order: 49965 },
  },
  {
    fichier: "payments.csv",
    lignes: { Payment: 50000 },
  },
  {
    fichier: "customers.csv",
    lignes: { Customer: 10000 },
  },
  {
    fichier: "GESCOP_Donnees_Test_Xplorer_3Mois.xlsx",
    note: "Les ventes d'Orders sont aussi dans Transactions (« Vente ORD-... »), les depenses d'Expenses aussi.",
    kpi: { total_revenue: 65488.24, total_expense: 15750 },
  },
  {
    fichier: "GESCOP_Donnees_Test_Xplorer_Succes.xlsx",
    note: "Deux jeux avec les memes identifiants et des valeurs differentes : conflits, pas doublons.",
    motifs: { CONFLICTING_RECORD: 2000 },
  },
  {
    fichier: "Simulation_Entreprise_Quebec_3Ans_Complet.xlsx",
    note: "Suffixes _cad ; Transaction = mouvements bancaires des commandes (reference_order_id).",
    kpi: { total_revenue: 634988.12 },
    lignes: { Order: 427, Transaction: 480, Expense: 288, Payroll: 320, Purchase: 109, CampaignDaily: 420, Cashflow: 33, Asset: 12 },
  },
  {
    fichier: "sales_data_dictionary.csv",
    note: "Dictionnaire de colonnes : ne doit pas devenir 36 commandes.",
    lignes: { Order: 0 },
  },
];
