import React, { useState } from "react";
import { 
  ChevronDown, Lightbulb, Upload, LayoutDashboard, AlertTriangle, MessageSquare, Sparkles, Brain, Calculator, Target, 
  Users, Package, Wallet, ShieldCheck, CheckCircle2, Building2, Landmark, Wrench,
  Calendar, FileText, BarChart3, HelpCircle, ArrowRight, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import ManualTableOfContents from "@/components/ManualTableOfContents";
import BrandLogo from "@/components/BrandLogo";

const groups = [
  {
    label: "1. Démarrage Rapide (3 min)",
    sections: [
      {
        id: "demarrage",
        title: "Configuration & Prise en Main",
        icon: Sparkles,
        badge: "Démarrage",
        objective: "Configurer votre entreprise en 60 secondes et naviguer avec aisance sur ordinateur et mobile.",
        content: [
          {
            h: "Action 1 : Renseigner la fiche de votre entreprise",
            action: "Complétez votre profil d'entreprise dès votre première connexion :",
            steps: [
              "Accédez à l'écran d'accueil ou ouvrez la section « Paramètres » dans le menu.",
              "Indiquez la raison sociale, votre secteur d'activité principal et votre localisation.",
              "Renseignez l'URL de votre site web et cliquez sur « Auto-remplir avec l'IA » pour extraire automatiquement le modèle d'affaires.",
              "Dans l'onglet Succursales, ajoutez vos points de vente réels (ex. Boutique Web, Magasin Lévis, Siège social)."
            ],
            successIndicator: "La fiche affiche le badge vert « Entreprise configurée » avec votre devise par défaut ($ CAD).",
            tip: "Vous pouvez modifier ces informations à tout moment depuis les Paramètres sans impacter vos données déjà importées."
          },
          {
            h: "Action 2 : Naviguer sur smartphone et tablette (Version Mobile)",
            action: "Profitez d'une expérience fluide et complète sur tous vos appareils :",
            steps: [
              "La barre supérieure fixe affiche le logo officiel GESCOP, le nom de votre entreprise et l'état des alertes en direct.",
              "Touchez le bouton de menu (☰) en haut à gauche pour ouvrir le volet de navigation complet.",
              "Accédez à vos modules favoris ou épinglez les pages que vous consultez chaque matin.",
              "Ajoutez GESCOP à l'écran d'accueil de votre téléphone (PWA) pour un accès direct instantané en un clic."
            ],
            successIndicator: "Tous vos graphiques, indicateurs et rapports s'adaptent automatiquement à la taille de votre écran."
          }
        ]
      },
      {
        id: "import-simple",
        title: "Importation Facile de vos Données",
        icon: Upload,
        badge: "Zéro Effort",
        objective: "Importer vos fichiers comptables, de ventes et de stocks sans modèle rigide ni blocage.",
        content: [
          {
            h: "Action 1 : Glisser-déposer vos classeurs Excel ou CSV",
            action: "Déposez vos fichiers pour une ingestion sémantique automatique :",
            steps: [
              "Cliquez sur « Importer des données » dans le menu latéral gauche.",
              "Glissez votre classeur Excel (.xlsx multi-feuilles) ou vos fichiers CSV exportés de vos outils habituels (QuickBooks, Shopify, Acomba, Sage, caisse POS).",
              "Le Moteur Universel V3 analyse automatiquement chaque feuille, élimine les colonnes vides parasites et associe les données aux bons concepts métier.",
              "Consultez la prévisualisation et cliquez sur « Confirmer et importer »."
            ],
            successIndicator: "Le bandeau de confirmation affiche « Données importées avec succès » avec le décompte exact des enregistrements créés.",
            tip: "Un seul fichier Excel contenant plusieurs onglets (ex. Ventes, Dépenses, Trésorerie, Stocks) est reconnu et ventilé en une seule opération !"
          },
          {
            h: "Action 2 : Les 5 types de fichiers clés (Guide ultra-simple)",
            action: "Pour que vos indicateurs soient calculés avec une précision optimale, voici les quelques colonnes essentielles par domaine :",
            table: {
              headers: ["Domaine de données", "Colonnes minimales recommandées", "Ce que GESCOP calcule pour vous"],
              rows: [
                ["Commandes / Ventes", "Date, ID Commande, Montant Total, ID Client (optionnel)", "Chiffre d'affaires, Panier moyen (AOV), Volume de commandes, Répartition par succursale"],
                ["Dépenses", "Date, Catégorie ou Description, Montant", "Structure de coûts d'exploitation (OpEx), Suivi des charges mensuelles"],
                ["Trésorerie", "Date, Solde de clôture (ou Entrées / Sorties)", "Solde bancaire à date, Variation nette de trésorerie, Autonomie financière (Runway)"],
                ["Stocks / Inventaire", "Date, Nom du produit ou SKU, Quantité en stock, Prix vente", "Valeur du stock, Alertes de rupture imminente, Détection du stock dormant"],
                ["Paie & Salaires", "Période (mois), ID Employé, Salaire régulier ou Coût total", "Masse salariale totale, Poids de la paie sur le CA, Productivité par employé"]
              ]
            },
            tip: "GESCOP reconnaît automatiquement les synonymes courants (ex. Qte, Mnt, Ca, Tx, Montant, Total) et tolère les accents français.",
            warning: "Conformité Loi 25 (Québec) : Ne chargez jamais de numéros d'assurance sociale (NAS) ou de cartes de crédit complètes. Vos données d'entreprise restent hébergées au Canada dans des centres sécurisés SOC2."
          }
        ]
      }
    ]
  },
  {
    label: "2. Le Filtre Temporel & La Règle d'Or",
    sections: [
      {
        id: "filtre-temporel",
        title: "Sélecteur Universel & Logique Temporelle",
        icon: Calendar,
        badge: "Règle d'Or",
        objective: "Comprendre la synchronisation exacte entre vos flux d'activité et vos soldes de situation.",
        content: [
          {
            h: "Action 1 : La Règle d'Or GESCOP (Flux vs Soldes)",
            action: "Chaque métrique réagit de façon rigoureuse selon sa nature financière :",
            steps: [
              "1. Les FLUX (Chiffre d'affaires, Dépenses, Paie, Commandes) : Ils s'additionnent sur l'intervalle sélectionné (ex. somme du 1er au 31 août 2026).",
              "2. Les SOLDES & SITUATIONS (Trésorerie bancaire, Valeur du stock) : Ils se mesurent à la date de clôture exacte de la période (ex. solde au 31 août à 23h59).",
              "3. La Cohérence absolue : Quand vous examinez le mois d'août 2026, la trésorerie affiche automatiquement vos liquidités réelles fin août, sans déconnexion avec vos charges du mois."
            ],
            successIndicator: "Fini les écarts incompréhensibles : tous vos indicateurs partagent la même borne de clôture temporelle."
          },
          {
            h: "Action 2 : Maîtriser le Sélecteur Rapide de Période",
            action: "Changez de perspective en un seul clic grâce aux boutons prédéfinis :",
            steps: [
              "« Mois clos » (Mode par défaut) : Sélectionne automatiquement le dernier mois complet (ex. Août 2026). Garantit que les écritures de paie et factures sont stabilisées.",
              "« Mois en cours (MDT) » : Affiche l'activité du 1er du mois jusqu'au jour présent avec un badge visible « En cours ».",
              "« Trimestre (QTD) » : Idéal pour lisser les variations ponctuelles d'un mois à l'autre.",
              "« Année (YTD) » : Agrège l'activité depuis le début de l'exercice fiscal jusqu'à aujourd'hui.",
              "Flèches de navigation [ < ] Août 2026 [ > ] : Permettent de remonter l'historique mois par mois en toute simplicité."
            ],
            tip: "Vous pouvez également sélectionner une plage de dates sur-mesure (Du ... Au ...) : la trésorerie prendra automatiquement la valeur arrêtée au dernier jour de votre sélection."
          },
          {
            h: "Action 3 : Choisir le bon mode de comparaison (MoM vs YoY)",
            action: "Donnez un sens réel à vos pourcentages d'évolution :",
            steps: [
              "MoM (vs Mois précédent) : Recommandé pour surveiller la trésorerie et la gestion des dépenses immédiates.",
              "YoY (vs Même période l'an passé) : Indispensable dans le commerce pour neutraliser la saisonnalité (ex. comparer août 2026 à août 2025)."
            ],
            successIndicator: "Les hausses et baisses sont colorées intelligemment : une baisse de charge est affichée en vert (favorable), une baisse de revenu en rouge."
          }
        ]
      }
    ]
  },
  {
    label: "3. Les Modules de Pilotage",
    sections: [
      {
        id: "cockpit",
        title: "Cockpit & Priorités Décisionnelles",
        icon: LayoutDashboard,
        badge: "Quotidien",
        objective: "Évaluer la santé globale de l'entreprise en 10 secondes et connaître les priorités d'action du jour.",
        content: [
          {
            h: "Action 1 : Consulter le Score de Santé 360°",
            action: "Vérifiez la viabilité de votre entreprise dès votre première gorgée de café :",
            steps: [
              "La jauge centrale indique un score global de 0 à 100 basé exclusivement sur vos données réelles.",
              "Vert (80-100) : Situation financière et opérationnelle saine.",
              "Jaune (60-79) : Points de vigilance nécessitant un arbitrage ou une optimisation de coûts.",
              "Rouge (< 60) : Tension critique sur la trésorerie, la rentabilité ou des ruptures de stocks."
            ],
            successIndicator: "Chaque domaine clé (Finance, Ventes, Trésorerie, Stocks, RH...) indique sa note individuelle et sa tendance."
          },
          {
            h: "Action 2 : Appliquer les Priorités Stratégiques du Jour",
            action: "Traitez les recommandations hiérarchisées par impact financier :",
            steps: [
              "Consultez les 3 à 5 priorités du jour générées par le moteur d'audit.",
              "Chaque recommandation est quantifiée avec son gain ou son économie potentielle chiffrée en $ CAD.",
              "Après un nouvel import de données, cliquez sur « Actualiser l'analyse » pour recalculer les priorités en 5 secondes."
            ],
            successIndicator: "Chaque recommandation vous propose une action concrète à appliquer dans votre exploitation."
          }
        ]
      },
      {
        id: "finance-treso",
        title: "Finance (P&L) & Trésorerie (Cash)",
        icon: Landmark,
        badge: "Rentabilité & Cash",
        objective: "Suivre la rentabilité nette réelle et anticiper l'autonomie financière de l'entreprise.",
        content: [
          {
            h: "Action 1 : Piloter la cascade de rentabilité (P&L)",
            action: "Suivez la décomposition rigoureuse de vos marges :",
            steps: [
              "Consultez le Chiffre d'affaires hors taxes, le Coût des marchandises vendues (COGS) et la Marge brute.",
              "Analysez la marge nette (%) et l'EBITDA après déduction des charges d'exploitation et de la paie.",
              "Intégrité des calculs : Si vos fichiers de vente n'incluaient pas les coûts d'achat unitaires, GESCOP indique honnêtement « Non mesuré » ou « Partiel » plutôt que d'afficher une marge fictive."
            ],
            successIndicator: "Tous vos indicateurs financiers sont exprimés en dollars canadiens ($ CAD) arrondis pour une prise de décision rapide."
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
        id: "stocks-succursales",
        title: "Stocks, Produits & Succursales",
        icon: Package,
        badge: "Opérations",
        objective: "Éliminer le capital immobilisé, éviter les ruptures et comparer vos points de vente.",
        content: [
          {
            h: "Action 1 : Gérer l'inventaire & neutraliser les faux stocks dormants",
            action: "Optimisez vos commandes d'approvisionnement et vos liquidités :",
            steps: [
              "Consultez la Valeur d'inventaire totale et le nombre d'articles en stock.",
              "Isolez les références en statut « Proche rupture » pour relancer vos fournisseurs avant la rupture physique.",
              "Surveillez le « Stock dormant » : produits sans rotation depuis plus de 90 jours représentant du cash immobilisé.",
              "Date de référence historique intelligente : Si vos données importées s'arrêtent par exemple au 31 mars, GESCOP calcule l'ancienneté du stock par rapport au 31 mars pour éviter toute fausse alerte liée au décalage dans le temps."
            ],
            tip: "Un stock dormant détecté s'accompagne d'une proposition automatique de déstockage ou d'action commerciale ciblée."
          },
          {
            h: "Action 2 : Comparer la rentabilité de vos Succursales",
            action: "Analysez la contribution relative de chaque emplacement physique et de votre canal Web :",
            steps: [
              "Accédez à la page « Succursales » pour comparer le Chiffre d'affaires, le panier moyen et les marges par point de vente.",
              "Identifiez les succursales motrices et celles qui nécessitent une révision de leurs frais fixes.",
              "Filtrez vos rapports par succursale pour afficher un compte de résultat dédié à un emplacement spécifique."
            ],
            successIndicator: "La part de chaque magasin dans le chiffre d'affaires total est calculée automatiquement en pourcentage."
          }
        ]
      }
    ]
  },
  {
    label: "4. Rapports Automatisés & Décisions IA",
    sections: [
      {
        id: "rapports",
        title: "Rapports en 1 Clic & Constats Croisés",
        icon: FileText,
        badge: "Audit & Synthèse",
        objective: "Générer des comptes-rendus de direction professionnels et détecter les anomalies croisées.",
        content: [
          {
            h: "Action 1 : Générer vos rapports exécutifs (Quotidien, Hebdo, Mensuel)",
            action: "Créez des documents clairs et prêts à partager avec vos associés, investisseurs ou banquiers :",
            steps: [
              "Rendez-vous dans l'onglet « Rapports » et sélectionnez la périodicité désirée :",
              "• Rapport Quotidien : Indicateurs de la dernière journée d'activité vs veille, points de vigilance immédiats.",
              "• Rapport Hebdomadaire : Synthèse des 7 derniers jours avec tendance sur 5 semaines consécutives.",
              "• Rapport Mensuel : Bilan complet de rentabilité, marge, trésorerie et évolution du CA sur 6 mois.",
              "Téléchargez votre rapport d'un clic en PDF propre ou en présentation PowerPoint (.pptx) modifiable."
            ],
            successIndicator: "Le rapport inclut une synthèse exécutive rédigée par l'IA à partir de vos chiffres certifiés sans invention."
          },
          {
            h: "Action 2 : Exploiter les « Constats Croisés » (Audit Multi-Tables)",
            action: "Le moteur scanne 100 % de votre Data Core (l'ensemble de vos 14 sources de données) pour déceler ce que l'œil humain ne remarque pas :",
            steps: [
              "Marketing vs Ventes réelles : Compare le revenu déclaré par les régies publicitaires (ex. Facebook, Google Ads) à vos ventes réelles pour éviter de payer du budget sur un faux ROAS.",
              "Conversions vs Commandes : Rapproche les conversions web du nombre de commandes réellement payées.",
              "Masse salariale vs CA : Alerte si la paie dépasse le chiffre d'affaires ou si des montants annuels ont été importés comme mensuels.",
              "Dates incohérentes : Isole automatiquement les écritures datées dans le futur pour ne pas fausser les clôtures."
            ],
            successIndicator: "Chaque anomalie est classée par niveau de gravité (Critique, Important, Modéré) avec l'action corrective recommandée."
          }
        ]
      },
      {
        id: "assistant",
        title: "Assistant CFO & Simulateur de Scénarios",
        icon: Brain,
        badge: "Intelligence",
        objective: "Interroger vos chiffres en langage naturel et tester l'impact financier de vos décisions avant de les exécuter.",
        content: [
          {
            h: "Action 1 : Poser une question stratégique à l'Assistant IA",
            action: "Dialoguez avec votre conseiller financier virtuel disponible 24/7 :",
            steps: [
              "Ouvrez la page « Assistant IA » et tapez votre question (ex. « Où sont mes plus grandes fuites de rentabilité ? », « Quel est mon point mort ce mois-ci ? »).",
              "L'assistant analyse l'ensemble de votre base et répond en quelques secondes avec des données vérifiées.",
              "Badges de transparence : Chaque affirmation est certifiée (🔵 Fait vérifié dans vos données, 🟢 Calcul mathématique strict, 🟣 Déduction analytique)."
            ],
            successIndicator: "Garantie Zéro Hallucination : si une donnée n'est pas présente dans vos fichiers, l'IA vous l'indique clairement au lieu d'inventer.",
            tip: "Cliquez sur l'une des questions suggérées pour un diagnostic rapide de votre rentabilité."
          },
          {
            h: "Action 2 : Simuler une décision avant de l'appliquer dans la réalité",
            action: "Évaluez immédiatement les répercussions d'un changement de gestion :",
            steps: [
              "Accédez au « Simulateur » dans le menu latéral.",
              "Ajustez les curseurs : Hausse ou baisse des prix (+5%), Recrutement d'un nouvel employé, Réduction des dépenses d'exploitation (-10%).",
              "Visualisez instantanément l'impact comparatif Avant / Après sur votre Résultat net et votre Trésorerie à 90 jours."
            ],
            successIndicator: "Un tableau comparatif chiffre le gain net ou le risque financier en dollars CAD."
          }
        ]
      }
    ]
  },
  {
    label: "5. FAQ & Dépannage Immédiat",
    sections: [
      {
        id: "faq",
        title: "Questions Fréquentes & Solutions Rapides",
        icon: HelpCircle,
        badge: "Support",
        objective: "Résoudre instantanément les questions les plus courantes sans jargon technique.",
        content: [
          {
            h: "1. « Pourquoi un indicateur affiche-t-il Partiel ou Non mesuré ? »",
            action: "C'est la garantie d'intégrité de GESCOP :",
            steps: [
              "Explication : Si votre fichier de ventes ne contient pas le coût d'achat unitaire de chaque produit, le système refuse d'inventer une fausse marge brute.",
              "Solution : Importez votre catalogue de produits avec les prix d'achat réels. Dès l'import terminé, l'indicateur passera automatiquement en statut « Mesuré »."
            ],
            successIndicator: "Vous avez l'assurance qu'aucun chiffre de votre tableau de bord n'est inventé."
          },
          {
            h: "2. « Pourquoi mes totaux diffèrent entre le Cockpit et un rapport annuel ? »",
            action: "Comprendre le périmètre temporel sélectionné :",
            steps: [
              "Explication : Le Cockpit affiche par défaut le mois sélectionné (ex. Août 2026), tandis qu'un rapport annuel agrège les 12 mois de l'exercice.",
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
                  Guide Pratique de Pilotage
                </span>
                <span className="text-xs font-semibold text-muted-foreground">Édition 2026</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Manuel d'Utilisation GESCOP
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Pilotage Financier, Décisionnel & Opérationnel pour PME
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-border bg-background px-3 py-2 text-right">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Devise de référence</p>
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
              Prenez les devants sur votre gestion sans expertise comptable ni compétences informatiques poussées.
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/80 p-4">
            <div className="flex items-center gap-2 font-bold text-foreground mb-1">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Cohérence Temporelle</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Vos flux de rentabilité et vos soldes de trésorerie sont rigoureusement alignés sur les mêmes dates d'arrêt.
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