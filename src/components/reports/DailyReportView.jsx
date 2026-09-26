import React from "react";
import { EnTeteRapport, ResumeIA, GrilleIndicateurs, ProgresReculs, Constats, AnalyseIA, Couverture } from "@/components/reports/RapportBlocs";

// Rapport quotidien (SURVEILLER) : la derniere journee d'activite, comparee a
// la veille. Uniquement les chiffres du moteur et le texte de l'IA.
export default function DailyReportView({ data }) {
  return (
    <div className="space-y-6 font-sans text-foreground">
      <EnTeteRapport data={data} titre="Rapport quotidien" ton="blue" />
      <ResumeIA texte={data.ia.summary} titre="État général" />
      <GrilleIndicateurs indicateurs={data.indicateurs} />
      <ProgresReculs progres={data.progres} reculs={data.reculs} />
      <Constats constats={data.constats} titre="Points d'attention" />
      <AnalyseIA ia={data.ia} titre="Analyse et actions proposées" />
      <Couverture data={data} />
    </div>
  );
}
