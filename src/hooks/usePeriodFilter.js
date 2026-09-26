import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  preparerPeriodes,
  construireFiltrePeriode,
  deplacerFiltre,
  kpisPourFiltre,
} from "@/lib/core/kpiPeriodes";

/**
 * Hook universel de gestion du filtre temporel pour GESCOP.
 * Gère l'état temporel, la synchronisation avec l'URL (si souhaité) et
 * expose les calculs comparatifs de KPI conformes à la règle Flux vs Soldes.
 */
export function usePeriodFilter(donnees, { syncUrl = true, defaultCompare = "MoM" } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Préparation du jeu de données temporelles
  const prep = useMemo(() => {
    return donnees ? preparerPeriodes(donnees) : null;
  }, [donnees]);

  // Lecture des paramètres initiaux depuis l'URL ou défauts
  const paramPreset = syncUrl ? (searchParams.get("period_preset") || "CLOSED_MONTH") : "CLOSED_MONTH";
  const paramCompare = syncUrl ? (searchParams.get("compare_type") || defaultCompare) : defaultCompare;
  const paramMois = syncUrl ? searchParams.get("mois_cible") : null;
  const paramCustomStart = syncUrl ? searchParams.get("start_date") : null;
  const paramCustomEnd = syncUrl ? searchParams.get("end_date") : null;

  const [preset, setPresetState] = useState(paramPreset);
  const [compareType, setCompareTypeState] = useState(paramCompare);
  const [moisCible, setMoisCibleState] = useState(paramMois);
  const [customRange, setCustomRangeState] = useState({
    start: paramCustomStart,
    end: paramCustomEnd,
  });

  // Construction du filtre actif
  const filter = useMemo(() => {
    return construireFiltrePeriode({
      prep,
      preset,
      compareType,
      customStart: customRange.start,
      customEnd: customRange.end,
      moisCible,
    });
  }, [prep, preset, compareType, customRange, moisCible]);

  // Synchronisation avec l'URL
  const updateUrl = useCallback((newPreset, newCompare, newMois, newStart, newEnd) => {
    if (!syncUrl) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPreset && newPreset !== "CLOSED_MONTH") next.set("period_preset", newPreset);
      else next.delete("period_preset");

      if (newCompare && newCompare !== defaultCompare) next.set("compare_type", newCompare);
      else next.delete("compare_type");

      if (newMois) next.set("mois_cible", newMois);
      else next.delete("mois_cible");

      if (newPreset === "CUSTOM" && newStart && newEnd) {
        next.set("start_date", newStart);
        next.set("end_date", newEnd);
      } else {
        next.delete("start_date");
        next.delete("end_date");
      }
      return next;
    }, { replace: true });
  }, [syncUrl, defaultCompare, setSearchParams]);

  // Handlers
  const setPreset = useCallback((p) => {
    setPresetState(p);
    updateUrl(p, compareType, moisCible, customRange.start, customRange.end);
  }, [compareType, moisCible, customRange, updateUrl]);

  const setCompareType = useCallback((c) => {
    setCompareTypeState(c);
    updateUrl(preset, c, moisCible, customRange.start, customRange.end);
  }, [preset, moisCible, customRange, updateUrl]);

  const step = useCallback((direction) => {
    const nextFiltre = deplacerFiltre(filter, direction, prep);
    if (!nextFiltre) return;
    setMoisCibleState(nextFiltre.anchorMonth);
    if (nextFiltre.preset !== preset) setPresetState(nextFiltre.preset);
    updateUrl(nextFiltre.preset, compareType, nextFiltre.anchorMonth, customRange.start, customRange.end);
  }, [filter, prep, preset, compareType, customRange, updateUrl]);

  const setCustomRange = useCallback((start, end) => {
    setCustomRangeState({ start, end });
    setPresetState("CUSTOM");
    updateUrl("CUSTOM", compareType, null, start, end);
  }, [compareType, updateUrl]);

  // Helper de calcul direct des KPI pour le filtre actif
  const computeKpis = useCallback((ids) => {
    if (!prep) return null;
    return kpisPourFiltre(prep, ids, filter);
  }, [prep, filter]);

  return {
    prep,
    filter,
    setPreset,
    setCompareType,
    step,
    setCustomRange,
    computeKpis,
  };
}
