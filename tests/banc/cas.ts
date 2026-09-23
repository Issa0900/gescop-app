// Corpus du banc de reconnaissance (directive §24).
//
// Chaque cas est un classeur tel qu'un utilisateur l'importerait, accompagne
// de la verite terrain que le banc ne peut pas deviner : combien de lignes sont
// de vraies donnees, et quelles colonnes brutes doivent survivre dans
// original_data. Le banc mesure ensuite ce que le pipeline en a fait.

export interface Cas {
  id: string;
  titre: string;
  /** Nom du fichier importe ; les feuilles deviennent "<fichier> [<feuille>]". */
  fichier: string;
  feuilles: Record<string, any[][]>;
  /** Type choisi manuellement dans l'ecran d'import, s'il y en a un. */
  type_manuel?: string;
  /** Reponse que rendrait l'analyse IA (sinon : IA indisponible, plan par regles). */
  reponse_ia?: (feuille: string) => any;
  /** Nombre de lignes de vraies donnees (hors en-tetes, totaux, lignes vides). */
  donnees: number;
  /** Colonnes dont la valeur brute doit rester lisible dans original_data. */
  colonnes_brutes?: string[];
  /** Fragments que le rapport d'import doit mentionner (valeur repliee, colonne ignoree...). */
  signaler?: string[];
  /**
   * Interpretation attendue (directive §25.6 : pas d'hallucination semantique) :
   * type de chaque feuille, et champ ou doit atterrir la valeur de colonnes cles.
   */
  attendu?: { entites?: Record<string, string>; champs?: Record<string, string> };
}

const ENT_TXN = ["Date", "Montant", "Type", "Catégorie", "Description"];

export const CORPUS: Cas[] = [
  {
    id: "01-parfait",
    titre: "Fichier parfaitement structure",
    fichier: "transactions.xlsx",
    feuilles: {
      Transactions: [
        ENT_TXN,
        ["2026-03-01", "1200", "Revenu", "Ventes", "Vente comptoir"],
        ["2026-03-02", "300", "Dépense", "Fournitures", "Papeterie"],
        ["2026-03-03", "850", "Revenu", "Ventes", "Vente web"],
        ["2026-03-04", "1500", "Dépense", "Loyer", "Loyer mars"],
      ],
    },
    donnees: 4,
    colonnes_brutes: ENT_TXN,
    attendu: { entites: { Transactions: "Transaction" }, champs: { Montant: "amount", Description: "description" } },
  },
  {
    id: "02-colonnes-inconnues",
    titre: "Colonnes au concept inconnu (Code affaire, Ref. interne)",
    fichier: "commandes.xlsx",
    feuilles: {
      Commandes: [
        ["No commande", "Date", "Client", "Produit", "Quantité", "Prix unitaire", "Code affaire", "Ref. interne"],
        ["C-1", "2026-02-01", "Julie", "Tente", 1, 450, "AFF-9", "A-001"],
        ["C-2", "2026-02-02", "Marc", "Sac", 2, 120, "AFF-9", "A-002"],
        ["C-3", "2026-02-03", "Léa", "Lampe", 3, 45, "AFF-12", "A-003"],
      ],
    },
    donnees: 3,
    colonnes_brutes: ["Code affaire", "Ref. interne"],
    signaler: ["Code affaire", "Ref. interne"],
  },
  {
    id: "03-anglais",
    titre: "Fichier anglais",
    fichier: "orders.xlsx",
    feuilles: {
      Orders: [
        ["Order ID", "Order Date", "Customer", "Product", "Qty", "Unit Price"],
        ["O-1", "2026-01-10", "John", "Tent", 1, 450],
        ["O-2", "2026-01-11", "Mary", "Backpack", 2, 120],
      ],
    },
    donnees: 2,
  },
  {
    id: "04-multilingue-abreviations",
    titre: "Multilingue + abreviations (No cde, Dt, Qté, PU)",
    fichier: "ventes_mixte.xlsx",
    type_manuel: "Order",
    feuilles: {
      Feuil1: [
        ["No cde", "Order Date", "Client", "Qté", "PU"],
        ["K-1", "2026-04-01", "Paul", 2, 30],
        ["K-2", "2026-04-02", "Anne", 1, 99],
      ],
    },
    donnees: 2,
  },
  {
    id: "05-colonnes-supplementaires",
    titre: "Colonnes supplementaires (Canal, Region, Code campagne, Responsable)",
    fichier: "transactions_enrichies.xlsx",
    feuilles: {
      Transactions: [
        [...ENT_TXN, "Canal", "Région", "Code campagne", "Responsable"],
        ["2026-05-01", "200", "Revenu", "Ventes", "Vente", "Web", "Estrie", "AUT26", "Sophie"],
        ["2026-05-02", "90", "Dépense", "Pub", "Annonce", "Meta", "Estrie", "AUT26", "Sophie"],
      ],
    },
    donnees: 2,
    colonnes_brutes: ["Code campagne", "Responsable"],
  },
  {
    id: "06-colonnes-manquantes",
    titre: "Ventes sans numero de commande (identifiant absent)",
    fichier: "ventes_succursales.xlsx",
    type_manuel: "Order",
    feuilles: {
      Ventes: [
        ["Date", "Succursale", "Produit", "Quantité", "Prix unitaire"],
        ["2026-06-01", "Laval", "Tente", 1, 450],
        ["2026-06-01", "Laval", "Sac", 2, 120],
        ["2026-06-02", "Laval", "Lampe", 1, 45],
        ["2026-06-02", "Lévis", "Tente", 1, 450],
      ],
    },
    donnees: 4,
  },
  {
    id: "07-sans-date",
    titre: "Ventes sans aucune date",
    fichier: "ventes_sans_date.xlsx",
    type_manuel: "Order",
    feuilles: {
      Ventes: [
        ["No commande", "Produit", "Quantité", "Prix unitaire"],
        ["S-1", "Tente", 1, 450],
        ["S-2", "Sac", 2, 120],
      ],
    },
    donnees: 2,
  },
  {
    id: "08-lignes-total",
    titre: "Lignes TOTAL et sous-total",
    fichier: "releve.xlsx",
    feuilles: {
      Transactions: [
        ENT_TXN,
        ["2026-03-01", "1000", "Revenu", "Ventes", "Vente A"],
        ["2026-03-02", "500", "Revenu", "Ventes", "Vente B"],
        ["Sous-total", "1500", "", "", ""],
        ["2026-03-03", "200", "Dépense", "Loyer", "Loyer"],
        ["TOTAL", "1700", "", "", ""],
      ],
    },
    donnees: 3,
  },
  {
    id: "09-faux-total",
    titre: "Valeur « Moyenne » / « Total » qui n'est PAS une ligne de total",
    fichier: "commandes_tailles.xlsx",
    type_manuel: "Order",
    feuilles: {
      Commandes: [
        ["No commande", "Date", "Produit", "Taille", "Quantité", "Prix unitaire"],
        ["T-1", "2026-07-01", "Chandail", "Petite", 1, 40],
        ["T-2", "2026-07-01", "Chandail", "Moyenne", 1, 40],
        ["T-3", "2026-07-02", "Chandail", "Grande", 1, 40],
      ],
    },
    donnees: 3,
  },
  {
    id: "10-valeurs-nulles",
    titre: "Montants N/A et vides",
    fichier: "transactions_trous.xlsx",
    feuilles: {
      Transactions: [
        ENT_TXN,
        ["2026-03-01", "100", "Revenu", "Ventes", "A"],
        ["2026-03-02", "N/A", "Revenu", "Ventes", "B"],
        ["2026-03-03", "", "Revenu", "Ventes", "C"],
        ["2026-03-04", "300", "Revenu", "Ventes", "D"],
      ],
    },
    donnees: 4,
  },
  {
    id: "11-valeurs-negatives",
    titre: "Montant negatif (retour)",
    fichier: "transactions_retour.xlsx",
    feuilles: {
      Transactions: [
        ENT_TXN,
        ["2026-03-01", "500", "Revenu", "Ventes", "Vente"],
        ["2026-03-05", "-500", "", "Ventes", "Retour client"],
      ],
    },
    donnees: 2,
  },
  {
    id: "12-doublons",
    titre: "Ligne dupliquee a l'identique dans le fichier",
    fichier: "transactions_doublon.xlsx",
    feuilles: {
      Transactions: [
        ENT_TXN,
        ["2026-03-01", "500", "Revenu", "Ventes", "Vente"],
        ["2026-03-01", "500", "Revenu", "Ventes", "Vente"],
        ["2026-03-02", "80", "Dépense", "Pub", "Annonce"],
      ],
    },
    // Sans identifiant : les deux lignes identiques sont conservees et la
    // repetition signalee comme doublon potentiel (regle du 22 sept 2026).
    donnees: 3,
    signaler: ["Doublon potentiel détecté"],
  },
  {
    id: "13-multi-feuilles",
    titre: "Classeur multi-feuilles (clients + produits + note)",
    fichier: "classeur.xlsx",
    feuilles: {
      Clients: [
        ["ID Client", "Nom", "Courriel", "Ville"],
        ["C-1", "Julie Leblanc", "julie@x.ca", "Montréal"],
        ["C-2", "Marc Roy", "marc@x.ca", "Québec"],
      ],
      Produits: [
        ["SKU", "Description", "Catégorie", "Prix Vente ($)"],
        ["P-1", "Tente", "Camping", 450],
        ["P-2", "Sac", "Randonnée", 120],
      ],
    },
    donnees: 4,
  },
  {
    id: "14-donnees-mixtes",
    titre: "Formats mixtes (1 250,50 $, dates JJ/MM)",
    fichier: "transactions_formats.xlsx",
    feuilles: {
      Transactions: [
        ENT_TXN,
        ["15/03/2026", "1 250,50 $", "Revenu", "Ventes", "A"],
        ["16/03/2026", "(300,00)", "Dépense", "Achats", "B"],
        ["17/03/2026", "45.000", "Revenu", "Ventes", "C"],
      ],
    },
    donnees: 3,
  },
  {
    id: "15-valeurs-enum-inconnues",
    titre: "Canal jamais rencontre (TikTok Shop) + departement hors liste",
    fichier: "equipe.xlsx",
    feuilles: {
      Employes: [
        ["ID Employé", "Nom", "Département", "Rôle"],
        ["E-1", "Anne Roy", "Comptabilité", "Directrice financière"],
        ["E-2", "Luc Tremblay", "Recherche", "Chercheur"],
      ],
      Commandes: [
        ["No commande", "Date", "Canal", "Total"],
        ["Q-1", "2026-08-01", "TikTok Shop", 60],
      ],
    },
    donnees: 3,
    colonnes_brutes: ["Département"],
    signaler: ["Recherche", "TikTok Shop"],
  },
  {
    id: "16-colonne-ecartee-par-ia",
    titre: "Colonne jugee sans correspondance par l'IA (brut a conserver)",
    fichier: "commandes_ia.xlsx",
    feuilles: {
      Commandes: [
        ["No commande", "Date", "Produit", "Quantité", "Prix unitaire", "Code interne"],
        ["I-1", "2026-08-01", "Tente", 1, 450, "Z-77"],
        ["I-2", "2026-08-02", "Sac", 1, 120, "Z-78"],
      ],
    },
    reponse_ia: () => ({
      entite: "Order",
      ligne_entetes: 0,
      lignes_ignorees: [],
      colonnes: [
        { colonne: "No commande", champ: "order_id" },
        { colonne: "Date", champ: "date" },
        { colonne: "Produit", champ: "product_name" },
        { colonne: "Quantité", champ: "quantity" },
        { colonne: "Prix unitaire", champ: "unit_price" },
        { colonne: "Code interne", champ: null },
      ],
      confiance: "haute",
      explication: "Commandes",
    }),
    donnees: 2,
    colonnes_brutes: ["Code interne"],
    signaler: ["Code interne"],
  },
  {
    id: "18-ventes-id-et-nom",
    titre: "Ventes avec « ID Client » ET « Client » (extrait du classeur Nordik)",
    fichier: "ventes_nordik.xlsx",
    feuilles: {
      "Ventes (1200+)": [
        ["ID Transaction", "Date", "ID Client", "Client", "Code Produit", "Description Produit", "Quantité", "Prix Unitaire ($)", "ID Employé", "Employé", "Succursale"],
        ["V-1", "2026-01-02", "C-881", "Leblanc, Gabriel", "ACC-L002", "Lampe frontale", 2, 45, "EMP-005", "Mathieu Côté", "Lévis"],
        ["V-2", "2026-01-02", "C-882", "Roy, Julie", "CAM-T004", "Tente 4 saisons", 1, 450, "EMP-001", "Jean Gagnon", "Laval"],
        ["V-3", "2026-01-03", "C-881", "Leblanc, Gabriel", "ACC-L002", "Lampe frontale", 1, 45, "EMP-005", "Mathieu Côté", "Lévis"],
      ],
    },
    donnees: 3,
    attendu: {
      entites: { "Ventes (1200+)": "Order" },
      champs: { "ID Transaction": "order_id", "ID Client": "customer_id", "Client": "customer_name", "ID Employé": "employee_id", "Description Produit": "product_name" },
    },
  },
  {
    id: "19-stocks-multi-entrepots",
    titre: "Meme SKU dans plusieurs entrepots (extrait du classeur de simulation)",
    fichier: "stocks.xlsx",
    feuilles: {
      Stocks_MultiEntrepots: [
        ["SKU", "Description_Produit", "ID_Depot", "Nom_Depot", "Quantite_En_Stock"],
        ["CAM-T004", "Tente Boréal", "DEP-01", "Bécancour", 243],
        ["CAM-T004", "Tente Boréal", "DEP-02", "Lévis", 12],
        ["ACC-L002", "Lampe", "DEP-01", "Bécancour", 80],
        ["ACC-L002", "Lampe", "DEP-02", "Lévis", 5],
      ],
    },
    donnees: 4,
    colonnes_brutes: ["ID_Depot", "Nom_Depot"],
    attendu: { entites: { Stocks_MultiEntrepots: "Inventory" }, champs: { SKU: "product_id", Quantite_En_Stock: "closing_stock" } },
  },
  {
    id: "20-deux-valeurs-de-stock",
    titre: "Valeur au cout et valeur de vente : chacune dans son champ (inventory_value / sale_value)",
    fichier: "valorisation.xlsx",
    feuilles: {
      "Stocks & Inventaire": [
        ["SKU", "Description", "Qté en Stock", "Valeur Stock Coût ($)", "Valeur Stock Vente ($)"],
        ["CAM-T004", "Tente", 45, 9450, 20250],
        ["ACC-L002", "Lampe", 80, 1440, 3600],
      ],
    },
    donnees: 2,
    colonnes_brutes: ["Valeur Stock Vente ($)"],
    attendu: {
      entites: { "Stocks & Inventaire": "Inventory" },
      champs: { "Qté en Stock": "closing_stock", Description: "product_name", "Valeur Stock Coût ($)": "inventory_value", "Valeur Stock Vente ($)": "sale_value" },
    },
  },
  {
    id: "21-montant-prouve-par-calcul",
    titre: "« Montant » (nom ambigu) prouve par Qté × PU",
    fichier: "ventes_calcul.xlsx",
    type_manuel: "Order",
    feuilles: {
      Ventes: [
        ["No commande", "Date", "Qté", "PU", "Montant"],
        ["M-1", "2026-05-01", 2, 45, 90],
        ["M-2", "2026-05-02", 1, 450, 450],
        ["M-3", "2026-05-03", 3, 12.5, 37.5],
      ],
    },
    donnees: 3,
    signaler: ["quantité × prix unitaire", "vérifié", "3/3"],
  },
  {
    id: "22-code-client-par-relation",
    // Intitule sans aucun indice lexical (« Réf. acheteur » est desormais reconnu
    // par le lexique) : seule la relation avec la feuille Clients peut le rattacher.
    titre: "« Réf. partenaire » (inconnu) reconnu : ses codes sont ceux de la feuille Clients",
    fichier: "classeur_relations.xlsx",
    feuilles: {
      Clients: [
        ["ID Client", "Nom", "Ville"],
        ["C-881", "Leblanc, Gabriel", "Lévis"],
        ["C-882", "Roy, Julie", "Laval"],
        ["C-883", "Côté, Marc", "Québec"],
      ],
      Ventes: [
        ["No commande", "Date", "Réf. partenaire", "Montant Total ($)"],
        ["R-1", "2026-06-01", "C-881", 90],
        ["R-2", "2026-06-02", "C-883", 450],
        ["R-3", "2026-06-02", "C-881", 45],
      ],
    },
    donnees: 6,
    attendu: { entites: { Clients: "Customer", Ventes: "Order" }, champs: { "Réf. partenaire": "customer_id" } },
    signaler: ["existent dans les clients"],
  },
  {
    id: "23-valeurs-inhabituelles",
    titre: "Montant negatif et valeur extreme : importes, signales",
    fichier: "releve_anomalies.xlsx",
    feuilles: {
      Transactions: [
        ENT_TXN,
        ...Array.from({ length: 10 }, (_, i) => [`2026-02-${String(i + 1).padStart(2, "0")}`, String(100 + i * 5), "Revenu", "Ventes", `Vente ${i + 1}`]),
        ["2026-02-20", "-500", "Dépense", "Ventes", "Remboursement client"],
        ["2026-02-21", "48000", "Revenu", "Ventes", "Vente exceptionnelle ?"],
      ],
    },
    donnees: 12,
    signaler: ["négative", "fois la médiane"],
  },
  {
    id: "24-equation-de-stock",
    titre: "Stock initial + achats - ventes = stock final",
    fichier: "mouvements_stock.xlsx",
    feuilles: {
      Inventaire: [
        ["SKU", "Stock ouverture", "Achats", "Unités vendues", "Stock clôture"],
        ["CAM-T004", 40, 20, 15, 45],
        ["ACC-L002", 100, 0, 20, 80],
        ["SAC-R010", 12, 10, 7, 15],
      ],
    },
    donnees: 3,
    signaler: ["= stock final (3/3 lignes)", "date réelle inconnue"],
    attendu: { entites: { Inventaire: "Inventory" }, champs: { "Achats": "purchases", "Unités vendues": "units_sold", "Stock clôture": "closing_stock" } },
  },
  {
    id: "17-feuille-inconnue",
    titre: "Registre d'immobilisations : entite Asset (inconnue avant le 23 sept 2026)",
    fichier: "immobilisations.xlsx",
    feuilles: {
      Registre: [
        ["ID_Immobilisation", "Description_Actif", "Classe_DPA_Fiscale", "Taux_Amortissement_DPA"],
        ["IMM-1", "Batiment", "Classe 1", 0.04],
        ["IMM-2", "Camion", "Classe 10", 0.3],
        ["IMM-3", "Serveur", "Classe 50", 0.55],
      ],
    },
    donnees: 3,
    attendu: { entites: { Registre: "Asset" }, champs: { ID_Immobilisation: "asset_id", Taux_Amortissement_DPA: "cca_rate" } },
  },
];

/** Classeurs reels du dossier parent : pas de verite terrain, suivi avant/apres. */
export const CLASSEURS_REELS = [
  "../Nordik_PleinAir_Donnees_Complet_2026.xlsx",
  "../Entreprise_Simulation_50Ans_Canada_QC.xlsx",
];
