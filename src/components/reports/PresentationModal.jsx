import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, FileText, Sparkles, ArrowUpRight, ArrowDownRight, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractReportData, diapositives, PAR_DIAPOSITIVE } from "@/components/reports/reportDataExtractor";
import { downloadReportPPTX } from "@/lib/exportPptx";
import { downloadReportPDF } from "@/lib/exportUtils";

// Diaporama d'un rapport. Jusqu'au 25 sept. 2026 il projetait un dossier de
// demonstration (cascade de marge, previsions de tresorerie, plan d'action et
// « audit 98,4 % » codes en dur, nom « Nordik Plein Air Inc. » par defaut) :
// chaque diapositive est maintenant construite sur les chiffres du moteur
// stockes dans le rapport et sur le texte de l'IA, presente comme tel.

export default function PresentationModal({ report, company, isOpen, onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);

  const data = React.useMemo(() => extractReportData(report, company), [report, company]);
  const companyName = data?.companyName || "";

  // Une diapositive n'existe que si le rapport a de quoi la remplir.
  const slides = React.useMemo(() => (data ? diapositives(data) : []), [data]);

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

  const activeSlide = slides[Math.min(currentSlide, totalSlides - 1)];

  // Portail vers <body> : le visualiseur parent est anime (transform), ce qui
  // enfermait ce « fixed inset-0 » dans le bloc du rapport au lieu de l'ecran.
  return createPortal(
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
              {[companyName, data.periode?.libelle || report.period].filter(Boolean).join(" · ")}
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
          <div
            className="relative aspect-[16/9] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200/20 text-slate-900 transition-all duration-300"
            // Largeur bornee par la hauteur disponible (barres d'outils ~170 px) :
            // sinon la diapositive 16:9 depassait en bas sur un ecran 1280x720.
            style={{ width: `min(100%, 64rem, calc((${isFullscreen ? "100vh" : "92vh"} - 170px) * 16 / 9))` }}
          >
            {activeSlide && (
              <Diapositive slide={activeSlide} data={data} page={currentSlide + 1} total={totalSlides} />
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
                key={`${s.id}-${idx}`}
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
  ,
    document.body,
  );
}


const TITRES_TYPE = { quotidien: "Rapport quotidien", hebdomadaire: "Rapport hebdomadaire", mensuel: "Rapport mensuel" };

function SlideHeader({ title, data }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-6 py-3">
      <div className="flex items-center gap-2.5">
        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">{TITRES_TYPE[data.type] || "Rapport"}</span>
        <h2 className="text-sm font-black tracking-tight text-slate-900">{title}</h2>
      </div>
      <div className="text-xs font-semibold text-slate-500">{[data.companyName, data.periode?.libelle || data.period].filter(Boolean).join(" · ")}</div>
    </div>
  );
}

function SlideFooter({ page, total }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-slate-100 bg-white px-6 py-2 text-[10px] text-slate-400">
      <span>GESCOP · chiffres calculés sur vos données importées</span>
      <span className="font-bold text-slate-500">Page {page} / {total}</span>
    </div>
  );
}

function Variation({ ind }) {
  if (!ind.variationTexte) return null;
  const va = ind.variation;
  const c = va?.favorable === true ? "bg-emerald-100 text-emerald-700" : va?.favorable === false ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600";
  const I = va?.sens === "hausse" ? ArrowUpRight : va?.sens === "baisse" ? ArrowDownRight : ArrowRight;
  return <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c}`}><I className="h-3 w-3" />{ind.variationTexte}</span>;
}

function Diapositive({ slide, data, page, total }) {
  const corps = "absolute inset-x-0 top-12 bottom-8 overflow-hidden px-8 py-5";
  if (slide.id === "cover") {
    return (
      <div className="flex h-full flex-col justify-center bg-gradient-to-br from-slate-900 to-blue-900 px-12 text-white">
        <span className="text-xs font-black uppercase tracking-[0.3em] text-blue-300">GESCOP · {TITRES_TYPE[data.type] || "Rapport"}</span>
        {data.companyName && <h1 className="mt-4 text-4xl font-black tracking-tight">{data.companyName}</h1>}
        <p className="mt-3 text-xl font-semibold text-blue-100">{data.periode?.libelle || data.period}</p>
        {data.precedente?.libelle && <p className="mt-1 text-sm text-blue-200">comparé à {data.precedente.libelle}</p>}
        {data.base && <p className="mt-6 max-w-2xl text-xs text-blue-200/80">{data.base}</p>}
        {data.ancien && <p className="mt-4 max-w-2xl rounded-lg bg-amber-500/20 p-3 text-xs text-amber-100">Rapport généré avec l'ancien calcul : ses chiffres peuvent différer de la page Indicateurs.</p>}
      </div>
    );
  }
  let contenu = null;
  if (slide.id === "resume") {
    const cles = data.indicateurs.filter((i) => i.courant?.statut !== "non mesuré").slice(0, 4);
    contenu = (
      <>
        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Rédigé par l'IA à partir des chiffres du rapport</p>
        <p className="mt-2 text-base font-medium leading-relaxed text-slate-800">{data.ia.summary}</p>
        <div className="mt-6 grid grid-cols-4 gap-3">
          {cles.map((i) => (
            <div key={i.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">{i.nom}</p>
              <p className="mt-1 text-lg font-black text-slate-900">{i.valeurTexte}</p>
              <Variation ind={i} />
            </div>
          ))}
        </div>
      </>
    );
  } else if (slide.id === "indicateurs") {
    contenu = (
      <div className="grid grid-cols-3 gap-3">
        {data.indicateurs.slice(slide.debut || 0, (slide.debut || 0) + PAR_DIAPOSITIVE).map((i) => (
          <div key={i.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-1">
              <p className="text-[10px] font-bold uppercase leading-tight text-slate-500">{i.nom}</p>
              <Variation ind={i} />
            </div>
            <p className={i.courant?.statut === "non mesuré" ? "mt-1 text-sm font-semibold text-slate-400" : "mt-1 text-xl font-black text-slate-900"}>{i.valeurTexte}</p>
            {i.precedentTexte && <p className="text-[10px] text-slate-500">Précédent : {i.precedentTexte}</p>}
            {i.courant?.statut === "partiel" && <p className="text-[10px] font-bold text-amber-600">Partiel</p>}
          </div>
        ))}
      </div>
    );
  } else if (slide.id === "evolution") {
    const max = Math.max(...data.serie.map((s) => s.ca || 0), 1);
    contenu = (
      <>
        <p className="text-xs text-slate-500">Chiffre d'affaires hors taxes et taux de marge brute</p>
        <div className="mt-4 flex h-[70%] items-end gap-4">
          {data.serie.map((s, idx) => (
            <div key={s.libelle} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[11px] font-bold text-slate-700">{Number.isFinite(s.ca) ? `${new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(s.ca)} $` : "Non mesuré"}</span>
              <div style={{ height: `${Number.isFinite(s.ca) ? Math.max(2, (s.ca / max) * 100) : 0}%` }} className={`w-full max-w-[60px] rounded-t-md ${idx === data.serie.length - 1 ? "bg-blue-600" : "bg-slate-300"}`} />
              <span className="mt-1 text-center text-[10px] leading-tight text-slate-500">{s.libelle}</span>
              {Number.isFinite(s.margePct) && <span className="text-[10px] font-semibold text-slate-600">{new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 }).format(s.margePct)} %</span>}
            </div>
          ))}
        </div>
      </>
    );
  } else if (slide.id === "progres") {
    const col = (titre, items, c) => (
      <div className={`rounded-xl border p-4 ${c}`}>
        <p className="mb-2 text-xs font-black uppercase tracking-wider">{titre}</p>
        {items.length ? items.slice(0, 6).map((it) => (
          <div key={it.titre} className="mb-2"><p className="text-sm font-bold text-slate-900">{it.titre}</p><p className="text-xs text-slate-600">{it.detail}</p></div>
        )) : <p className="text-xs text-slate-500">Aucun indicateur dans ce sens.</p>}
      </div>
    );
    contenu = <div className="grid grid-cols-2 gap-4">{col("▲ Ce qui s'améliore", data.progres, "border-emerald-200 bg-emerald-50/50 text-emerald-800")}{col("▼ Ce qui recule", data.reculs, "border-red-200 bg-red-50/50 text-red-800")}</div>;
  } else if (slide.id === "constats") {
    contenu = (
      <>
        <p className="mb-3 text-xs text-slate-500">Calculés en comparant deux sources de vos données (règles fixes, sans IA).</p>
        {data.constats.slice(0, 4).map((c) => (
          <div key={c.titre} className="mb-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <p className="text-sm font-bold text-slate-900"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-600" />{c.titre}</p>
            <p className="mt-1 text-xs text-slate-600">{c.constat}</p>
          </div>
        ))}
      </>
    );
  } else if (slide.id === "analyse") {
    contenu = (
      <>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-blue-600"><Sparkles className="mr-1 inline h-3 w-3" />Rédigé par l'IA à partir des chiffres du rapport</p>
        {data.ia.variationAnalysis.slice(0, 4).map((v, i) => (
          <div key={i} className="mb-2 rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] font-black tracking-wider text-slate-500">{v.classificationTexte}{v.label ? ` · ${v.label}` : ""}{v.status === "REVIEW_REQUIRED" ? " · À VÉRIFIER" : ""}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-800">{v.text}</p>
          </div>
        ))}
        {!data.ia.variationAnalysis.length && data.ia.keyInsights.slice(0, 5).map((k, i) => <p key={i} className="mb-2 text-sm text-slate-700">• {k}</p>)}
      </>
    );
  } else if (slide.id === "donnees") {
    contenu = (
      <>
        <p className="text-sm text-slate-700">
          {data.couverture.length ? data.couverture.map((c) => `${new Intl.NumberFormat("fr-CA").format(c.n)} ${c.libelle}`).join(" · ") : "Aucune ligne datée dans la période."}
        </p>
        <p className="mt-3 text-sm text-slate-700">{data.mesures.mesures} indicateur(s) mesuré(s) sur {data.mesures.total}{data.mesures.partiels ? `, ${data.mesures.partiels} partiel(s)` : ""}.</p>
        {data.mesures.nonMesures.length > 0 && <p className="mt-2 text-xs text-slate-500">Non mesurés faute de données : {data.mesures.nonMesures.join(", ")}.</p>}
      </>
    );
  }
  return (
    <div className="relative h-full">
      <SlideHeader title={slide.title} data={data} />
      <div className={corps}>{contenu}</div>
      <SlideFooter page={page} total={total} />
    </div>
  );
}
