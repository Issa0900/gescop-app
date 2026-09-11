import React, { useState, useEffect } from "react";
import { Book, ChevronDown, ChevronRight, Lightbulb, Upload, LayoutDashboard, BarChart3, AlertTriangle, ShieldAlert, Radar as RadarIcon, CheckSquare, Bell, FileText, MessageSquare, Settings, Sparkles, Rocket, Brain, TrendingUp, Calculator, Target, History } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    id: "demarrage",
    title: "Démarrage rapide",
    icon: Rocket,
    content: [
      { h: "Bienvenue dans GESCOP", p: "GESCOP est un système intelligent tout-en-un pour le pilotage, l'anticipation et l'aide à la décision stratégique destiné aux PME. Il centralise vos données financières, détecte automatiquement les signaux faibles, et produit des recommandations actionnables." },
      { h: "Première utilisation", p: "Au premier accès, l'assistant d'onboarding vous guide en trois étapes : identité de l'entreprise, activité & clientèle, puis objectifs stratégiques. Vous pouvez renseigner l'URL de votre site web et cliquer sur « Auto-remplir » pour pré-remplir automatiquement les champs à partir des informations publiques." },
      { h: "Le flux de travail recommandé", p: "1. Configurez votre entreprise (onboarding) → 2. Importez vos données financières → 3. Lancez l'analyse IA depuis le tableau de bord → 4. Consultez les anomalies, risques et recommandations → 5. Convertissez les recommandations en tâches → 6. Générez un rapport." },
    ],
  },
  {
    id: "onboarding",
    title: "Configuration de l'entreprise",
    icon: Sparkles,
    content: [
      { h: "Étape 1 — Identité", p: "Renseignez le nom, le secteur, la localisation, le nombre d'employés et le chiffre d'affaires. Le champ « Site web » permet l'enrichissement automatique : entrez l'URL puis cliquez sur « Auto-remplir » pour extraire les informations publiques de votre entreprise." },
      { h: "Étape 2 — Activité & clientèle", p: "Décrivez votre modèle d'affaires, vos produits, services et clientèle. Sélectionnez les outils que vous utilisez déjà (Excel, QuickBooks, Shopify, etc.) en cliquant sur les tuiles correspondantes." },
      { h: "Étape 3 — Objectifs", p: "Choisissez vos objectifs stratégiques. Ces objectifs orientent les recommandations produites par le moteur d'analyse IA — plus ils sont précis, plus les recommandations sont pertinentes." },
    ],
  },
  {
    id: "import",
    title: "Import de données",
    icon: Upload,
    content: [
      { h: "Formats supportés", p: "GESCOP accepte les fichiers CSV, Excel (.xlsx, .xls), TSV et PDF. Pour les fichiers CSV et Excel, chaque ligne doit représenter une transaction avec au minimum : date, montant, et type (income/expense)." },
      { h: "Colonnes reconnues", p: "Le système reconnaît automatiquement : date, description, amount (montant), type (income/expense), category (catégorie), client, et product. Les en-têtes en français ou en anglais sont acceptés." },
      { h: "Qualité des données", p: "Après l'import, un score de qualité est calculé. Les lignes problématiques sont mises en quarantaine plutôt que rejetées — vous pouvez les corriger ou les ignorer. L'historique des imports reste consultable avec le nombre de lignes traitées et le score." },
      { h: "Bilan guidé", p: "Après l'import, un bilan s'affiche : nombre de lignes reçues, transactions importées, score de qualité, et lignes en quarantaine. Un bouton vous mène directement à l'analyse IA pour exploiter vos données." },
      { h: "Astuce", p: "Pour de meilleurs résultats d'analyse, importez au minimum 3 mois de données. L'IA a besoin d'un historique suffisant pour détecter des tendances et des anomalies fiables." },
    ],
  },
  {
    id: "dashboard",
    title: "Tableau de bord",
    icon: LayoutDashboard,
    content: [
      { h: "Vue d'ensemble", p: "Le tableau de bord est la page d'accueil. Il présente le score de santé global de l'entreprise (jauge), les statistiques financières clés, et les scores par dimension (finance, ventes, opérations, marketing)." },
      { h: "Lancer l'analyse IA", p: "Le bouton « Analyser » déclenche le moteur d'analyse qui examine vos transactions, détecte les anomalies, évalue les risques, identifie les opportunités et génère des recommandations. Cette opération peut prendre quelques secondes." },
      { h: "Sections affichées", p: "Après analyse, le tableau de bord affiche : les anomalies détectées (triées par sévérité), les risques actifs (triés par score), et les recommandations prioritaires. Chaque section renvoie vers sa page dédiée pour le détail." },
    ],
  },
  {
    id: "kpis",
    title: "Indicateurs clés (KPI)",
    icon: BarChart3,
    content: [
      { h: "KPI par domaine", p: "Les indicateurs sont organisés en quatre domaines : finance, ventes, opérations et marketing. Chaque KPI affiche sa valeur actuelle, sa cible, sa valeur précédente et sa tendance (↑ ↓ →)." },
      { h: "Évolution mensuelle", p: "Un graphique montre l'évolution mensuelle des revenus et des dépenses, permettant de visualiser les tendances saisonnières et la trajectoire financière." },
      { h: "Barres de progression", p: "Chaque KPI est accompagné d'une barre de progression qui compare la valeur actuelle à la cible définie, vous indiquant d'un coup d'œil si vous êtes sur la bonne voie." },
    ],
  },
  {
    id: "anomalies",
    title: "Anomalies",
    icon: AlertTriangle,
    content: [
      { h: "Détection automatique", p: "Le moteur d'analyse examine vos transactions et détecte les écarts anormaux : variation inhabituelle de revenus, dépense exceptionnelle, chute de marge, etc. Chaque anomalie est classée par sévérité (critique, important, modéré, faible)." },
      { h: "Explications", p: "Chaque anomalie inclut une explication contextuelle qui décrit la nature de l'écart et son ampleur (pourcentage de déviation). Cela vous aide à comprendre rapidement ce qui s'est passé." },
      { h: "Résolution", p: "Marquez une anomalie comme « résolue » une fois que vous l'avez traitée. Les anomalies résolues restent consultables dans la section inférieure pour référence." },
    ],
  },
  {
    id: "risques",
    title: "Risques & opportunités",
    icon: ShieldAlert,
    content: [
      { h: "Risques", p: "Les risques sont évalués selon leur probabilité, leur impact, leur urgence et leur confiance. Un score global permet de prioriser. Chaque risque inclut une description, une catégorie, et un horizon temporel." },
      { h: "Opportunités", p: "Les opportunités représentent des leviers de croissance identifiés par l'IA. Elles sont classées par potentiel (faible, moyen, élevé) et probabilité de réussite." },
      { h: "Conversion en tâches", p: "Pour chaque risque ou opportunité, vous pouvez créer une tâche d'action directement. Le statut du risque ou de l'opportunité est alors mis à jour pour suivre le traitement." },
    ],
  },
  {
    id: "recommandations",
    title: "Recommandations",
    icon: Lightbulb,
    content: [
      { h: "Recommandations IA", p: "Les recommandations sont générées à partir des risques, opportunités et anomalies détectés. Chacune décrit la situation, l'analyse, l'impact attendu et l'action recommandée, avec une priorité (faible à urgente)." },
      { h: "Accepter ou rejeter", p: "Vous pouvez accepter une recommandation (ce qui la convertit en tâche actionnable) ou la rejeter. Les recommandations traitées restent consultables dans la section inférieure." },
      { h: "Conversion en tâche", p: "L'acceptation d'une recommandation crée automatiquement une tâche avec sa catégorie et sa priorité, prête à être suivie dans la section Tâches." },
    ],
  },
  {
    id: "insights",
    title: "Insights",
    icon: Brain,
    content: [
      { h: "Insights structurés", p: "La page Insights présente tous les signaux détectés par l'IA dans un format structuré et uniforme : Quoi (le fait), Pourquoi (l'explication), Impact (estimation financière), et Action (ce qu'il faut faire). Chaque insight inclut un niveau de confiance et un impact financier estimé." },
      { h: "Filtrage", p: "Filtrez les insights par type (anomalie, risque, opportunité, recommandation) et par priorité. Triez par impact financier ou par confiance pour identifier rapidement les actions les plus importantes." },
      { h: "Actionnabilité", p: "Chaque insight est conçu pour être directement actionnable : l'action recommandée est spécifique et immédiate, pas théorique. L'impact financier estimé vous aide à prioriser." },
    ],
  },
  {
    id: "previsions",
    title: "Prévisions",
    icon: TrendingUp,
    content: [
      { h: "Trois axes de prévision", p: "GESCOP projette trois indicateurs clés sur 30, 60 et 90 jours : le chiffre d'affaires, la marge, et la trésorerie. Les prévisions sont basées sur les tendances de vos transactions historiques." },
      { h: "Visualisation", p: "Chaque prévision est accompagnée d'un graphique montrant la trajectoire projetée. Les intervalles de confiance vous indiquent la marge d'incertitude autour de chaque projection." },
      { h: "Anticipation", p: "Utilisez les prévisions pour anticiper les besoins de trésorerie, identifier les mois à risque, et planifier les investissements au bon moment." },
    ],
  },
  {
    id: "simulateur",
    title: "Simulateur de décisions",
    icon: Calculator,
    content: [
      { h: "Simulation « Et si ? »", p: "Le simulateur vous permet de tester l'impact financier d'une décision avant de la prendre. Ajustez les curseurs (prix, volume, coûts, délais) et voyez instantanément l'effet sur le chiffre d'affaires, la marge et la trésorerie." },
      { h: "Scénarios", p: "Testez plusieurs scénarios : augmentation de prix, réduction de coûts, investissement marketing, embauche. Comparez les résultats pour choisir la meilleure option." },
      { h: "Conversion en décision", p: "Une fois satisfait d'un scénario, convertissez-le en décision suivie dans la page Décisions pour comparer la prévision au résultat réel." },
    ],
  },
  {
    id: "historique",
    title: "Historique des analyses",
    icon: History,
    content: [
      { h: "Mémoire d'analyse", p: "Chaque analyse IA est enregistrée avec son score de santé, ses scores par dimension, et ses compteurs (anomalies, risques, opportunités, recommandations). Cette mémoire vous permet de suivre l'évolution de votre entreprise dans le temps." },
      { h: "Évolution du score", p: "Un graphique montre l'évolution de votre score de santé global sur toutes les analyses passées. Identifiez les tendances : amélioration continue, stagnation, ou dégradation." },
      { h: "Comparaison temporelle", p: "La section « Qu'est-ce qui a changé ? » compare automatiquement les deux dernières analyses et liste les améliorations et dégradations par dimension. Vous savez exactement ce qui a progressé et ce qui nécessite attention." },
    ],
  },
  {
    id: "decisions",
    title: "Décisions & apprentissage",
    icon: Target,
    content: [
      { h: "Mémoire décisionnelle", p: "La page Décisions suit le cycle complet de vos décisions : À décider → Décisions prises → Résultats. Chaque décision enregistre son impact prévu, puis son impact réel." },
      { h: "Comparaison prévision/réalité", p: "Lorsque vous ajoutez les résultats réels d'une décision, GESCOP calcule automatiquement la performance (pourcentage de l'impact prévu réellement atteint). Vous voyez d'un coup d'œil si vos décisions ont eu l'effet espéré." },
      { h: "Apprentissage", p: "Les statistiques de précision (précision moyenne, nombre de décisions suivies, prévisions trop optimistes) vous aident à calibrer vos futures prévisions. GESCOP apprend de vos écarts pour améliorer la qualité de ses recommandations." },
    ],
  },
  {
    id: "radar",
    title: "Radar externe",
    icon: RadarIcon,
    content: [
      { h: "Signaux externes", p: "Le radar surveille l'environnement externe de votre entreprise : signaux gouvernementaux, économiques, de marché, de concurrence, fournisseurs, consommateurs et actualités. Chaque signal est évalué pour sa pertinence et son impact (positif, neutre, négatif)." },
      { h: "Pourquoi cela vous concerne", p: "Les 3 signaux les plus pertinents sont mis en avant avec une explication personnalisée : pourquoi ce signal concerne spécifiquement votre entreprise (lien avec votre secteur, vos produits, votre clientèle), et une action concrète recommandée pour y répondre." },
      { h: "Familles de signaux", p: "Les signaux restants sont organisés par famille pour faciliter la lecture. Vous pouvez consulter la source et l'URL de chaque signal pour approfondir." },
      { h: "Gestion", p: "Marquez les signaux comme « vus » ou « archivés » selon leur pertinence pour votre activité." },
    ],
  },
  {
    id: "taches",
    title: "Tâches",
    icon: CheckSquare,
    content: [
      { h: "Suivi des actions", p: "La section Tâches centralise toutes les actions issues des recommandations, risques et opportunités que vous avez convertis. Chaque tâche a une catégorie, une priorité, une échéance et un responsable." },
      { h: "Statuts", p: "Les tâches passent par quatre statuts : à faire, en cours, terminée, annulée. Mettez à jour le statut au fur et à mesure de votre progression." },
      { h: "Catégories", p: "Les catégories incluent : urgent, financier, commercial, marketing, opérationnel, administratif et stratégique — pour organiser votre plan d'action." },
    ],
  },
  {
    id: "alertes",
    title: "Alertes",
    icon: Bell,
    content: [
      { h: "Centre de notifications", p: "Les alertes vous informent des événements importants détectés par le système : anomalie critique, risque élevé, échéance de tâche, etc. Elles sont classées par niveau (critique, important, modéré, info, faible)." },
      { h: "Lien direct", p: "Chaque alerte peut être liée à un élément spécifique (risque, anomalie, recommandation) — cliquez pour accéder directement à l'élément concerné." },
      { h: "Marquer comme lue", p: "Une fois consultée, marquez l'alerte comme lue pour garder votre centre de notifications propre. Les alertes archivées restent accessibles." },
    ],
  },
  {
    id: "rapports",
    title: "Rapports",
    icon: FileText,
    content: [
      { h: "Génération de rapports", p: "GESCOP produit trois types de rapports : quotidien, hebdomadaire et mensuel. Chaque rapport synthétise l'état de votre entreprise sur la période concernée : santé globale, anomalies, risques, recommandations et actions." },
      { h: "Contenu", p: "Les rapports sont au format texte enrichi et incluent un résumé exécutif, les indicateurs clés, les points d'attention et les actions prioritaires. Ils sont consultables directement dans l'application." },
      { h: "Historique", p: "Tous les rapports générés sont conservés et consultables dans l'historique. Vous pouvez les supprimer si nécessaire." },
    ],
  },
  {
    id: "assistant",
    title: "Assistant IA",
    icon: MessageSquare,
    content: [
      { h: "Conversation naturelle", p: "L'Assistant IA répond à vos questions sur votre entreprise en langage naturel. Posez des questions comme « Quelle est ma situation financière ? », « Quels sont mes principaux risques ? » ou « Que dois-je faire en priorité ? »." },
      { h: "Contexte intégré", p: "L'assistant a accès à l'ensemble de vos données : profil d'entreprise, transactions, KPI, anomalies, risques, opportunités et recommandations. Ses réponses sont donc personnalisées à votre situation." },
      { h: "Citations des sources", p: "Chaque réponse de l'assistant indique les sources utilisées (données financières, anomalies détectées, KPI, etc.) avec la période et le volume de données. Vous savez toujours sur quelle base l'IA a répondu, ce qui renforce la confiance dans les recommandations." },
      { h: "Conseils d'utilisation", p: "Pour des réponses précises, posez des questions spécifiques. L'assistant peut vous aider à interpréter les données, suggérer des actions, ou expliquer une anomalie détectée." },
    ],
  },
  {
    id: "parametres",
    title: "Paramètres",
    icon: Settings,
    content: [
      { h: "Profil de l'entreprise", p: "Modifiez à tout moment les informations de votre entreprise : nom, secteur, localisation, modèle d'affaires, produits, services, clientèle et outils. Ces informations influencent l'analyse." },
      { h: "Objectifs", p: "Ajustez vos objectifs stratégiques quand votre situation évolue. Les nouveaux objectifs seront pris en compte lors de la prochaine analyse IA." },
      { h: "Sécurité & conformité", p: "Vos données sont hébergées au Canada, conformes à la Loi 25 (protection des renseignements personnels, Québec), chiffrées au repos et en transit, et isolées par organisation — elles ne sont jamais partagées." },
    ],
  },
];

export default function Manuel() {
  const [activeSection, setActiveSection] = useState("demarrage");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const el = document.getElementById(`section-${activeSection}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeSection]);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar nav */}
      <aside className="lg:w-64 shrink-0">
        <div className="lg:sticky lg:top-6">
          <div className="mb-4 flex items-center gap-2">
            <Book className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Manuel utilisateur</h1>
          </div>
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="mb-2 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium lg:hidden"
          >
            {sections.find((s) => s.id === activeSection)?.title}
            <ChevronDown className={cn("h-4 w-4 transition-transform", mobileNavOpen && "rotate-180")} />
          </button>
          <nav className={cn("space-y-0.5", mobileNavOpen ? "block" : "hidden lg:block")}>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSection(s.id);
                  setMobileNavOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  activeSection === s.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.title}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1 max-w-3xl">
        {sections.map((s) => (
          <section
            key={s.id}
            id={`section-${s.id}`}
            className={cn(
              "scroll-mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8",
              s.id !== sections[0].id && "mt-6"
            )}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">{s.title}</h2>
            </div>
            <div className="space-y-5">
              {s.content.map((block, i) => (
                <div key={i}>
                  <h3 className="mb-1.5 text-sm font-semibold text-foreground">{block.h}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{block.p}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Besoin d'aide supplémentaire ? Utilisez l'Assistant IA dans le menu latéral pour poser vos questions.
          </p>
        </div>
      </div>
    </div>
  );
}