import React, { useState } from "react";
import { 
  ChevronDown, Lightbulb, Upload, LayoutDashboard, AlertTriangle, MessageSquare, Sparkles, Brain, Calculator, Target, 
  Users, Package, Wallet, ShieldCheck, CheckCircle2, Building2, Landmark, Wrench,
  Calendar, FileText, BarChart3, HelpCircle, ArrowRight, TrendingUp, Radar as RadarIcon,
  ShieldAlert, Activity, CheckSquare, Search, Compass, Sliders, Layers, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import ManualTableOfContents from "@/components/ManualTableOfContents";
import BrandLogo from "@/components/BrandLogo";

const groups = [
  {
    label: "1. Démarrage & Fondations",
    sections: [
      {
        id: "demarrage",
        title: "Configuration & Prise en Main (Desktop & Mobile)",
        icon: Sparkles,
        badge: "3 minutes",
        objective: "Établir la carte d'identité de l'entreprise et naviguer avec aisance sur ordinateur, tablette et smartphone.",
        content: [
          {
            h: "Action 1 : Renseigner le profil de votre entreprise",
            action: "Configurez l'environnement de travail dès votre première connexion :",
            steps: [
              "Accédez au menu « Paramètres » ou complétez le formulaire initial d'accueil.",
              "Renseignez la raison sociale, votre secteur d'activité (ex. Commerce de détail plein air) et la devise par défaut ($ CAD).",
              "Saisissez l'adresse de votre site web et cliquez sur « Auto-remplir avec l'IA » pour extraire automatiquement le modèle d'affaires et la description d'activité.",
              "Dans l'onglet Succursales, enregistrez vos points de vente réels (ex. Boutique Web, Magasin Lévis, Siège social)."
            ],
            successIndicator: "La fiche affiche le badge vert « Entreprise configurée » et vos tableaux s'adaptent instantanément à votre secteur.",
            tip: "Vous pouvez modifier ces informations à tout moment depuis les Paramètres sans impacter les données déjà importées."
          },
          {
            h: "Action 2 : Naviguer sur smartphone et tablette (Version Mobile)",
            action: "Profitez d'une expérience de pilotage fluide et réactive sur tous vos appareils :",
            steps: [
              "La barre de navigation supérieure mobile fixe affiche en permanence le logo officiel GESCOP, le nom de votre entreprise et l'état des alertes.",
              "Touchez le bouton de menu (☰) en haut à gauche pour ouvrir le volet latéral et basculer d'un module à l'autre d'un simple geste.",
              "Accédez rapidement aux Alertes en direct en cliquant sur la pastille pulsante de la barre supérieure.",
              "Ajoutez GESCOP à l'écran d'accueil de votre téléphone (PWA) pour un lancement direct et instantané comme une application native."
            ],
            successIndicator: "Tous les graphiques, tableaux financiers et fiches de décision s'ajustent automatiquement à la largeur de votre écran mobile."
          }
        ]
      },
      {
        id: "import-donnees",
        title: "Ingestion Universelle des Données (Import V3)",
        icon: Upload,
        badge: "Zéro Rejet",
        objective: "Déposer vos fichiers comptables, de ventes, de stocks et de paie sans modèle rigide ni blocage.",
        content: [
          {
            h: "Action 1 : Glisser-déposer vos classeurs Excel ou CSV",
            action: "Importez vos données en quelques secondes grâce au moteur sémantique V3 :",
            steps: [
              "Cliquez sur « Importer des données » dans le menu latéral gauche.",
              "Glissez votre classeur Excel (.xlsx multi-onglets) ou vos fichiers CSV exportés de vos logiciels (QuickBooks, Shopify, Acomba, Sage, caisse POS).",
              "Le Moteur Universel V3 analyse le contenu de chaque feuille, élimine les colonnes vides parasites (ex. col_7) et associe automatiquement vos données aux bons concepts métier.",
              "Vérifiez le tableau récapitulatif de prévisualisation et validez en un clic (« Confirmer et importer »)."
            ],
            successIndicator: "Un résumé vert confirme l'importation avec le nombre exact d'enregistrements créés pour chaque table.",
            tip: "Un seul fichier Excel contenant plusieurs onglets (Ventes, Dépenses, Trésorerie, Stocks, Paie) est reconnu et ventilé en une seule opération !"
          },
          {
            h: "Action 2 : Les formats indispensables à retenir",
            action: "Pour garantir des calculs de rentabilité d'une précision chirurgicale, voici les quelques colonnes clés par domaine :",
            table: {
              headers: ["Table métier", "Colonnes minimales recommandées", "Ce que GESCOP calcule pour vous"],
              rows: [
                ["Commandes / Ventes", "Date, ID Commande, Montant Total, ID Client (optionnel : Quantité, Succursale)", "Chiffre d'affaires hors taxes, Panier moyen (AOV), Volume de commandes, Ventes par succursale"],
                ["Dépenses", "Date, Catégorie ou Description, Montant, Fournisseur (optionnel)", "Coûts d'exploitation (OpEx), Structure des dépenses par pôle"],
                ["Trésorerie", "Date, Solde de clôture (ou Entrées / Sorties de fonds)", "Solde bancaire à date, Variation nette mensuelle, Autonomie financière (Cash Runway)"],
                ["Stocks / Inventaire", "Date, SKU ou Nom Produit, Quantité disponible, Prix vente (optionnel : Coût unitaire)", "Valeur d'inventaire, Alertes de rupture imminente, Détection du stock dormant"],
                ["Paie & Salaires", "Période (mois), ID Employé, Salaire régulier ou Coût total", "Masse salariale totale, Poids de la paie sur le CA, Productivité par employé"],
                ["Campagnes Marketing", "Nom campagne, Dépense, Clics, Conversions, Revenu attribué", "ROAS réel, Coût par clic (CPC), Coût d'acquisition client (CAC)"],
                ["Immobilisations", "Description, Date d'acquisition, Coût initial, Amortissement cumulé", "Valeur Nette Comptable (VNC), Déduction pour amortissement fiscal (DPA)"]
              ]
            },
            tip: "Le moteur reconnaît automatiquement les synonymes usuels (Qte, Mnt, Ca, Tx, Montant, Total) et tolère les fautes de frappe et variations de casse.",
            warning: "Conformité Loi 25 (Québec) : Ne téléversez jamais de données confidentielles comme les numéros d'assurance sociale (NAS) ou les numéros complets de cartes bancaires. Vos données d'entreprise demeurent hébergées au Canada dans des centres certifiés SOC2."
          }
        ]
      }
    ]
  },
  {
    label: "2. La Règle d'Or Temporelle",
    sections: [
      {
        id: "regle-temporelle",
        title: "Sélecteur de Période Universel & Règle d'Or",
        icon: Calendar,
        badge: "Architecture Clé",
        objective: "Comprendre la synchronisation parfaite entre les flux du compte de résultat et les soldes de situation.",
        content: [
          {
            h: "Action 1 : La Règle d'Or GESCOP (Flux vs Soldes)",
            action: "Chaque métrique réagit selon sa véritable nature financière :",
            steps: [
              "1. Les FLUX (Chiffre d'affaires, Dépenses, Paie, Commandes) : Ils s'additionnent sur l'intervalle sélectionné (ex. total des ventes du 1er au 31 août 2026).",
              "2. Les SOLDES & SITUATIONS (Trésorerie en banque, Valeur du stock) : Ils se mesurent à la date de clôture exacte de la période (ex. solde bancaire au 31 août à 23h59).",
              "3. Cohérence totale : Quand vous examinez le mois d'août 2026, la trésorerie affiche automatiquement vos liquidités réelles fin août, sans décalage avec vos charges du mois."
            ],
            successIndicator: "Fini les discordances : tous vos indicateurs partagent la même borne de clôture temporelle."
          },
          {
            h: "Action 2 : Naviguer avec le Sélecteur Rapide de Période",
            action: "Passez d'une perspective à l'autre en un seul clic :",
            steps: [
              "« Mois clos » (Mode recommandé par défaut) : Sélectionne automatiquement le dernier mois complet (ex. Août 2026). Garantit que les écritures de paie, factures et écritures bancaires sont stabilisées.",
              "« Mois en cours (MDT) » : Pour suivre l'activité du mois entamé au jour le jour, avec un badge visible « En cours ».",
              "« Trimestre (QTD) » : Idéal pour lisser les effets de saisonnalité d'un mois sur l'autre.",
              "« Année (YTD) » : Agrège l'activité cumulée depuis le début de l'exercice fiscal.",
              "Flèches de navigation [ < ] Mois [ > ] : Remontez ou avancez dans le temps mois par mois sans ouvrir de calendrier complexe."
            ],
            tip: "Vous pouvez également choisir une plage de dates personnalisée (Du ... Au ...) : la trésorerie et les stocks prendront automatiquement la valeur arrêtée au dernier jour de votre sélection."
          },
          {
            h: "Action 3 : Choisir le bon comparatif (MoM vs YoY)",
            action: "Donnez une signification réelle à vos pourcentages d'évolution :",
            steps: [
              "MoM (vs Mois précédent) : Recommandé pour surveiller la trésorerie immédiate et la dérive des coûts d'exploitation.",
              "YoY (vs Même période l'an passé) : Indispensable dans le commerce pour neutraliser la saisonnalité (ex. comparer août 2026 à août 2025)."
            ],
            successIndicator: "Les variations sont colorées selon leur impact : une baisse de dépense s'affiche en vert (favorable), une baisse de revenu en rouge."
          }
        ]
      }
    ]
  },
  {
    label: "3. Les Modules de Pilotage Opérationnel",
    sections: [
      {
        id: "cockpit-kpis",
        title: "Cockpit Décisionnel & Bibliothèque de KPIs",
        icon: LayoutDashboard,
        badge: "Quotidien",
        objective: "Évaluer la santé globale de l'entreprise en 10 secondes et suivre vos indicateurs stratégiques.",
        content: [
          {
            h: "Action 1 : Consulter le Score de Santé 360° & Priorités du Jour",
            action: "Vérifiez l'état de votre entreprise dès votre arrivée le matin :",
            steps: [
              "La jauge centrale indique un score global de 0 à 100 basé exclusivement sur vos données réelles.",
              "Vert (80-100) : Situation saine et pérenne.",
              "Jaune (60-79) : Points de vigilance nécessitant un arbitrage ou une optimisation de coûts.",
              "Rouge (< 60) : Tension critique sur la trésorerie, la rentabilité ou des ruptures de stocks.",
              "Consultez les 3 à 5 priorités du jour générées par le moteur d'audit, chiffrées avec leur gain potentiel en $ CAD."
            ],
            successIndicator: "Après chaque nouvel import, cliquez sur « Actualiser l'analyse » pour recalculer vos priorités en 5 secondes."
          },
          {
            h: "Action 2 : Explorer la page Indicateurs (KPIs)",
            action: "Approfondissez chaque dimension de votre activité :",
            steps: [
              "Consultez les métriques clés réparties par domaine (Finance, Ventes, Clients, Opérations, Marketing).",
              "Chaque carte KPI affiche la valeur de la période, sa comparaison historique et son statut de complétude.",
              "Cliquez sur un indicateur pour afficher sa tendance graphique et sa formule de calcul certifiée."
            ],
            successIndicator: "Tous vos indicateurs s'adaptent instantanément à la période sélectionnée dans le filtre supérieur."
          }
        ]
      },
      {
        id: "finance-tresorerie",
        title: "Finance (P&L) & Trésorerie (Cash Runway)",
        icon: Landmark,
        badge: "Rentabilité & Cash",
        objective: "Maîtriser la cascade de rentabilité et protéger la liquidité bancaire de l'entreprise.",
        content: [
          {
            h: "Action 1 : Piloter la cascade de rentabilité (Compte de résultat)",
            action: "Suivez la décomposition rigoureuse de vos marges :",
            steps: [
              "Chiffre d'affaires total : Revenus réels hors taxes tirés des commandes et ventes.",
              "Coût des marchandises vendues (COGS) & Marge brute : Rentabilité directe sur vos produits vendus.",
              "Charges d'exploitation (OpEx) & Masse salariale : Totalité des frais de fonctionnement et de paie.",
              "Résultat net & EBITDA : Bénéfice ou perte réelle dégagée par l'exploitation de la période."
            ],
            successIndicator: "Intégrité des calculs : Si vos fichiers de commandes n'incluaient pas les coûts d'achat unitaires, GESCOP indique honnêtement « Non mesuré » ou « Partiel » plutôt que d'afficher une marge fictive."
          },
          {
            h: "Action 2 : Sécuriser la trésorerie & l'Autonomie (Cash Runway)",
            action: "Anticipez vos liquidités pour éviter toute cessation de paiement :",
            steps: [
              "Consultez le Solde bancaire disponible au dernier jour de la période choisie.",
              "Vérifiez le Flux net de trésorerie (Total des encaissements réels moins Décaissements réels).",
              "Surveillez le Cash Runway : nombre estimé de mois d'autonomie financière sans nouveau revenu à rythme de dépenses constant."
            ],
            warning: "Si votre autonomie financière descend sous le seuil d'alerte des 60 jours, une notification critique rouge s'active sur votre bandeau."
          }
        ]
      },
      {
        id: "stocks-produits",
        title: "Stocks, Ruptures & Neutralisation des Dormants",
        icon: Package,
        badge: "Opérations",
        objective: "Éliminer le capital immobilisé, éviter les ruptures et piloter la marge par produit.",
        content: [
          {
            h: "Action 1 : Piloter les stocks et les réapprovisionnements",
            action: "Maintenez le juste niveau d'inventaire en entrepôt :",
            steps: [
              "Visualisez la Valeur d'inventaire totale et le volume d'unités physiques en rayon.",
              "Isolez les articles en statut « Proche rupture » ou « Rupture » pour émettre vos bons de commande fournisseurs à temps.",
              "Consultez le point de commande recommandé (seuil critique de réapprovisionnement) pour chaque référence."
            ],
            successIndicator: "La valeur du stock immobilisé est chiffrée au dollar près."
          },
          {
            h: "Action 2 : Neutraliser les faux positifs sur le « Stock dormant »",
            action: "Comprenez la détection intelligente de l'ancienneté des stocks :",
            steps: [
              "Définition : Une référence est classée « dormante » si aucune vente n'a été enregistrée sur une période prolongée (ex. 90 jours).",
              "Date de référence historique intelligente : Si vos données importées s'arrêtent au 31 mars, GESCOP calcule l'ancienneté par rapport au 31 mars, et non par rapport à la date du jour !",
              "Résultat : Fini les fausses alertes où 100 % de votre inventaire était déclaré dormant simplement parce que l'export datait de quelques mois."
            ],
            tip: "Utilisez la recommandation de déstockage automatique pour libérer des liquidités sur les références à rotation lente."
          }
        ]
      },
      {
        id: "succursales-reseau",
        title: "Succursales & Multi-Points de Vente",
        icon: Building2,
        badge: "Réseau",
        objective: "Comparer la rentabilité et le volume de ventes entre vos magasins physiques et votre boutique en ligne.",
        content: [
          {
            h: "Action 1 : Évaluer la performance comparative des succursales",
            action: "Détectez les disparités de rentabilité géographique :",
            steps: [
              "Accédez à la page « Succursales » pour comparer le Chiffre d'affaires, le panier moyen (AOV) et la marge ventilés par emplacement (ex. Boutique Web, Lévis, Chicoutimi).",
              "Identifiez les succursales motrices et celles dont les frais de fonctionnement pèsent trop lourd sur le résultat.",
              "Filtrez vos rapports par succursale pour afficher un compte de résultat dédié à un emplacement spécifique."
            ],
            successIndicator: "La contribution relative (%) de chaque point de vente au chiffre d'affaires global de l'entreprise est affichée automatiquement."
          }
        ]
      },
      {
        id: "marketing-rh-achats",
        title: "Marketing, RH, Achats & Immobilisations",
        icon: Users,
        badge: "Pôles Métier",
        objective: "Superviser vos investissements publicitaires, la masse salariale, les achats fournisseurs et vos actifs.",
        content: [
          {
            h: "Action 1 : Marketing & Publicité (ROAS & CAC)",
            action: "Mesurez la rentabilité réelle de vos canaux d'acquisition :",
            steps: [
              "Consultez les dépenses publicitaires, le volume de clics, les conversions et le revenu déclaré par campagne.",
              "Suivez le coût d'acquisition client (CAC) et le retour sur investissement publicitaire (ROAS).",
              "GESCOP croise ces chiffres avec vos commandes réelles pour détecter si les plateformes ne s'attribuent pas du chiffre d'affaires fictif."
            ],
            successIndicator: "Le budget marketing est piloté sur les ventes réellement encaissées."
          },
          {
            h: "Action 2 : Ressources Humaines & Productivité",
            action: "Contrôlez l'adéquation entre masse salariale et volume d'affaires :",
            steps: [
              "Consultez la masse salariale globale (salaires fixes, horaires, heures supplémentaires et commissions).",
              "Surveillez le ratio Masse salariale / Chiffre d'affaires (généralement entre 15 % et 35 % selon le secteur).",
              "Mesurez le chiffre d'affaires moyen généré par employé."
            ],
            successIndicator: "Chaque vendeur commissionné voit ses commissions calculées en direct sur les commandes enregistrées."
          },
          {
            h: "Action 3 : Achats, Fournisseurs & Immobilisations (DPA)",
            action: "Gérez vos relations fournisseurs et l'amortissement fiscal de vos actifs :",
            steps: [
              "Fournisseurs : Suivez les délais moyens de livraison, les conditions de paiement et les scores de fiabilité.",
              "Immobilisations : Suivez le coût initial d'acquisition, les amortissements cumulés et la Valeur Nette Comptable (VNC).",
              "Fiscalité canadienne : Consultez les classes de Déduction pour Amortissement (DPA) calculées pour votre clôture annuelle."
            ],
            successIndicator: "La dépréciation annuelle déductible est calculée sans calculatrice externe."
          }
        ]
      }
    ]
  },
  {
    label: "4. Le Moteur de Détection & d'Analyse Croisée",
    sections: [
      {
        id: "analyse-croisee",
        title: "L'Analyse Croisée entre Modules (Cross-Signal Engine)",
        icon: Activity,
        badge: "Cœur Invisible",
        objective: "Découvrir ce qu'aucune table ne révèle seule en croisant automatiquement vos 14 sources de données.",
        content: [
          {
            h: "Action 1 : Le principe du croisement déterministe",
            action: "Comment GESCOP détecte les incohérences invisibles :",
            steps: [
              "Dans un tableur classique, chaque fichier est isolé : les ventes ne parlent pas à la paie, la trésorerie ignore les campagnes publicitaires.",
              "Le Moteur de Croisement GESCOP confronte mathématiquement les tables entre elles pour révéler les contradictions cachées.",
              "Aucune règle n'invente de chiffres : le moteur compare deux faits réels et signale immédiatement l'écart."
            ],
            successIndicator: "Chaque constat croisé indique sa source, le calcul exact effectué et l'action corrective recommandée."
          },
          {
            h: "Action 2 : Les 6 grands audits croisés automatiques",
            action: "Les vérifications opérées en continu sur votre base :",
            table: {
              headers: ["Audit Croisé", "Sources comparées", "Problème détecté & Risque évité"],
              rows: [
                ["Marketing vs Ventes réelles", "Campagnes publicitaires vs Commandes réelles", "Détecte si les régies s'attribuent plus de revenus que le CA réel total (évite de payer du budget sur un faux ROAS)."],
                ["Conversions vs Commandes", "Conversions publicitaires vs Commandes encaissées", "Détecte si les plateformes comptent de simples clics ou visites comme des achats (coût par conversion artificiellement bas)."],
                ["Masse salariale vs CA", "Fiches de paie vs Chiffre d'affaires global", "Alerte si la paie dépasse le chiffre d'affaires ou si des salaires annuels ont été importés par erreur comme des montants mensuels."],
                ["Couverture de la paie", "Fiches de paie mensuelles vs Liste des employés actifs", "Vérifie si tous les salariés enregistrés reçoivent bien une paie ou si certains employés inactifs polluent la base."],
                ["Cohérence Coût vs Salaire", "Coût employeur total vs Salaires + Primes versées", "Alerte si la colonne coût total est inférieure au salaire versé (colonne mal nommée à l'export comptable)."],
                ["Trésorerie vs Résultat net", "Variation du solde bancaire vs Résultat net comptable", "Alerte si la trésorerie augmente alors que le résultat est en perte (charges non payées), ou si le résultat est positif mais que le cash fond (impayés clients)."],
                ["Écritures datées dans le futur", "Toutes les dates vs Date du jour", "Isole les écritures prévisionnelles ou erreurs d'inversion jour/mois qui fausseraient vos clôtures."]
              ]
            },
            tip: "Consultez l'onglet « Rapports » ou le bandeau d'audit pour visualiser ces constats croisés actualisés."
          }
        ]
      },
      {
        id: "anomalies-risques",
        title: "Détection des Anomalies, Risques & Alertes en Direct",
        icon: ShieldAlert,
        badge: "Protection 360°",
        objective: "Identifier les fuites de rentabilité, cartographier les risques et recevoir des alertes instantanées.",
        content: [
          {
            h: "Action 1 : Traiter les Anomalies Détectées",
            action: "Corrigez les failles opérationnelles avant qu'elles ne coûtent cher :",
            steps: [
              "Rendez-vous sur la page « Anomalies » dans le menu latéral.",
              "Le système répertorie les écarts anormaux : marges négatives sur un produit, commandes anormalement élevées, doublons de facturation, écritures orphelines.",
              "Chaque anomalie indique son impact financier direct en dollars ($ CAD) et le lien direct vers l'enregistrement concerné."
            ],
            successIndicator: "La résolution d'une anomalie met à jour instantanément votre score de santé global."
          },
          {
            h: "Action 2 : Suivre la Matrice des Risques d'Entreprise",
            action: "Anticipez les menaces financières et opérationnelles :",
            steps: [
              "Accédez à la page « Risques » pour visualiser la cartographie classée par gravité (Critique, Élevé, Modéré).",
              "Risque de dépendance client : Détecte si un client unique pèse plus de 20 % de votre chiffre d'affaires.",
              "Risque d'attrition (Churn) : Isole les clients stratégiques n'ayant pas commandé depuis plus de 90 jours.",
              "Risque d'illiquidité : Alerte en amont d'une tension de trésorerie prévisible à court terme."
            ],
            successIndicator: "Chaque fiche de risque propose un plan d'atténuation concret."
          },
          {
            h: "Action 3 : Le Centre d'Alertes en Direct",
            action: "Restez informé sans être submergé de notifications :",
            steps: [
              "La pastille lumineuse dans le menu latéral et dans la barre supérieure mobile indique le niveau d'alerte en direct.",
              "Cliquez sur « Alertes » pour voir la liste priorisée des événements requérant une intervention immédiate.",
              "Filtrez les alertes par sévérité pour traiter les urgences en priorité."
            ],
            successIndicator: "Une alerte traitée disparaît automatiquement du centre de notification."
          }
        ]
      },
      {
        id: "audit-calculs",
        title: "Audit des Calculs, Complétude & Quarantaine",
        icon: Search,
        badge: "Transparence",
        objective: "Vérifier la traçabilité complète de chaque chiffre et inspecter les lignes de données mises en quarantaine.",
        content: [
          {
            h: "Action 1 : Inspecter l'intégrité de vos données",
            action: "Assurez-vous de la qualité irréprochable de votre base :",
            steps: [
              "Ouvrez la page « Audit des calculs » dans le menu.",
              "Consultez l'indice de complétude globale (% des champs requis effectivement renseignés dans vos fichiers).",
              "Vérifiez l'historique d'importation : chaque lot importé conserve sa date, son créateur et son fichier source."
            ],
            successIndicator: "Vous disposez d'une piste d'audit complète et vérifiable pour votre comptable ou réviseur."
          },
          {
            h: "Action 2 : Gérer le tableau de Quarantaine",
            action: "Comprenez pourquoi une ligne de fichier n'a pas été retenue :",
            steps: [
              "Si un fichier contenait une ligne invalide (ex. texte dans une colonne montant, date illisible), elle est automatiquement isolée dans la Quarantaine.",
              "Consultez le motif précis du rejet (ex. montant textuel au lieu d'un nombre).",
              "Corrigez votre fichier source ou retraitez l'import en un clic."
            ],
            successIndicator: "Zéro corruption de votre base de données : seules les données saines participent aux calculs financiers."
          }
        ]
      }
    ]
  },
  {
    label: "5. Le Radar Stratégique & Veille de Marché",
    sections: [
      {
        id: "radar-strategique",
        title: "Le Radar Décisionnel & Signaux Externes",
        icon: RadarIcon,
        badge: "Intelligence Externe",
        objective: "Surveiller les mouvements de marché, la concurrence, la réglementation et l'environnement économique.",
        content: [
          {
            h: "Action 1 : Explorer les 8 Familles du Radar",
            action: "Captez les signaux faibles qui impactent votre rentabilité :",
            steps: [
              "Ouvrez la page « Radar » dans le menu.",
              "Le radar surveille en continu 8 familles sectorielles :",
              "1. Marché & Demande : Évolution de la demande globale, comportement des acheteurs et tendances de prix.",
              "2. Concurrence : Mouvements des concurrents, nouveaux entrants, ouvertures et fermetures de magasins.",
              "3. Commercial & Marketing : Tendances publicitaires du marché et canaux émergents.",
              "4. Technologie : Outils d'automatisation, IA, plateformes et cybersécurité.",
              "5. Économie & Finance : Taux d'intérêt, inflation, pouvoir d'achat et coûts des matières.",
              "6. Réglementation : Lois (ex. Loi 25), fiscalité québécoise et canadienne, normes du travail.",
              "7. Territoire & Environnement : Dynamique des zones commerciales locales, météo et saisonnalité.",
              "8. Écosystème & Talents : Marché de l'emploi, pénurie de main-d'œuvre et relations fournisseurs."
            ],
            successIndicator: "Le radar profile automatiquement les domaines prioritaires selon votre secteur d'activité."
          },
          {
            h: "Action 2 : Gérer vos concurrents directs & lancer un Scan",
            action: "Gardez une longueur d'avance sur vos rivaux locaux :",
            steps: [
              "Dans l'onglet Concurrents, enregistrez vos rivaux directs avec leur localisation et leur positionnement de prix.",
              "Cliquez sur « Lancer un scan Radar » pour actualiser la veille externe.",
              "GESCOP croise ces signaux externes avec vos chiffres internes : si un concurrent baisse ses prix sur une catégorie où votre marge est faible, une alerte stratégique vous avertit."
            ],
            successIndicator: "Vos décisions d'affaires intègrent la réalité de votre marché concurrentiel local."
          }
        ]
      }
    ]
  },
  {
    label: "6. Décisions, Tâches & Projections",
    sections: [
      {
        id: "decisions-taches",
        title: "Du Diagnostic au Plan d'Action (Décisions & Tâches)",
        icon: CheckSquare,
        badge: "Exécution",
        objective: "Transformer chaque constat analytique en arbitrage formel et en plan d'action opérationnel.",
        content: [
          {
            h: "Action 1 : Enregistrer et arbitrer vos Décisions Stratégiques",
            action: "Conservez l'historique et la justification de chaque choix de gestion :",
            steps: [
              "Accédez à la page « Décisions » pour consigner les arbitrages de la direction (ex. augmentation de prix de 4 %, fermeture d'un rayon non rentable, renégociation fournisseur).",
              "Chaque décision est documentée avec son objectif chiffré, sa date d'effet et son impact prévisionnel en $ CAD.",
              "Suivez le statut de chaque décision : En réflexion → Validée → En cours d'application → Mesurée."
            ],
            successIndicator: "Mesurez quelques mois plus tard l'impact réel de vos décisions sur votre compte de résultat."
          },
          {
            h: "Action 2 : Assigner et suivre vos Tâches Opérationnelles",
            action: "Coordonnez votre équipe pour appliquer les recommandations :",
            steps: [
              "Rendez-vous dans la page « Tâches ».",
              "Créez ou convertissez une recommandation d'audit en tâche concrète (ex. « Négocier délai de paiement avec Fournisseur X », « Ajuster les prix du rayon Camping »).",
              "Définissez un responsable, une priorité et une date d'échéance.",
              "Basculez entre la vue Liste et la vue Kanban pour suivre l'avancement des chantiers."
            ],
            successIndicator: "Votre équipe sait exactement quelles actions mener pour améliorer la rentabilité."
          }
        ]
      },
      {
        id: "previsions-simulateur",
        title: "Prévisions & Simulateur de Scénarios",
        icon: Calculator,
        badge: "Projections",
        objective: "Tester l'impact financier de vos décisions avant de les appliquer dans le monde réel.",
        content: [
          {
            h: "Action 1 : Consulter les Prévisions d'Atterrissage",
            action: "Projetez vos résultats futurs sur les 3 à 12 prochains mois :",
            steps: [
              "Ouvrez la page « Prévisions » pour visualiser la projection automatique de vos ventes et de votre trésorerie.",
              "Le modèle tient compte de votre tendance historique, des variations saisonnières et du rythme de dépenses actuel.",
              "Visualisez le corridor prévisionnel (scénario prudent vs scénario dynamique)."
            ],
            successIndicator: "Vous anticipez vos besoins en fonds de roulement bien avant la fin de l'exercice."
          },
          {
            h: "Action 2 : Simuler un scénario de gestion dans le Simulateur",
            action: "Mesurez les répercussions chiffrées d'un arbitrage :",
            steps: [
              "Ouvrez la page « Simulateur » dans le menu.",
              "Ajustez les leviers d'action :",
              "• Hausse ou baisse des prix de vente (+3 % à +10 %)",
              "• Embauche d'un nouvel employé (salaire et charges sociales)",
              "• Réduction des frais généraux ou des dépenses marketing (-10 %)",
              "Visualisez immédiatement le tableau comparatif Avant / Après calculant l'impact net sur votre Résultat et votre Solde de trésorerie à 90 jours."
            ],
            successIndicator: "Prenez vos décisions d'investissement sur la base d'un calcul mathématique clair et sans risque."
          }
        ]
      }
    ]
  },
  {
    label: "7. Rapports, Assistant IA & Dépannage",
    sections: [
      {
        id: "rapports-ia",
        title: "Rapports en 1 Clic & Assistant CFO Conversationnel",
        icon: Brain,
        badge: "Direction & IA",
        objective: "Générer des rapports exécutifs prêts pour votre banquier et dialoguer avec votre analyste IA.",
        content: [
          {
            h: "Action 1 : Générer vos rapports exécutifs (Quotidien, Hebdo, Mensuel)",
            action: "Produisez des comptes-rendus professionnels en un seul clic :",
            steps: [
              "Rendez-vous dans la page « Rapports » et choisissez le format souhaité :",
              "• Rapport Quotidien : Indicateurs de la dernière journée d'activité vs veille, points de vigilance immédiats.",
              "• Rapport Hebdomadaire : Bilan des 7 derniers jours avec tendance sur 5 semaines consécutives.",
              "• Rapport Mensuel : Analyse complète de rentabilité, trésorerie, marges et évolution du CA sur 6 mois.",
              "Téléchargez votre rapport au format PDF soigné ou en présentation PowerPoint (.pptx) modifiable pour votre conseil d'administration ou votre banquier."
            ],
            successIndicator: "Le rapport inclut une synthèse rédigée par l'IA à partir de vos chiffres certifiés sans invention."
          },
          {
            h: "Action 2 : Dialoguer avec l'Assistant GESCOP Analyst",
            action: "Posez vos questions d'affaires en langage naturel 24h/24 :",
            steps: [
              "Ouvrez la page « Assistant IA » et tapez votre question (ex. « Où sont mes plus grandes pertes de rentabilité ? », « Comment optimiser ma trésorerie ce trimestre ? »).",
              "L'assistant analyse instantanément l'ensemble de votre base de données et répond avec des chiffres précis et vérifiés.",
              "Comprenez les badges de certification de réponse :",
              "• 🔵 Fait vérifié (FACT) : Donnée brute indiscutable extraite de vos fichiers.",
              "• 🟢 Calcul arithmétique (CALCULATION) : Résultat d'une formule mathématique stricte.",
              "• 🟣 Analyse déductive (INFERENCE) : Croisement logique entre plusieurs indicateurs.",
              "• 🟡 Hypothèse (HYPOTHESIS) : Piste explicative plausible nécessitant une validation terrain.",
              "• 🟢 Recommandation (RECOMMENDATION) : Plan d'action préconisé chiffré en $ CAD."
            ],
            successIndicator: "Garantie Zéro Hallucination : si une donnée est absente de vos fichiers, l'IA vous l'indique clairement au lieu d'inventer."
          }
        ]
      },
      {
        id: "faq-support",
        title: "Questions Fréquentes & Dépannage Immédiat",
        icon: HelpCircle,
        badge: "Support",
        objective: "Résoudre instantanément les interrogations les plus fréquentes en toute autonomie.",
        content: [
          {
            h: "1. « Pourquoi un indicateur affiche-t-il Partiel ou Non mesuré ? »",
            action: "C'est le gage d'intégrité de GESCOP :",
            steps: [
              "Explication : Si votre fichier de ventes ne contient pas le coût d'achat unitaire de chaque produit, le système refuse d'inventer une fausse marge brute.",
              "Solution : Importez votre catalogue de produits avec les prix d'achat réels. Dès l'import terminé, l'indicateur passera automatiquement en statut « Mesuré »."
            ],
            successIndicator: "Vous avez l'assurance qu'aucun chiffre de votre tableau de bord n'est fictif."
          },
          {
            h: "2. « Pourquoi mes totaux diffèrent entre le Cockpit et un rapport annuel ? »",
            action: "Comprenez le périmètre temporel sélectionné :",
            steps: [
              "Explication : Le Cockpit affiche par défaut le mois sélectionné (ex. Août 2026), tandis qu'un rapport annuel agrège l'ensemble des 12 mois de l'exercice.",
              "Solution : Vérifiez toujours la date indiquée dans le sélecteur temporel universel en haut de page pour comparer des périodes équivalentes."
            ],
            tip: "Utilisez les boutons rapides (« Mois clos », « Trimestre », « Année ») pour aligner vos analyses en un instant."
          },
          {
            h: "3. « Une colonne affiche Ignorer lors de l'import, que faire ? »",
            action: "Ajustez le raccordement en un instant :",
            steps: [
              "Colonnes vides : Si votre fichier Excel contenait des colonnes fantômes (ex. col_7, col_8), laissez-les sur « Ignorer » sans crainte.",
              "Colonne importante non reconnue : Cliquez simplement sur la liste déroulante face au nom de la colonne pour sélectionner le concept correspondant (ex. « Mt_Vente » → Montant total)."
            ],
            successIndicator: "Vos données sont intégrées sans aucune perte d'information."
          },
          {
            h: "4. « Mes données d'entreprise sont-elles protégées et confidentielles ? »",
            action: "Une protection de niveau institutionnel :",
            steps: [
              "Hébergement souverain : 100 % de vos données sont hébergées au Canada dans des centres de données sécurisés.",
              "Conformité Loi 25 du Québec : Vos informations ne sont jamais partagées avec des tiers ni utilisées pour entraîner des modèles publics d'intelligence artificielle.",
              "Isolation totale : Votre espace entreprise est étanche et accessible uniquement aux utilisateurs autorisés par votre administrateur."
            ],
            successIndicator: "Sécurité et conformité juridique garanties pour votre gouvernance d'entreprise."
          }
        ]
      }
    ]
  }
];

const allSections = groups.flatMap((g) => g.sections);

export default function Manuel() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const firstSectionId = groups[0]?.sections[0]?.id || "demarrage";
  const [activeSection, setActiveSection] = useState(firstSectionId);

  return (
    <div className="space-y-8">
      {/* En-tête officiel / Page de garde */}
      <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-10 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
          <div className="flex items-center gap-4">
            <BrandLogo className="h-14 w-14 shrink-0 rounded-2xl border border-border shadow-sm p-1" />
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/25">
                  Manuel Complet de Référence
                </span>
                <span className="text-xs font-semibold text-muted-foreground">Version 2026 · Intégrale</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Manuel d'Utilisation GESCOP
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Système d'Intelligence Stratégique, Contrôle de Gestion & Décision PME
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-border bg-background px-3 py-2 text-right">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Devise standard</p>
              <p className="text-sm font-bold text-foreground">$ CAD</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2 text-right">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Conformité</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" /> Loi 25 QC · SOC2
              </p>
            </div>
          </div>
        </div>

        {/* Fiche de cadrage rapide (Objectif, Méthode, Garantie) */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-2xl border border-border/80 bg-background/80 p-4">
            <div className="flex items-center gap-2 font-bold text-foreground mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span>Simplicité & Autonomie</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Pilotez l'ensemble de votre entreprise sans expertise comptable ni compétences informatiques poussées.
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/80 p-4">
            <div className="flex items-center gap-2 font-bold text-foreground mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <span>Analyse Croisée Multi-Modules</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Vos 14 sources de données sont croisées pour révéler les failles invisibles (marketing, paie, trésorerie).
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/80 p-4">
            <div className="flex items-center gap-2 font-bold text-foreground mb-1">
              <Brain className="h-4 w-4 text-primary" />
              <span>Zéro Hallucination</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              100 % de vos chiffres, alertes et recommandations s'appuient uniquement sur vos données réelles importées.
            </p>
          </div>
        </div>
      </div>

      {/* Corps du manuel : Sommaire interactif à gauche, Contenu à droite */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sommaire interactif sticky */}
        <aside className="lg:w-72 shrink-0">
          <div className="lg:sticky lg:top-6 space-y-4">
            <div className="flex items-center justify-between lg:block">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Table des matières
              </p>
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium lg:hidden"
              >
                <span>Chapitres</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", mobileNavOpen && "rotate-180")} />
              </button>
            </div>

            <div className={cn(mobileNavOpen ? "block" : "hidden lg:block")}>
              <ManualTableOfContents groups={groups} onActiveSectionChange={setActiveSection} />
            </div>
          </div>
        </aside>

        {/* Contenu textuel et visuel orienté action */}
        <div className="min-w-0 flex-1 max-w-4xl space-y-10">
          {allSections.map((s) => (
            <section
              key={s.id}
              id={`section-${s.id}`}
              className="scroll-mt-6 rounded-3xl border border-border bg-card p-6 sm:p-9 shadow-sm"
            >
              {/* En-tête de section */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-border">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{s.title}</h2>
                    {s.objective && (
                      <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="font-semibold text-foreground/80">Objectif :</span> {s.objective}
                      </p>
                    )}
                  </div>
                </div>
                {s.badge && (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground border border-border">
                    {s.badge}
                  </span>
                )}
              </div>

              {/* Blocs d'actions chronologiques */}
              <div className="mt-6 space-y-8">
                {s.content.map((block, i) => (
                  <div key={i} id={`heading-${s.id}-${i}`} className="scroll-mt-20 space-y-3">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                        {i + 1}
                      </span>
                      {block.h}
                    </h3>

                    {block.action && (
                      <p className="text-sm font-medium text-foreground/90 pl-8">
                        {block.action}
                      </p>
                    )}

                    {block.steps && block.steps.length > 0 && (
                      <div className="pl-8 space-y-2">
                        {block.steps.map((st, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            <span className="leading-relaxed">{st}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Table simple et lisible */}
                    {block.table && (
                      <div className="pl-8 pt-1">
                        <div className="overflow-x-auto rounded-xl border border-border">
                          <table className="w-full min-w-[500px] text-sm">
                            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                              <tr>
                                {block.table.headers.map((h, hIdx) => (
                                  <th key={hIdx} className="px-4 py-2.5 font-semibold">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {block.table.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                                  {row.map((cell, cIdx) => (
                                    <td key={cIdx} className={cn("px-4 py-3 align-top", cIdx === 0 ? "font-bold text-foreground text-xs" : cIdx === 1 ? "font-mono text-xs text-primary" : "text-xs text-muted-foreground")}>
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Indicateur de succès */}
                    {block.successIndicator && (
                      <div className="ml-8 mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5">Résultat attendu :</span>
                          <span>{block.successIndicator}</span>
                        </div>
                      </div>
                    )}

                    {/* Astuce de gestion */}
                    {block.tip && (
                      <div className="ml-8 mt-2 flex items-start gap-2.5 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-300">
                        <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5">Conseil pratique :</span>
                          <span>{block.tip}</span>
                        </div>
                      </div>
                    )}

                    {/* Point de vigilance */}
                    {block.warning && (
                      <div className="ml-8 mt-2 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5">Point de vigilance :</span>
                          <span>{block.warning}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Pied de page du guide */}
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">Une question sur vos chiffres ?</h3>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              L'Assistant GESCOP Analyst est disponible en tout temps dans le menu latéral pour analyser vos performances, expliquer vos constats et simuler vos scénarios.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}