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
} from "lucide-react";

/**
 * Landing Page officielle de GESCOP.
 *
 * Structurée selon la méthode CAB (Caractéristiques - Avantages - Bénéfices) :
 * - Compréhension immédiate en 5 secondes chrono
 * - Zéro jargon ni vocabulaire « IA »
 * - Langage financier et opérationnel concret pour dirigeants et gestionnaires de PME
 */
export default function Landing() {
  const [activeCabTab, setActiveCabTab] = useState("all");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-primary selection:text-white">
      {/* ─── Barre de navigation supérieure ─── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 group">
            <BrandLogo className="h-9 w-9 shrink-0 transition-transform group-hover:scale-105" />
            <div>
              <span className="text-lg font-bold tracking-tight text-white">GESCOP</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-400 border-l border-slate-700 pl-2">
                Pilotage & Rentabilité PME
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#cab" className="hover:text-white transition-colors">
              La Méthode CAB
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
              Documentation
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
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
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
            et guider vos choix de gestion.
          </p>

          {/* Boutons d'action */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base bg-primary hover:bg-primary/90 text-white font-bold shadow-xl shadow-primary/30">
                Ouvrir mon tableau de bord
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200">
                Consulter la démonstration
              </Button>
            </Link>
          </div>

          {/* Éléments de réassurance */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Aucune carte bancaire requise</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>Données hébergées au Canada (Conforme Loi 25)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>Opérationnel en 5 minutes</span>
            </div>
          </div>
        </div>

        {/* ─── Aperçu de l'interface (Preuve visuelle instantanée) ─── */}
        <div className="relative mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-5 shadow-2xl backdrop-blur-xl">
            {/* Barre de contrôle factice */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-slate-500">gescop.app / tableau-de-bord</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400">
                  Rapprochement terminé · 100 % cohérent
                </span>
              </div>
            </div>

            {/* Grille de 4 indicateurs réels */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Chiffre d'affaires net</span>
                  <span className="text-emerald-400 font-semibold">+14,2 %</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-white">184 320 $</p>
                <p className="mt-1 text-[11px] text-slate-500">Factures encaissées et vérifiées</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Marge nette réelle</span>
                  <span className="text-blue-400 font-semibold">22,8 %</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-white">42 025 $</p>
                <p className="mt-1 text-[11px] text-slate-500">Après déduction charges & paie</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Trésorerie disponible</span>
                  <span className="text-emerald-400 font-semibold">Solde exact</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-white">312 450 $</p>
                <p className="mt-1 text-[11px] text-slate-500">Rapproché du relevé bancaire</p>
              </div>

              <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
                <div className="flex items-center justify-between text-xs text-amber-300">
                  <span>Point d'attention détecté</span>
                  <span className="font-semibold text-amber-400">Action requise</span>
                </div>
                <p className="mt-2 text-sm font-bold text-amber-100">
                  Écart marketing vs Ventes réelles
                </p>
                <p className="mt-1 text-[11px] text-amber-300/70">
                  Plateformes déclarant 2,4x les commandes réelles
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── La Méthode CAB (Cœur de la page) ─── */}
      <section id="cab" className="border-t border-slate-850 bg-slate-900/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
              La Clarté Absolue · Méthode CAB
            </h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ce que GESCOP fait, pourquoi c'est supérieur, et ce que vous y gagnez.
            </p>
            <p className="mt-4 text-base text-slate-400">
              Pas de théories complexes. Une solution concrète pensée pour les réalités opérationnelles des entreprises.
            </p>
          </div>

          {/* Grille CAB en 3 blocs structurés */}
          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* C — Caractéristiques */}
            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8 transition-all hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 mb-6">
                <Database className="h-6 w-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">
                <span>Pilier 1 · Caractéristiques</span>
              </div>
              <h3 className="mt-2 text-xl font-bold text-white">Ce que GESCOP fait concrètement</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Les fonctionnalités techniques qui composent le moteur de pilotage :
              </p>

              <ul className="mt-6 space-y-3.5 text-sm text-slate-300 flex-1">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Import universel multi-formats</strong> : accepte Excel, CSV, relevés bancaires PDF, export de caisse sans formatage obligatoire.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Moteur de calcul des 14 KPI fondamentaux</strong> : chiffre d'affaires net, marges, EBITDA, rotation de stock, coût salarial.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Analyse croisée multi-modules</strong> : rapprochement systématique Ventes ↔ Dépenses ↔ Banque ↔ Paie.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rapports de gestion 1-clic</strong> : bilans quotidien, hebdomadaire et mensuel générés en PDF et PowerPoint.
                  </span>
                </li>
              </ul>

              <div className="mt-6 rounded-lg bg-blue-950/30 border border-blue-900/40 p-3 text-xs text-blue-300">
                Fait vérifiable : aucun chiffre n'est inventé, chaque calcul affiche sa formule et ses pièces justificatives.
              </div>
            </div>

            {/* A — Avantages */}
            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8 transition-all hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-6">
                <Scale className="h-6 w-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <span>Pilier 2 · Avantages</span>
              </div>
              <h3 className="mt-2 text-xl font-bold text-white">Pourquoi c'est supérieur</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Ce qui différencie GESCOP des tableurs manuels et des comptabilités différées :
              </p>

              <ul className="mt-6 space-y-3.5 text-sm text-slate-300 flex-1">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Fini les erreurs de formules Excel</strong> : un cadre rigoureux où aucune cellule brisée ne fausse vos prévisions.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Pilotage en direct plutôt que bilan rétroactif</strong> : n'attendez plus 3 mois après la fin du trimestre pour découvrir vos marges.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rapprochement bancaire impartial</strong> : déjoue le double comptage des canaux marketing en ne retenant que l'argent encaissé.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Détection d'anomalies automatique</strong> : identifie doublons, factures manquantes et dérives de charges dès leur survenance.
                  </span>
                </li>
              </ul>

              <div className="mt-6 rounded-lg bg-emerald-950/30 border border-emerald-900/40 p-3 text-xs text-emerald-300">
                Avantage comparatif : vos données comptables deviennent un outil d'action au lieu d'une corvée administrative.
              </div>
            </div>

            {/* B — Bénéfices */}
            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8 transition-all hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 mb-6">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                <span>Pilier 3 · Bénéfices</span>
              </div>
              <h3 className="mt-2 text-xl font-bold text-white">Ce que vous y gagnez réellement</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                L'impact direct sur votre quotidien d'entrepreneur et la valeur de votre PME :
              </p>

              <ul className="mt-6 space-y-3.5 text-sm text-slate-300 flex-1">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Gagnez 10 à 15 heures chaque semaine</strong> : libérez-vous des compilations de tableaux le soir et le week-end.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Protégez votre trésorerie et votre marge nette</strong> : prévenez les découverts imprévus et repérez les fuites de rentabilité.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Décidez avec une certitude absolue</strong> : sachez exactement quand embaucher, quand investir ou réajuster un tarif.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Sérénité d'esprit pour le dirigeant</strong> : vous dormez mieux en sachant que vos chiffres sont surveillés et fiables.
                  </span>
                </li>
              </ul>

              <div className="mt-6 rounded-lg bg-amber-950/30 border border-amber-900/40 p-3 text-xs text-amber-300">
                Résultat final : une entreprise plus rentable, plus résiliente et un dirigeant qui reprend le plein contrôle.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Comparatif : Avant GESCOP vs Avec GESCOP ─── */}
      <section id="comparatif" className="py-20 border-t border-slate-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">Tableau Comparatif</h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">
              La différence entre naviguer à vue et piloter avec certitude
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
                    <span>Des dizaines de fichiers Excel éparpillés, souvent désynchronisés ou corrompus.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-400 font-bold mt-0.5">✕</span>
                    <span>Connaissance de la marge nette plusieurs mois en retard lors du bilan comptable.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-400 font-bold mt-0.5">✕</span>
                    <span>Les plateformes marketing s'attribuent des ventes qui n'apparaissent pas en banque.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-400 font-bold mt-0.5">✕</span>
                    <span>Stress permanent quant au solde réel de fin de mois et aux échéances de paie.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-400 font-bold mt-0.5">✕</span>
                    <span>Le dirigeant passe ses week-ends à réconcilier des colonnes au lieu de développer son chiffre.</span>
                  </li>
                </ul>
              </div>

              {/* Avec GESCOP */}
              <div className="p-6 sm:p-8 bg-emerald-950/10">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg mb-6">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Avec GESCOP (Pilotage intelligent)</span>
                </div>
                <ul className="space-y-4 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Toutes vos sources de données unifiées dans un Data Core centralisé et cohérent.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Visibilité hebdomadaire sur votre rentabilité réelle et vos charges d'exploitation.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Rapprochement strict entre dépenses publicitaires et rentrées d'argent effectives.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Piste de trésorerie claire à 30, 60 et 90 jours avec signaux d'alerte anticipés.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Des rapports clairs en un clic pour vos associés, vos directeurs et votre banquier.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Fonctionnalités Métier Essentielles ─── */}
      <section id="fonctionnalites" className="py-20 border-t border-slate-800 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">Modules Opérationnels</h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Une suite complète conçue pour la gestion des PME
            </p>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Chaque module s'articule directement avec les autres pour éliminer les angles morts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 hover:border-slate-700 transition-colors">
              <BarChart3 className="h-7 w-7 text-primary mb-4" />
              <h3 className="text-lg font-bold text-white">Tableau de bord financier</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Suivi en temps réel des ventes, de la marge brute, de la marge nette et du seuil de rentabilité de l'entreprise.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 hover:border-slate-700 transition-colors">
              <Activity className="h-7 w-7 text-emerald-400 mb-4" />
              <h3 className="text-lg font-bold text-white">Trésorerie & Flux réels</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Réconciliation automatique de vos encaissements et décaissements bancaires pour connaître votre marge de manœuvre.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 hover:border-slate-700 transition-colors">
              <Layers className="h-7 w-7 text-sky-400 mb-4" />
              <h3 className="text-lg font-bold text-white">Ressources Humaines & Paie</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Contrôle du ratio masse salariale / chiffre d'affaires et détection des écarts de rémunération ou d'heures non déclarées.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 hover:border-slate-700 transition-colors">
              <FileSpreadsheet className="h-7 w-7 text-amber-400 mb-4" />
              <h3 className="text-lg font-bold text-white">Gestion des Stocks & Produits</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Calcul précis de la rotation des stocks, identification des articles dormants et rentabilité par ligne de produit.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 hover:border-slate-700 transition-colors">
              <FileText className="h-7 w-7 text-rose-400 mb-4" />
              <h3 className="text-lg font-bold text-white">Générateur de Rapports 1-Clic</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Exportations immédiates au format exécutif pour vos assemblées, vos créanciers ou vos réunions de direction hebdomadaires.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 hover:border-slate-700 transition-colors">
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
            <span>© {new Date().getFullYear()} GESCOP. Tous droits réservés.</span>
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
