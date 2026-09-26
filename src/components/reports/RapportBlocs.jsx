// Blocs communs aux trois rapports. Ils n'affichent que ce que le rapport
// contient (extractReportData) : un bloc sans donnee ne s'affiche pas.
import React from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUpRight, ArrowDownRight, ArrowRight, AlertTriangle, Sparkles, Database, Link2, Info } from "lucide-react";

const TONS = {
  blue: { grad: "from-blue-900/10", pill: "bg-blue-500/10 text-blue-600 dark:text-blue-400", bar: "from-blue-600 to-blue-500" },
  violet: { grad: "from-violet-900/10", pill: "bg-violet-500/10 text-violet-600 dark:text-violet-400", bar: "from-violet-600 to-violet-500" },
  emerald: { grad: "from-emerald-900/10", pill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "from-emerald-600 to-emerald-500" },
};

export function EnTeteRapport({ data, titre, ton = "blue" }) {
  const t = TONS[ton];
  return (
    <div className={`rounded-2xl border border-border/80 bg-gradient-to-r ${t.grad} via-card to-card p-6 shadow-sm`}>
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-primary">GESCOP</span>
            <span className="text-muted-foreground/60">•</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${t.pill}`}>{titre}</span>
          </div>
          {data.companyName && <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{data.companyName}</h1>}
        </div>
        <div className="text-left sm:text-right">
          <span className="text-xs font-semibold text-muted-foreground">Période analysée</span>
          <p className="text-base font-bold text-foreground">{data.periode?.libelle || data.period || "Aucune période mesurable"}</p>
          {data.precedente?.libelle && <p className="text-xs text-muted-foreground">comparée à {data.precedente.libelle}</p>}
        </div>
      </div>
      {data.base && <p className="mt-3 text-xs text-muted-foreground">{data.base}</p>}
      {data.ancien && (
        <div className="mt-3 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Rapport généré avant le 25 septembre 2026 avec l'ancien calcul (revenus = transactions bancaires seulement,
            marge = revenus moins dépenses). Ses chiffres peuvent différer de la page Indicateurs : générez un nouveau rapport.
          </p>
        </div>
      )}
    </div>
  );
}

export function ResumeIA({ texte, titre = "Synthèse" }) {
  if (!texte) return null;
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-xs font-bold uppercase tracking-wider text-primary">{titre}</p>
        <span className="text-[10px] font-medium text-muted-foreground">rédigée par l'IA à partir des chiffres du rapport</span>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">{texte}</p>
    </div>
  );
}

export function TuileIndicateur({ ind }) {
  const va = ind.variation;
  const couleur = va?.favorable === true ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : va?.favorable === false ? "bg-red-500/10 text-red-700 dark:text-red-400"
    : "bg-muted text-muted-foreground";
  const Icone = va?.sens === "hausse" ? ArrowUpRight : va?.sens === "baisse" ? ArrowDownRight : ArrowRight;
  const mesure = ind.courant?.statut !== "non mesuré";
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{ind.nom}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {ind.courant?.statut === "partiel" && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300" title="Calculé avec une partie des sources">Partiel</span>
          )}
          {ind.variationTexte && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${couleur}`}>
              <Icone className="h-3.5 w-3.5" />{ind.variationTexte}
            </span>
          )}
        </div>
      </div>
      <span className={mesure ? "mt-3 text-2xl font-extrabold tracking-tight" : "mt-3 text-sm font-semibold text-muted-foreground"}>{ind.valeurTexte}</span>
      {ind.precedentTexte && <p className="mt-1 text-xs text-muted-foreground">Période précédente : {ind.precedentTexte}</p>}
      {ind.courant?.note && <p className="mt-1 text-xs text-muted-foreground">{ind.courant.note}</p>}
    </div>
  );
}

export function GrilleIndicateurs({ indicateurs }) {
  if (!indicateurs?.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {indicateurs.map((ind) => <TuileIndicateur key={ind.id} ind={ind} />)}
    </div>
  );
}

export function SerieBarres({ serie, titre, ton = "blue" }) {
  const avecCa = (serie || []).filter((s) => Number.isFinite(s.ca));
  if (avecCa.length < 2) return null;
  const max = Math.max(...avecCa.map((s) => s.ca), 1);
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{titre}</h2>
      <p className="text-xs text-muted-foreground">Chiffre d'affaires hors taxes et taux de marge brute de chaque période</p>
      <div className="mt-4 grid gap-3 border-t border-border/50 pt-4" style={{ gridTemplateColumns: `repeat(${serie.length}, minmax(0, 1fr))` }}>
        {serie.map((s, idx) => {
          const courant = idx === serie.length - 1;
          const h = Number.isFinite(s.ca) ? Math.max(2, Math.round((s.ca / max) * 100)) : 0;
          return (
            <div key={s.libelle} className="flex min-w-0 flex-col items-center text-center">
              <div className="flex h-28 w-full items-end justify-center rounded-lg bg-muted/30 p-1.5">
                {h > 0 && <div style={{ height: `${h}%` }} className={`w-full max-w-[36px] rounded-t-md ${courant ? `bg-gradient-to-t ${TONS[ton].bar}` : "bg-muted-foreground/30"}`} />}
              </div>
              <span className={`mt-2 text-[11px] font-bold leading-tight ${courant ? "text-primary" : "text-muted-foreground"}`}>{s.libelle}</span>
              <span className="text-xs font-semibold">{Number.isFinite(s.ca) ? `${new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(s.ca)} $` : "Non mesuré"}</span>
              {Number.isFinite(s.margePct) && <span className="text-[11px] text-muted-foreground">{new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 }).format(s.margePct)} %</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Liste({ titre, items, ton, symbole }) {
  const c = ton === "vert"
    ? { bord: "border-emerald-500/30 bg-emerald-500/5", item: "border-emerald-500/20", texte: "text-emerald-900 dark:text-emerald-300" }
    : { bord: "border-red-500/30 bg-red-500/5", item: "border-red-500/20", texte: "text-red-900 dark:text-red-300" };
  return (
    <div className={`rounded-2xl border p-6 shadow-sm ${c.bord}`}>
      <h2 className={`mb-4 text-sm font-bold uppercase tracking-wider ${c.texte}`}>{symbole} {titre}</h2>
      {items.length ? (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.titre} className={`rounded-xl border bg-card/80 p-3.5 ${c.item}`}>
              <p className="text-sm font-bold text-foreground">{it.titre}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{it.detail}</p>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-muted-foreground">Aucun indicateur comparable dans ce sens.</p>}
    </div>
  );
}

export function ProgresReculs({ progres, reculs }) {
  if (!progres?.length && !reculs?.length) return null;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Liste titre="Ce qui s'améliore" items={progres} ton="vert" symbole="▲" />
      <Liste titre="Ce qui recule" items={reculs} ton="rouge" symbole="▼" />
    </div>
  );
}

export function Constats({ constats, titre = "Constats croisés" }) {
  if (!constats?.length) return null;
  const couleur = { critique: "bg-red-500/10 text-red-700 border-red-200", important: "bg-amber-500/10 text-amber-700 border-amber-200", modere: "bg-blue-500/10 text-blue-700 border-blue-200" };
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Link2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">{titre}</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Calculés en comparant deux sources de vos données (règles fixes, sans IA).</p>
      <div className="space-y-3">
        {constats.map((c) => (
          <div key={c.titre} className="rounded-xl border border-amber-500/20 bg-card/80 p-4">
            <div className="flex items-center gap-2">
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${couleur[c.niveau] || couleur.modere}`}>{c.niveau === "modere" ? "modéré" : c.niveau}</span>
              <p className="text-sm font-bold text-foreground">{c.titre}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.constat}</p>
            {c.action && <p className="mt-1.5 text-xs font-semibold leading-relaxed text-foreground">À examiner : {c.action}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

const BADGES = {
  FACT: "bg-blue-100 text-blue-800 border-blue-200", CALCULATION: "bg-purple-100 text-purple-800 border-purple-200",
  OBSERVATION: "bg-slate-100 text-slate-800 border-slate-200", INFERENCE: "bg-indigo-100 text-indigo-800 border-indigo-200",
  HYPOTHESIS: "bg-amber-100 text-amber-800 border-amber-200", RECOMMENDATION: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function AnalyseIA({ ia, titre = "Explication des variations", seulement = null }) {
  const variations = (ia?.variationAnalysis || []).filter((v) => !seulement || seulement.includes(v.classification));
  if (!variations.length && !ia?.keyInsights?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{titre}</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Rédigé par l'IA à partir des chiffres du rapport. Chaque affirmation porte sa nature : un fait se vérifie dans les chiffres, une hypothèse demande une validation.</p>
      <div className="space-y-3">
        {variations.map((v, i) => (
          <div key={i} className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider ${BADGES[v.classification] || BADGES.OBSERVATION}`}>{v.classificationTexte}</span>
              {v.label && <span className="text-xs font-bold text-foreground">{v.label}</span>}
              {Number.isFinite(v.confidence) && <span className="text-[11px] text-muted-foreground">confiance {Math.round(v.confidence * 100)} %</span>}
              {v.status === "REVIEW_REQUIRED" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700" title={v.review_reason || ""}>
                  <AlertTriangle className="h-3 w-3" /> À vérifier
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{v.text}</p>
            {v.sources?.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Sources : {v.sources.join(", ")}</p>}
          </div>
        ))}
      </div>
      {ia?.keyInsights?.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
          {ia.keyInsights.map((k, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />{k}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SectionsIA({ sections, titre = "Analyse détaillée" }) {
  if (!sections?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{titre}</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Rédigée par l'IA à partir des chiffres du rapport.</p>
      <div className="space-y-5">
        {sections.map((s) => (
          <div key={s.titre}>
            <h3 className="mb-1.5 text-sm font-bold text-foreground">{s.titre}</h3>
            <div className="text-sm leading-relaxed text-muted-foreground [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_strong]:text-foreground">
              <ReactMarkdown>{s.contenu}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Couverture({ data }) {
  const { couverture, mesures } = data;
  if (!mesures?.total) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Données utilisées</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {couverture.length
          ? couverture.map((c) => <span key={c.libelle}><strong className="text-foreground">{new Intl.NumberFormat("fr-CA").format(c.n)}</strong> {c.libelle}</span>)
          : !data.ancien && <span>Aucune ligne datée dans la période.</span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <strong className="text-foreground">{mesures.mesures}</strong> indicateur(s) mesuré(s) sur {mesures.total}
        {mesures.partiels > 0 && <>, <strong className="text-foreground">{mesures.partiels}</strong> partiel(s)</>}
        {mesures.nonMesures.length > 0 && <> ; non mesurés faute de données : {mesures.nonMesures.join(", ")}</>}.
      </p>
    </div>
  );
}
