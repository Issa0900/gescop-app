import React from "react";
import { EnTeteRapport, ResumeIA, GrilleIndicateurs, SerieBarres, ProgresReculs, Constats, AnalyseIA, Couverture } from "@/components/reports/RapportBlocs";

// Rapport hebdomadaire (COMPRENDRE) : sept jours compares aux sept precedents,
// evolution sur cinq semaines, explications classees de l'IA.
export default function WeeklyReportView({ data }) {
  return (
    <div className="space-y-6 font-sans text-foreground">
      <EnTeteRapport data={data} titre="Rapport hebdomadaire" ton="violet" />
      <ResumeIA texte={data.ia.summary} titre="Synthèse de la semaine" />
      <GrilleIndicateurs indicateurs={data.indicateurs} />
      <SerieBarres serie={data.serie} titre="Évolution sur 5 semaines" ton="violet" />
      <ProgresReculs progres={data.progres} reculs={data.reculs} />
      <Constats constats={data.constats} />
      <AnalyseIA ia={data.ia} titre="Diagnostic : faits, calculs, hypothèses" />
      <Couverture data={data} />
    </div>
  );
}
