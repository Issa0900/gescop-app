import React, { useState, useMemo } from "react";
import { BookOpen, Plus, Trash2, Sparkles, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/LanguageContext";
import {
  lireDictionnaire, versEnregistrement, EXEMPLES_DICTIONNAIRE, EXEMPLES_ENREGISTRES_AVANT,
  contientExemplesAvant, retirerExemplesAvant,
} from "@/lib/dictionnaire";

// Plus de termes d'exemple affichés comme s'ils étaient ceux de l'entreprise :
// ils étaient enregistrés au premier ajout puis imposés à chaque import
// (src/lib/dictionnaire.js, lot 6).

export default function DictionaryPanel({ form, setForm }) {
  const { language } = useLanguage();
  const isEn = language === "en";

  const [search, setSearch] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newConcept, setNewConcept] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const dictItems = useMemo(() => lireDictionnaire(form?.company_dictionary), [form?.company_dictionary]);
  const exemplesAvant = useMemo(() => contientExemplesAvant(form?.company_dictionary), [form?.company_dictionary]);

  const updateDictionary = (nextList) => {
    setForm((f) => ({
      ...f,
      // Forme liste avec `maps_to`, la clé que lit l'import.
      company_dictionary: versEnregistrement(nextList),
    }));
  };

  const addTerm = () => {
    if (!newTerm.trim() || !newConcept.trim()) return;
    const newItem = {
      id: "dict_" + Date.now(),
      term: newTerm.trim(),
      maps_to: newConcept.trim().toLowerCase().replace(/\s+/g, "_"),
      description: newDesc.trim() || (isEn ? "Custom mapping" : "Correspondance personnalisée"),
    };
    updateDictionary([...dictItems, newItem]);
    setNewTerm("");
    setNewConcept("");
    setNewDesc("");
  };

  // Par identifiant : l'index de la liste filtrée par la recherche ne
  // correspond pas à celui de la liste complète.
  const removeTerm = (id) => {
    updateDictionary(dictItems.filter((item) => item.id !== id));
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return dictItems;
    const q = search.toLowerCase();
    return dictItems.filter(
      (item) =>
        item.term.toLowerCase().includes(q) ||
        item.maps_to.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [dictItems, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          {isEn ? "Business Dictionary & Semantic Memory" : "Dictionnaire Métier & Mémoire Sémantique"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isEn
            ? "Memorizes specific column naming and vocabulary from your business files to ensure 100% accurate column mapping across all future imports."
            : "Apprend et mémorise le vocabulaire spécifique de vos fichiers pour garantir une reconnaissance sans erreur à chaque import."}
        </p>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground flex items-start gap-3 shadow-xs">
        <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <div>
          <strong className="font-semibold text-foreground">
            {isEn ? "Continuous adaptive learning:" : "Apprentissage adaptatif continu :"}
          </strong>{" "}
          {isEn
            ? "Any custom mapping you approve during spreadsheet import is permanently remembered here for your company."
            : "Chaque correction ou correspondance validée lors de vos imports est automatiquement retenue ici pour tous les futurs fichiers de votre entreprise."}
        </div>
      </div>

      {exemplesAvant && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-xs text-amber-900 flex flex-wrap items-start justify-between gap-3 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="min-w-0">
            <strong className="font-semibold">{isEn ? "Example terms detected:" : "Termes d'exemple détectés :"}</strong>{" "}
            {EXEMPLES_ENREGISTRES_AVANT.map((e) => `« ${e.term} » → ${e.maps_to}`).join(", ")}.{" "}
            {isEn
              ? "GESCOP used to save these examples automatically, and they are applied to every import. Remove them unless they match your files."
              : "GESCOP enregistrait ces exemples d'office, et ils sont appliqués à chaque import. Retirez-les s'ils ne correspondent pas à vos fichiers."}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, company_dictionary: retirerExemplesAvant(f?.company_dictionary) }))}>
            {isEn ? "Remove the examples" : "Retirer les exemples"}
          </Button>
        </div>
      )}

      {/* Tableau du dictionnaire */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span>{isEn ? "Mapped Terms (" + filteredItems.length + ")" : "Termes référencés (" + filteredItems.length + ")"}</span>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isEn ? "Search vocabulary…" : "Rechercher un terme…"}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 font-semibold">{isEn ? "Term in your files" : "Terme dans vos fichiers"}</th>
                <th className="text-left py-3 px-4 font-semibold">{isEn ? "Standardized GESCOP concept" : "Concept GESCOP normalisé"}</th>
                <th className="text-left py-3 px-4 font-semibold hidden sm:table-cell">{isEn ? "Description / Context" : "Description / Rôle"}</th>
                <th className="text-right py-3 px-4 font-semibold">{isEn ? "Action" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground text-xs">
                    {dictItems.length === 0
                      ? (isEn
                        ? `No term yet. Add the column names of your files that GESCOP does not recognize, e.g. ${EXEMPLES_DICTIONNAIRE.map((e) => `"${e.term}" → ${e.maps_to}`).join(", ")}.`
                        : `Aucun terme pour l'instant. Ajoutez les noms de colonnes de vos fichiers que GESCOP ne reconnaît pas, par exemple ${EXEMPLES_DICTIONNAIRE.map((e) => `« ${e.term} » → ${e.maps_to}`).join(", ")}.`)
                      : (isEn ? "No matching terms found." : "Aucun terme correspondant trouvé.")}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">
                      {item.term || <span className="text-muted-foreground italic">{isEn ? "Unnamed" : "Sans nom"}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md text-[11px]">
                        {item.maps_to || "mapping"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell max-w-xs truncate">
                      {item.description || "-"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => removeTerm(item.id)}
                        className="text-muted-foreground hover:text-red-600 p-1 rounded-md transition-colors"
                        title={isEn ? "Remove term" : "Supprimer ce terme"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulaire d'ajout rapide */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xs">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Plus className="h-4 w-4 text-primary" />
          {isEn ? "Add a manual term mapping" : "Ajouter une correspondance manuelle"}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTerm();
              }
            }}
            placeholder={isEn ? "File column (e.g. Sales, Gross_Rev)" : "Nom de colonne (ex: Ventes, Coût d'achat)"}
            className="text-xs"
          />
          <Input
            value={newConcept}
            onChange={(e) => setNewConcept(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTerm();
              }
            }}
            placeholder={isEn ? "Target concept (e.g. revenue, cogs)" : "Concept cible (ex: revenue, total_cost)"}
            className="text-xs font-mono"
          />
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTerm();
              }
            }}
            placeholder={isEn ? "Description (optional)" : "Description / Précision (optionnel)"}
            className="text-xs"
          />
        </div>
        <div className="flex justify-end pt-1">
          <Button type="button" size="sm" onClick={addTerm} className="gap-1.5 shadow-xs">
            <Plus className="h-4 w-4" />
            {isEn ? "Add to dictionary" : "Ajouter au dictionnaire"}
          </Button>
        </div>
      </div>
    </div>
  );
}
