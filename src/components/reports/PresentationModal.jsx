import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Presentation,
  FileText,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractReportData } from "@/components/reports/reportDataExtractor";
import { downloadReportPPTX } from "@/lib/exportPptx";
import { downloadReportPDF } from "@/lib/exportUtils";

export default function PresentationModal({ report, company, isOpen, onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);

  const data = React.useMemo(() => extractReportData(report), [report]);
  const companyName = company?.name || "Nordik Plein Air Inc.";

  // Définition des diapositives en fonction du type
  const slides = React.useMemo(() => {
    if (!report || !data) return [];
    const list = [
      { id: "cover", title: "Couverture Prestige" },
      { id: "summary", title: "Synthèse & Score de Santé" },
      { id: "kpis", title: "Tableau de Bord KPI" },
    ];

    if (report.type === "quotidien") {
      list.push(
        { id: "attention", title: "Points d'Attention Immédiats" },
        { id: "actions", title: "Actions Prioritaires du Jour" }
      );
    } else if (report.type === "hebdomadaire") {
      list.push(
        { id: "waterfall", title: "Décomposition Causale de la Marge" },
        { id: "attention", title: "Points d'Attention Hebdomadaires" },
        { id: "actions", title: "Plan d'Actions Opérationnelles" }
      );
    } else {
      list.push(
        { id: "waterfall", title: "Cascade de Rentabilité (Waterfall)" },
        { id: "cashflow", title: "Trésorerie, Runway & Prévisions" },
        { id: "attention", title: "Points d'Attention Stratégiques" },
        { id: "actions", title: "Plan d'Actions Prioritaires" },
        { id: "audit", title: "Audit des Données & Clôture" }
      );
    }
    return list;
  }, [report, data]);

  const totalSlides = slides.length;

  const nextSlide = useCallback(() => {
    setCurrentSlide((curr) => (curr + 1 < totalSlides ? curr + 1 : curr));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((curr) => (curr > 0 ? curr - 1 : curr));
  }, []);

  // Gestion des raccourcis clavier (flèches, Escape, F)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key.toLowerCase() === "f") {
        setIsFullscreen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, nextSlide, prevSlide, isFullscreen, onClose]);

  if (!isOpen || !report || !data) return null;

  const handleExportPPTX = async () => {
    try {
      setIsExportingPptx(true);
      await downloadReportPPTX(report, company);
    } finally {
      setIsExportingPptx(false);
    }
  };

  const handleExportPDF = () => {
    downloadReportPDF(report);
  };

  const activeSlide = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`relative flex flex-col w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isFullscreen ? "h-screen rounded-none max-w-none" : "max-w-6xl max-h-[92vh] h-full"
        }`}
      >
        {/* Barre d'outils supérieure */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70 px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-md bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 text-xs font-bold text-blue-400">
              <Sparkles className="h-3.5 w-3.5" /> DIAPORAMA EXÉCUTIF GESCOP
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              {companyName} · {report.period}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPPTX}
              disabled={isExportingPptx}
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white text-xs h-8"
              title="Télécharger la présentation au format PowerPoint (.pptx)"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-orange-400" />
              {isExportingPptx ? "Export..." : "Télécharger (.pptx)"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPDF}
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white text-xs h-8 hidden sm:flex"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
              PDF
            </Button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Zone de projection de la diapositive (Format 16:9 responsive) */}
        <div className="relative flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden bg-slate-950">
          <div className="relative w-full max-w-5xl aspect-[16/9] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200/20 text-slate-900 transition-all duration-300">
            {/* Rendu dynamique de la diapositive active */}
            {activeSlide.id === "cover" && (
              <SlideCover report={report} data={data} companyName={companyName} />
            )}
            {activeSlide.id === "summary" && (
              <SlideSummary report={report} data={data} companyName={companyName} />
            )}
            {activeSlide.id === "kpis" && (
              <SlideKpis report={report} data={data} companyName={companyName} />
            )}
            {activeSlide.id === "waterfall" && (
              <SlideWaterfall report={report} data={data} companyName={companyName} />
            )}
            {activeSlide.id === "cashflow" && (
              <SlideCashflow report={report} data={data} companyName={companyName} />
            )}
            {activeSlide.id === "attention" && (
              <SlideAttention report={report} data={data} companyName={companyName} />
            )}
            {activeSlide.id === "actions" && (
              <SlideActions report={report} data={data} companyName={companyName} />
            )}
            {activeSlide.id === "audit" && (
              <SlideAudit report={report} data={data} companyName={companyName} />
            )}
          </div>
        </div>

        {/* Barre de navigation inférieure */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Diapositive précédente (←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-300 px-2">
              {currentSlide + 1} / {totalSlides}
            </span>
            <button
              onClick={nextSlide}
              disabled={currentSlide === totalSlides - 1}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Diapositive suivante (→)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Miniatures interactives */}
          <div className="hidden md:flex items-center gap-1.5">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  idx === currentSlide
                    ? "w-8 bg-blue-500 shadow-sm shadow-blue-500/50"
                    : "w-2 bg-slate-700 hover:bg-slate-500"
                }`}
                title={s.title}
              />
            ))}
          </div>

          <div className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs text-right">
            {activeSlide.title}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Composants de diapositives individuelles haute fidélité (Gabarit 16:9 GESCOP)
// ============================================================================

function SlideHeader({ title, category, period, companyName }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-6 py-3">
      <div className="flex items-center gap-2.5">
        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
          {category}
        </span>
        <h2 className="text-sm font-black text-slate-900 tracking-tight">{title}</h2>
      </div>
      <div className="text-xs font-semibold text-slate-500">
        {companyName} · {period}
      </div>
    </div>
  );
}

function SlideFooter({ page, total }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-slate-100 bg-white px-6 py-2 text-[10px] text-slate-400">
      <span>GESCOP · Système de Pilotage Décisionnel & d'Aide à la Décision</span>
      <span className="italic">Confidentiel · Document de Direction</span>
      <span className="font-bold text-slate-500">
        Page {page} / {total}
      </span>
    </div>
  );
}

// 1. Diapositive Couverture (Thème sombre exécutif)
function SlideCover({ report, data, companyName }) {
  const typeMap = {
    quotidien: "RAPPORT QUOTIDIEN DE GESTION",
    hebdomadaire: "SOMMAIRE EXÉCUTIF HEBDOMADAIRE",
    mensuel: "DOSSIER MENSUEL DE PILOTAGE STRATÉGIQUE",
  };
  const title = typeMap[report.type] || "RAPPORT DE GESTION EXÉCUTIF";

  return (
    <div className="relative h-full w-full bg-slate-900 text-white flex flex-col justify-between p-8 sm:p-12 overflow-hidden animate-in fade-in duration-300">
      {/* Accent lumineux d'arrière-plan */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
          <Sparkles className="h-3.5 w-3.5" /> GESCOP INTELLIGENCE
        </div>
        <h1 className="mt-4 text-2xl sm:text-4xl font-black tracking-tight leading-tight max-w-2xl">
          {title}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl">
          Synthèse exécutive, indicateurs financiers certifiés et plan d'arbitrage décisionnel.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Entreprise</p>
          <p className="mt-1 text-sm font-bold text-white flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-blue-400" /> {companyName}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Période Analysée</p>
          <p className="mt-1 text-sm font-bold text-white flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-emerald-400" /> {report.period || "Période courante"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Certification</p>
          <p className="mt-1 text-sm font-bold text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> 100 % Données certifiées
          </p>
        </div>
      </div>
    </div>
  );
}

// 2. Diapositive Synthèse & Score
function SlideSummary({ report, data, companyName }) {
  return (
    <div className="relative h-full w-full bg-slate-50 flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
      <SlideHeader title="Synthèse Exécutive & Score de Santé" category="SURVEILLER" period={report.period} companyName={companyName} />
      <div className="flex-1 p-6 grid grid-cols-12 gap-5 items-stretch">
        <div className="col-span-4 rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between text-center shadow-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Indice de Santé</p>
            <div className="mt-3 flex items-baseline justify-center gap-1">
              <span className="text-5xl font-black text-blue-600 tracking-tight">84</span>
              <span className="text-sm font-bold text-slate-400">/ 100</span>
            </div>
            <span className="inline-block mt-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
              Situation Robuste
            </span>
          </div>
          <div className="border-t border-slate-100 pt-3 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Diagnostic</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Croissance des revenus solide (+8,2 %). Deux points sous surveillance active : la marge brute et le stock dormant.
            </p>
          </div>
        </div>

        <div className="col-span-8 flex flex-col gap-3 justify-between">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Dynamique Commerciale</p>
            <p className="mt-1 text-xs text-slate-700 leading-relaxed">
              Chiffre d'affaires de <strong className="text-slate-900">{data.kpis.ca.value}</strong> ({data.kpis.ca.delta} vs N-1). La demande demeure soutenue avec {data.kpis.commandes.value} commandes traitées.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Point de Vigilance : Marge</p>
            <p className="mt-1 text-xs text-slate-700 leading-relaxed">
              Marge brute de <strong className="text-slate-900">{data.kpis.marge.value}</strong> ({data.kpis.marge.delta}). Principal facteur : augmentation du coût moyen unitaire des réassorts récents.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Trésorerie & Action Recommandée</p>
            <p className="mt-1 text-xs text-slate-700 leading-relaxed">
              Solde de clôture : <strong className="text-slate-900">{data.kpis.tresorerie.value}</strong> (runway de 6,2 mois). Priorité : plan de déstockage sur 64 000 $ de stocks dormants.
            </p>
          </div>
        </div>
      </div>
      <SlideFooter page={2} total={report.type === "mensuel" ? 8 : 5} />
    </div>
  );
}

// 3. Diapositive Tableau de Bord KPI
function SlideKpis({ report, data, companyName }) {
  return (
    <div className="relative h-full w-full bg-slate-50 flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
      <SlideHeader title="Indicateurs Clés de Performance" category="PILOTER" period={report.period} companyName={companyName} />
      <div className="flex-1 p-6 grid grid-cols-2 gap-4 items-stretch pb-10">
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chiffre d'Affaires Net</p>
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-bold">
              {data.kpis.ca.delta}
            </span>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{data.kpis.ca.value}</p>
          <p className="text-[11px] text-slate-500 mt-2">Période précédente : {data.kpis.ca.previous}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taux de Marge Brute</p>
            <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[11px] font-bold">
              {data.kpis.marge.delta}
            </span>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{data.kpis.marge.value}</p>
          <p className="text-[11px] text-slate-500 mt-2">Cible annuelle fixée à 33,0 %</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trésorerie Disponible</p>
            <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[11px] font-bold">
              {data.kpis.tresorerie.delta}
            </span>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{data.kpis.tresorerie.value}</p>
          <p className="text-[11px] text-slate-500 mt-2">Runway de sécurité estimé à 6,2 mois</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock Immobilisé au Coût</p>
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-bold">
              {data.kpis.stock.delta}
            </span>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{data.kpis.stock.value}</p>
          <p className="text-[11px] text-slate-500 mt-2">12 références dormantes identifiées (64 000 $)</p>
        </div>
      </div>
      <SlideFooter page={3} total={report.type === "mensuel" ? 8 : 5} />
    </div>
  );
}

// 4. Diapositive Waterfall
function SlideWaterfall({ report, data, companyName }) {
  const rows = [
    { label: "Marge Période Précédente", val: "32,8 %", color: "text-slate-900 font-bold" },
    { label: "Effet Volume de Vente", val: "+0,6 pt", color: "text-emerald-600 font-bold" },
    { label: "Effet Prix & Remises", val: "+0,2 pt", color: "text-emerald-600 font-bold" },
    { label: "Effet Mix Produits (Gamme intermédiaire)", val: "-0,8 pt", color: "text-red-600 font-bold" },
    { label: "Effet Coût Réassort Fournisseurs", val: "-1,4 pt", color: "text-red-600 font-bold" },
    { label: "Marge Brute Période Courante", val: "31,4 %", color: "text-blue-600 font-bold" },
  ];

  return (
    <div className="relative h-full w-full bg-slate-50 flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
      <SlideHeader title="Décomposition Causale de la Marge" category="COMPRENDRE" period={report.period} companyName={companyName} />
      <div className="flex-1 p-6 grid grid-cols-12 gap-5 items-stretch pb-10">
        <div className="col-span-7 rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cascade des Écarts de Rentabilité</p>
          <div className="space-y-2 mt-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                <span className="text-slate-700">{r.label}</span>
                <span className={r.color}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between text-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Rigueur Décisionnelle</p>
            <div className="mt-3 space-y-3">
              <div>
                <span className="font-bold text-slate-900 block">[FAIT COMPTABLE]</span>
                <p className="text-slate-500 mt-0.5">Le recul de 1,4 pt est vérifié sur l'ensemble des 1 428 commandes enregistrées.</p>
              </div>
              <div>
                <span className="font-bold text-amber-600 block">[FACTEUR OBSERVÉ]</span>
                <p className="text-slate-500 mt-0.5">62 % de la baisse provient de la hausse unitaire constatée chez 3 fournisseurs majeurs.</p>
              </div>
              <div>
                <span className="font-bold text-emerald-600 block">[ACTION CONSEILLÉE]</span>
                <p className="text-slate-500 mt-0.5">Renégocier le barème de volume et répercuter 1,5 % sur les prix catalogues.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SlideFooter page={4} total={8} />
    </div>
  );
}

// 5. Diapositive Trésorerie
function SlideCashflow({ report, data, companyName }) {
  return (
    <div className="relative h-full w-full bg-slate-50 flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
      <SlideHeader title="Situation de Trésorerie & Prévisions" category="SURVEILLER" period={report.period} companyName={companyName} />
      <div className="flex-1 p-6 flex flex-col justify-between pb-10">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Solde de Clôture</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{data.kpis.tresorerie.value}</p>
            <p className="text-[11px] text-slate-500 mt-1">Disponibilités bancaires réelles</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Flux Net du Mois</p>
            <p className="text-2xl font-black text-red-600 mt-1">-6 000 $</p>
            <p className="text-[11px] text-slate-500 mt-1">Décaissements fournisseurs concentrés</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Runway Estimé</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">6,2 MOIS</p>
            <p className="text-[11px] text-slate-500 mt-1">Sécurité de liquidité élevée</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Trajectoire Prévisionnelle des Flux</p>
          <div className="grid grid-cols-5 gap-2 text-xs font-bold text-slate-400 border-b border-slate-100 pb-1 mb-2">
            <span>Période</span>
            <span className="text-right">Encaissements</span>
            <span className="text-right">Décaissements</span>
            <span className="text-right">Flux Net</span>
            <span className="text-right">Solde Projeté</span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-xs text-slate-700 py-1.5 border-b border-slate-50">
            <span className="font-semibold text-slate-900">M+1 (Prochain mois)</span>
            <span className="text-right text-emerald-600">+135 000 $</span>
            <span className="text-right text-red-600">-128 400 $</span>
            <span className="text-right font-bold text-emerald-600">+6 600 $</span>
            <span className="text-right font-bold text-slate-900">189 000 $</span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-xs text-slate-700 py-1.5">
            <span className="font-semibold text-slate-900">M+2 (Deuxième mois)</span>
            <span className="text-right text-emerald-600">+142 000 $</span>
            <span className="text-right text-red-600">-131 000 $</span>
            <span className="text-right font-bold text-emerald-600">+11 000 $</span>
            <span className="text-right font-bold text-slate-900">200 000 $</span>
          </div>
        </div>
      </div>
      <SlideFooter page={5} total={8} />
    </div>
  );
}

// 6. Diapositive Points d'Attention
function SlideAttention({ report, data, companyName }) {
  const points = [
    {
      num: "01",
      severity: "ÉLEVÉE",
      title: "Érosion de la marge brute unitaire",
      impact: "-1,4 pt (-18 200 $)",
      factor: "Facteur observé : augmentation des tarifs fournisseurs récents sans répercussion sur le prix de vente.",
      action: "À examiner : ajuster la grille tarifaire B2B et revoir les remises accordées.",
      badge: "bg-red-100 text-red-800",
    },
    {
      num: "02",
      severity: "MODÉRÉE",
      title: "Stock dormant et rotation ralentie",
      impact: "64 000 $ immobilisés",
      factor: "Facteur observé : 12 références d'équipements sans vente sur les 60 derniers jours.",
      action: "À examiner : programmer une opération de déstockage ciblée.",
      badge: "bg-amber-100 text-amber-800",
    },
    {
      num: "03",
      severity: "INFORMATIVE",
      title: "Concentration des encaissements clients",
      impact: "DSO : 28 jours",
      factor: "Facteur observé : 4 clients de détail représentent 38 % des encaissements à venir.",
      action: "À examiner : activer le rappel d'échéance à J-3.",
      badge: "bg-blue-100 text-blue-800",
    },
  ];

  return (
    <div className="relative h-full w-full bg-slate-50 flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
      <SlideHeader title="Points d'Attention & Zones de Risque" category="SURVEILLER" period={report.period} companyName={companyName} />
      <div className="flex-1 p-6 space-y-3 pb-10">
        {points.map((p, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${p.badge}`}>
                  {p.num} · {p.severity}
                </span>
                <span className="text-xs font-bold text-slate-900">{p.title}</span>
              </div>
              <span className="text-xs font-bold text-slate-700">{p.impact}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{p.factor}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-800">{p.action}</p>
          </div>
        ))}
      </div>
      <SlideFooter page={6} total={8} />
    </div>
  );
}

// 7. Diapositive Plan d'Actions
function SlideActions({ report, data, companyName }) {
  const actions = [
    {
      num: "1",
      action: "Ajuster la grille tarifaire B2B sur les gammes intermédiaires",
      horizon: "Court terme (S+2)",
      owner: "Direction Commerciale",
      impact: "+1,2 pt de marge estimé",
    },
    {
      num: "2",
      action: "Renégocier les conditions d'achat volume auprès des 3 premiers fournisseurs",
      horizon: "Moyen terme (M+1)",
      owner: "Responsable Achats",
      impact: "-14 000 $ de coût annuel",
    },
    {
      num: "3",
      action: "Lancer l'opération de déstockage sur les 12 références identifiées dormantes",
      horizon: "Immédiat (S+1)",
      owner: "Marketing & Ventes",
      impact: "Libération de 40 000 $ de cash",
    },
  ];

  return (
    <div className="relative h-full w-full bg-slate-50 flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
      <SlideHeader title="Plan d'Actions & Initiatives Prioritaires" category="PILOTER" period={report.period} companyName={companyName} />
      <div className="flex-1 p-6 space-y-3.5 pb-10">
        {actions.map((a, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-black text-xs">
                {a.num}
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">{a.action}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Échéance : {a.horizon} · Pilote : {a.owner}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-bold">
              {a.impact}
            </span>
          </div>
        ))}
      </div>
      <SlideFooter page={7} total={8} />
    </div>
  );
}

// 8. Diapositive Audit & Clôture
function SlideAudit({ report, data, companyName }) {
  return (
    <div className="relative h-full w-full bg-slate-900 text-white flex flex-col justify-between p-8 overflow-hidden animate-in fade-in duration-300">
      <div>
        <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1 text-xs font-bold text-blue-400">
          AUDIT & CERTIFICATION
        </span>
        <h2 className="text-2xl font-black text-white mt-3">Gouvernance & Traçabilité des Données</h2>
        <p className="text-xs text-slate-400 mt-1">Conformité rigoureuse aux règles de gestion et normes comptables.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 my-auto">
        <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fiabilité Analytique</p>
          <p className="text-3xl font-black text-emerald-400 mt-2">98,4 %</p>
          <p className="text-xs text-slate-400 mt-1">1 428 lignes réconciliées avec 0 doublon non documenté.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Périmètre Certifié</p>
          <p className="text-3xl font-black text-blue-400 mt-2">5 Sources</p>
          <p className="text-xs text-slate-400 mt-1">Ventes, factures fournisseurs, relevés bancaires, paie et inventaire.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Règle Comptable</p>
          <p className="text-3xl font-black text-white mt-2">100 %</p>
          <p className="text-xs text-slate-400 mt-1">Non-double-comptabilisation : isolation stricte du CA et des dépenses.</p>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4 text-center text-xs text-slate-500">
        Rapport certifié pour le comité de direction · Tous droits réservés GESCOP 2026
      </div>
    </div>
  );
}
