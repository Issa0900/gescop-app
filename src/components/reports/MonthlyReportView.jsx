import React from "react";
import { EnTeteRapport, ResumeIA, GrilleIndicateurs, SerieBarres, ProgresReculs, Constats, AnalyseIA, SectionsIA, Couverture } from "@/components/reports/RapportBlocs";

// Rapport mensuel (PILOTER) : dernier mois complet compare au precedent,
// evolution sur six mois, constats croises et analyse de l'IA par theme.
// Il affichait jusqu'au 25 sept. 2026 un dossier de demonstration (46
// montants codes en dur, scenarios et plan d'action inventes) : il ne montre
// plus que les chiffres du moteur stockes dans le rapport et le texte de l'IA.
export default function MonthlyReportView({ data }) {
  return (
    <div className="space-y-6 font-sans text-foreground">
      <EnTeteRapport data={data} titre="Rapport mensuel" ton="emerald" />
      <ResumeIA texte={data.ia.summary} titre="Résumé exécutif" />
      <GrilleIndicateurs indicateurs={data.indicateurs} />
      <SerieBarres serie={data.serie} titre="Évolution sur 6 mois" ton="emerald" />
      <ProgresReculs progres={data.progres} reculs={data.reculs} />
      <Constats constats={data.constats} />
      <AnalyseIA ia={data.ia} />
      <SectionsIA sections={data.ia.sections} />
      <Couverture data={data} />
    </div>
  );
}
