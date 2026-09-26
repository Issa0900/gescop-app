import React, { useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Database,
  FileSpreadsheet,
  FileText,
  Clock,
  DollarSign,
  Layers,
  Activity,
  AlertTriangle,
  Scale,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Wallet,
  Play,
  Eye,
  Building,
} from "lucide-react";

export default function Landing() {
  const [activeDemoTab, setActiveDemoTab] = useState("overview");

  const scrollToDemo = (e) => {
    e.preventDefault();
    const el = document.getElementById("demonstration");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-primary selection:text-white">
      {/* ─── Barre de navigation supérieure ─── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 group">
            <BrandLogo className="h-9 w-9 shrink-0 transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white leading-none">GESCOP</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mt-0.5">
                Pilotage et rentabilité
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#demonstration" onClick={scrollToDemo} className="hover:text-white transition-colors">
              Démonstration
            </a>
            <a href="#fonctionnalites" className="hover:text-white transition-colors">
              Fonctionnalités
            </a>
            <a href="#comparatif" className="hover:text-white transition-colors">
              Pourquoi GESCOP
            </a>
            <Link to="/tarifs" className="hover:text-white transition-colors">
              Tarifs
            </Link>
            <Link to="/manuel" className="hover:text-white transition-colors">
              Guide d'utilisation
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800">
                Se connecter
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/25">
                Démarrer l'essai
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Section Héro : Compréhension immédiate (5 secondes) ─── */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
        {/* Halos lumineux de fond */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-[600px] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          {/* Badge haut de page */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-3.5 py-1.5 text-xs font-semibold text-slate-300 shadow-sm mb-6">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            La tour de contrôle financière et décisionnelle des PME
          </div>

          {/* Proposition de valeur directe */}
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white leading-[1.15]">
            Sachez exactement ce que votre entreprise gagne,{" "}
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
              où va votre trésorerie
            </span>{" "}
            et quelles décisions prendre.
          </h1>

          {/* Sous-titre opérationnel sans jargon */}
          <p className="mx-auto mt-6 max-w-3xl text-base sm:text-xl text-slate-300 leading-relaxed font-normal">
            GESCOP centralise vos ventes, vos dépenses, vos relevés bancaires et votre paie. En un seul coup d'œil,
            notre moteur croise vos chiffres réels pour révéler votre marge nette exacte, stopper les fuites financières
            et guider vos choix de gestion — sans aucun tableau Excel compliqué.
          </p>

          {/* Boutons d'action */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base bg-primary hover:bg-primary/90 text-white font-bold shadow-xl shadow-primary/30">
                Ouvrir mon tableau de bord
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#demonstration" onClick={scrollToDemo} className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200">
                <Eye className="mr-2 h-5 w-5 text-sky-400" />
                Consulter la démonstration
              </Button>
            </a>
          </div>

          {/* Éléments de réassurance */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Aucune carte bancaire requise</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>Données hébergées au Canada (Loi 25)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>Opérationnel en 5 minutes</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Espace de Démonstration Interactive ─── */}
      <section id="demonstration" className="scroll-mt-20 border-t border-slate-800 bg-slate-900/70 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-400">
              <Eye className="h-3.5 w-3.5" /> Démonstration interactive
            </span>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              Explorez la plateforme comme si vous y étiez
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Cliquez sur les onglets ci-dessous pour découvrir comment GESCOP restitue vos données financières en direct.
            </p>
          </div>

          {/* Sélecteur d'écrans de démonstration */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {[
              { id: "overview", label: "1. Tableau de bord", icon: BarChart3 },
              { id: "cashflow", label: "2. Trésorerie & Banque", icon: Wallet },
              { id: "audit", label: "3. Détection des écarts", icon: AlertTriangle },
              { id: "reports", label: "4. Rapports de gestion", icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeDemoTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDemoTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                    active
                      ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Écran interactif simulé */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 sm:p-6 shadow-2xl">
            {/* Vue 1 : Tableau de bord */}
            {activeDemoTab === "overview" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white">Vue d'ensemble · Nordik Plein Air</h3>
                    <p className="text-xs text-slate-400">Dernier mois complet rapproché · Données réelles vérifiées</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    Santé financière : 96 %
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <p className="text-xs text-slate-400">Chiffre d'affaires net</p>
                    <p className="text-xl font-bold text-white mt-1">184 320 $</p>
                    <p className="text-[11px] text-emerald-400 font-medium mt-1">+14,2 % vs mois préc.</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <p className="text-xs text-slate-400">Marge nette réelle</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">22,8 %</p>
                    <p className="text-[11px] text-slate-400 mt-1">42 025 $ de résultat net</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <p className="text-xs text-slate-400">Masse salariale / CA</p>
                    <p className="text-xl font-bold text-sky-400 mt-1">28,4 %</p>
                    <p className="text-[11px] text-slate-400 mt-1">Dans la cible sectorielle</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <p className="text-xs text-slate-400">Solde de clôture banque</p>
                    <p className="text-xl font-bold text-white mt-1">312 450 $</p>
                    <p className="text-[11px] text-emerald-400 font-medium mt-1">100 % rapproché</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300">
                  <p className="font-semibold text-white mb-1">Lecture directe pour le dirigeant :</p>
                  La rentabilité est saine ce mois-ci. Les charges d'exploitation et la masse salariale restent maîtrisées par rapport au volume d'activité. La trésorerie nette progresse de +18 400 $ sur la période.
                </div>
              </div>
            )}

            {/* Vue 2 : Trésorerie & Banque */}
            {activeDemoTab === "cashflow" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white">Rapprochement bancaire & Piste de trésorerie</h3>
                    <p className="text-xs text-slate-400">Relevés bancaires confrontés aux flux d'exploitation</p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
                    Runway : 8,4 mois
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <p className="text-xs text-slate-400">Entrées bancaires</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">+192 100 $</p>
                    <p className="text-[11px] text-slate-400 mt-1">Encaissements clients effectifs</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <p className="text-xs text-slate-400">Sorties décaissées</p>
                    <p className="text-xl font-bold text-rose-400 mt-1">-173 700 $</p>
                    <p className="text-[11px] text-slate-400 mt-1">Fournisseurs, salaires et taxes</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <p className="text-xs text-slate-400">Variation nette de cash</p>
                    <p className="text-xl font-bold text-white mt-1">+18 400 $</p>
                    <p className="text-[11px] text-emerald-400 font-medium mt-1">Flux d'exploitation positif</p>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-900/30 bg-blue-950/20 p-4 text-xs text-blue-200">
                  <p className="font-semibold text-blue-100 mb-1">Garantie mathématique :</p>
                  Aucune estimation au doigt mouillé. Chaque encaissement est rapproché d'une commande client, et chaque décaissement correspond à une facture fournisseur ou à une fiche de paie.
                </div>
              </div>
            )}

            {/* Vue 3 : Détection des écarts */}
            {activeDemoTab === "audit" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white">Détection automatique des écarts et fuites de marge</h3>
                    <p className="text-xs text-slate-400">Confrontation impartiale entre vos différents fichiers</p>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
                    2 anomalies décelées
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3.5 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-rose-300">Sur-attribution publicitaire constatée</p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Vos régies marketing déclarent 45 000 $ de ventes alors que vos encaissements réels sur ce canal ne totalisent que 21 000 $.
                      </p>
                      <p className="text-[11px] text-rose-400 font-medium mt-1">
                        Conseil : réallouer le budget sur les canaux dont les encaissements bancaires sont confirmés.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3.5 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-300">Facture fournisseur en double détection</p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Deux paiements identiques de 1 450 $ ont été enregistrés à 3 jours d'intervalle pour le fournisseur "Transport Rapide".
                      </p>
                      <p className="text-[11px] text-amber-400 font-medium mt-1">
                        Ligne mise en quarantaine pour vérification avant clôture.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vue 4 : Rapports de gestion */}
            {activeDemoTab === "reports" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white">Rapports prêts à décider en 1 clic</h3>
                    <p className="text-xs text-slate-400">Exportables immédiatement en PDF, Excel et diaporama de direction</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    Format Exécutif
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 space-y-3">
                  <div className="flex items-center justify-between font-semibold text-white border-b border-slate-800 pb-2">
                    <span>Rapport Mensuel · Août 2026</span>
                    <span className="text-primary font-mono text-[11px]">PDF / PPTX / CSV</span>
                  </div>
                  <p>
                    <strong>Synthèse pour le conseil de direction :</strong> Chiffre d'affaires de 184 320 $, marge brute à 48,2 %, résultat net à 22,8 % et trésorerie finale de 312 450 $. Les 3 leviers de croissance recommandés pour septembre sont identifiés et chiffrés.
                  </p>
                </div>
              </div>
            )}

            {/* Bouton d'accès direct sous la démo */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <span>Vous souhaitez tester avec vos propres fichiers ?</span>
              <Link to="/register">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-semibold">
                  Ouvrir un compte d'essai immédiat (14 jours gratuits)
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Ce que GESCOP centralise et calcule (Caractéristiques) ─── */}
      <section className="py-20 border-t border-slate-850 bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
              Le Fonctionnement au Quotidien
            </h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ce que GESCOP centralise et calcule pour vous
            </p>
            <p className="mt-4 text-base text-slate-400">
              Une mécanique précise qui assemble toutes les pièces financières de votre entreprise sans saisie manuelle.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 mb-4">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Import Universel</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Déposez vos fichiers Excel, CSV, relevés bancaires en PDF ou factures. GESCOP reconnaît automatiquement les colonnes et normalise les devises.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-4">
                <Scale className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">14 Indicateurs Clés</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Calcul en continu du chiffre d'affaires hors taxes, des marges brute et nette, de l'EBITDA, de la rotation des stocks et du seuil de rentabilité.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 mb-4">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Rapprochement Croisé</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Le système confronte en permanence ce qui est facturé avec ce qui est encaissé, et rapproche votre masse salariale de vos ventes réelles.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 mb-4">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Rapports Automatisés</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Édition instantanée de synthèses quotidiennes, hebdomadaires et mensuelles en un clic, prêtes pour vos associés et investisseurs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pourquoi les méthodes traditionnelles ne suffisent plus (Avantages) ─── */}
      <section id="comparatif" className="py-20 border-t border-slate-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">Pourquoi GESCOP</h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">
              Pourquoi les tableurs et les bilans tardifs ne suffisent plus
            </p>
            <p className="mt-3 text-slate-400 text-sm max-w-2xl mx-auto">
              Le pilotage d'une PME exige des chiffres frais et cohérents, pas des bilans comptables livrés des mois après la clôture.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
              {/* Sans GESCOP */}
              <div className="p-6 sm:p-8 bg-red-950/10">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-lg mb-6">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sans GESCOP (Gestion traditionnelle)</span>
                </div>
                <ul className="space-y-4 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="text-rose-400 font-bold mt-0.5">✕</span>
                    <span>Des dizaines de fichiers Excel éparpillés, souvent désynchronisés ou avec des formules corrompues.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-400 font-bold mt-0.5">✕</span>
                    <span>Découverte de la marge nette plusieurs mois en retard lors de la remise du bilan comptable.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-400 font-bold mt-0.5">✕</span>
                    <span>Les plateformes marketing s'attribuent des ventes qui ne se retrouvent pas sur le compte bancaire.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-400 font-bold mt-0.5">✕</span>
                    <span>Stress permanent lors des échéances de paie et visibilité nulle sur la fin du mois.</span>
                  </li>
                </ul>
              </div>

              {/* Avec GESCOP */}
              <div className="p-6 sm:p-8 bg-emerald-950/10">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg mb-6">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Avec GESCOP (Pilotage et rentabilité)</span>
                </div>
                <ul className="space-y-4 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Toutes vos sources de données unifiées dans un modèle centralisé et auditable.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Visibilité en direct chaque semaine sur vos marges réelles et l'évolution de vos charges.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Rapprochement impartial entre dépenses engagées et rentrées d'argent effectives en banque.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Visibilité à 30, 60 et 90 jours sur votre trésorerie pour anticiper en toute quiétude.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Ce que vous y gagnez (Bénéfices) ─── */}
      <section className="py-20 border-t border-slate-800 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
              Bénéfices Concrets
            </h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ce que cela change pour vous et vos marges
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8">
              <div className="text-3xl font-extrabold text-primary mb-2">10 à 15 h</div>
              <h3 className="text-lg font-bold text-white">Temps libéré chaque semaine</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Fini les samedis soirs passés à réconcilier des feuilles de calcul. Tout est synchronisé et prêt dès le lundi matin.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8">
              <div className="text-3xl font-extrabold text-emerald-400 mb-2">+100 %</div>
              <h3 className="text-lg font-bold text-white">Certitude sur vos marges</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Vous connaissez exactement le profit généré par chaque vente, chaque canal et chaque département, au dollar près.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8">
              <div className="text-3xl font-extrabold text-sky-400 mb-2">0 surprise</div>
              <h3 className="text-lg font-bold text-white">Sérénité de trésorerie</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Chaque tension de trésorerie est décelée plusieurs semaines à l'avance pour vous permettre de réagir avant l'échéance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Modules Opérationnels ─── */}
      <section id="fonctionnalites" className="py-20 border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">Modules Opérationnels</h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Une suite complète pour la gestion financière des PME
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition-colors">
              <BarChart3 className="h-7 w-7 text-primary mb-4" />
              <h3 className="text-lg font-bold text-white">Tableau de bord financier</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Suivi en temps réel des ventes, de la marge brute, de la marge nette et du seuil de rentabilité de l'entreprise.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition-colors">
              <Activity className="h-7 w-7 text-emerald-400 mb-4" />
              <h3 className="text-lg font-bold text-white">Trésorerie & Flux réels</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Réconciliation automatique de vos encaissements et décaissements bancaires pour connaître votre marge de manœuvre.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition-colors">
              <Layers className="h-7 w-7 text-sky-400 mb-4" />
              <h3 className="text-lg font-bold text-white">Ressources Humaines & Paie</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Contrôle du ratio masse salariale / chiffre d'affaires et détection des écarts de rémunération ou d'heures non déclarées.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition-colors">
              <FileSpreadsheet className="h-7 w-7 text-amber-400 mb-4" />
              <h3 className="text-lg font-bold text-white">Gestion des Stocks & Produits</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Calcul précis de la rotation des stocks, identification des articles dormants et rentabilité par ligne de produit.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition-colors">
              <FileText className="h-7 w-7 text-rose-400 mb-4" />
              <h3 className="text-lg font-bold text-white">Générateur de Rapports 1-Clic</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Exportations immédiates au format exécutif pour vos assemblées, vos créanciers ou vos réunions de direction hebdomadaires.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition-colors">
              <ShieldCheck className="h-7 w-7 text-indigo-400 mb-4" />
              <h3 className="text-lg font-bold text-white">Audit & Détection d'erreurs</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Vérification continue de l'intégrité de vos pièces comptables et mise en quarantaine des lignes incohérentes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Sécurité & Loi 25 (Canada) ─── */}
      <section className="py-16 border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-400 mb-4" />
          <h2 className="text-2xl font-bold text-white">Sécurité de calibre bancaire et conformité Loi 25</h2>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed max-w-2xl mx-auto">
            Vos données financières, vos fiches de paie et vos transactions sont hébergées exclusivement sur des serveurs
            sécurisés au Canada. Elles vous appartiennent en totalité, ne sont jamais partagées à des tiers et peuvent être
            intégralement purgées sur simple demande.
          </p>
          <div className="mt-6">
            <Link to="/politique-confidentialite" className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium">
              Lire notre engagement de confidentialité et gouvernance des données
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Appel à l'action final (CTA) ─── */}
      <section className="relative overflow-hidden py-20 border-t border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Prêt à reprendre les commandes de votre rentabilité ?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
            Importez vos premiers fichiers en 2 minutes et découvrez vos marges exactes dès aujourd'hui.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base bg-primary hover:bg-primary/90 text-white font-bold shadow-xl shadow-primary/30">
                Démarrer sans engagement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200">
                Se connecter à mon compte
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Activation instantanée · Aucune installation requise · Support basé au Canada
          </p>
        </div>
      </section>

      {/* ─── Pied de page ─── */}
      <footer className="border-t border-slate-900 bg-slate-950 py-10 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-6 w-6 shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold text-white text-xs">GESCOP</span>
              <span className="text-[10px] text-slate-400">Pilotage et rentabilité</span>
            </div>
            <span className="ml-2 text-slate-600">· © {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/tarifs" className="hover:text-slate-300 transition-colors">
              Tarifs
            </Link>
            <Link to="/manuel" className="hover:text-slate-300 transition-colors">
              Guide d'utilisation
            </Link>
            <Link to="/politique-confidentialite" className="hover:text-slate-300 transition-colors">
              Confidentialité (Loi 25)
            </Link>
            <Link to="/login" className="hover:text-slate-300 transition-colors">
              Connexion
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
