import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/EmptyState";
import {
  Download,
  Search,
  X,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Copy,
  Trash2,
  FileSpreadsheet,
  FileText,
  Layers,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

/**
 * Ventilation détaillée des lignes d'un import (valides, quarantaine, doublons...)
 */
export function RepartitionLignes({ m, compact = false }) {
  const parts = [
    ["valides", m.valid_rows],
    ["en quarantaine", m.quarantined_rows],
    ["doublons", m.duplicate_rows],
    ["totaux exclus", m.summary_rows],
    ["ignorées", m.ignored_rows],
    ["conservées brutes", m.unknown_rows],
    ["récupérées", m.recovered_rows],
  ].filter(([, n]) => Number(n) > 0);
  const extras = [];
  if (m.unknown_fields?.length) extras.push(`${m.unknown_fields.length} col. non reconnue(s)`);
  if (m.fallback_values) extras.push(`${m.fallback_values} rangée(s) « autre »`);
  if (m.derived_values) extras.push(`${m.derived_values} id technique(s)`);
  if (m.anomalous_values) extras.push(`${m.anomalous_values} valeur(s) inhabituelle(s)`);
  if (m.potential_duplicates) extras.push(`${m.potential_duplicates} doublon(s) à vérifier`);
  if (m.ambiguous_fields?.length) extras.push(`${m.ambiguous_fields.length} col. ambiguë(s)`);
  if (m.potential_dimensions?.length) extras.push(`axes : ${m.potential_dimensions.slice(0, 3).join(", ")}`);
  if (parts.length === 0 && extras.length === 0) return null;
  const texte = [
    m.total_rows != null && !compact ? `${m.total_rows} lignes` : null,
    parts.map(([l, n]) => `${n} ${l}`).join(" · "),
    compact ? null : extras.join(" · "),
  ].filter(Boolean).join(" — ");
  return <span className={`block text-xs font-normal ${compact ? "text-muted-foreground" : "text-slate-600"}`}>{texte}</span>;
}

/**
 * Composant d'historique optimisé pour les volumes élevés d'imports.
 *
 * Fonctionnalités clés :
 * - Pagination fluide (10, 25, 50 par page)
 * - Recherche instantanée par nom de fichier ou type d'entité
 * - Filtres par statut (succès, doublons, quarantaine, échecs) et entité
 * - Tri multicritères (date, nom, score qualité, nombre de lignes)
 * - Synthèse KPI dynamique (total imports, lignes traitées, qualité moyenne, actions requises)
 * - Mode repliable (compact) pour libérer l'espace lors des nouveaux dépôts de fichiers
 */
export default function ImportHistory({
  imports = [],
  isLoading = false,
  onDelete,
  onRetraiter,
  onDoublons,
  entityOptions = [],
}) {
  // États de filtrage, recherche, tri et pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Statistiques globales de l'historique
  const stats = useMemo(() => {
    if (!imports || imports.length === 0) {
      return { total: 0, totalRows: 0, avgQuality: null, attentionCount: 0 };
    }
    const total = imports.length;
    const totalRows = imports.reduce((acc, imp) => acc + (Number(imp.rows_processed) || 0), 0);
    const scored = imports.filter((imp) => imp.quality_score != null);
    const avgQuality = scored.length
      ? Math.round(scored.reduce((acc, imp) => acc + Number(imp.quality_score), 0) / scored.length)
      : null;
    const attentionCount = imports.filter(
      (imp) =>
        Number(imp.potential_duplicates || 0) > 0 ||
        Number(imp.rows_quarantined || 0) > 0 ||
        imp.status === "echoue"
    ).length;

    return { total, totalRows, avgQuality, attentionCount };
  }, [imports]);

  // Filtrage et recherche
  const filteredImports = useMemo(() => {
    if (!imports) return [];

    return imports
      .filter((imp) => {
        // Recherche textuelle
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchName = imp.file_name?.toLowerCase().includes(q);
          const matchEntity = imp.entity_type?.toLowerCase().includes(q);
          const matchSource = imp.source_type?.toLowerCase().includes(q);
          if (!matchName && !matchEntity && !matchSource) return false;
        }

        // Filtre Entité
        if (entityFilter !== "all" && imp.entity_type !== entityFilter) {
          return false;
        }

        // Filtre Statut
        if (statusFilter === "complete" && imp.status !== "complete") return false;
        if (statusFilter === "echoue" && imp.status !== "echoue") return false;
        if (statusFilter === "duplicates" && Number(imp.potential_duplicates || 0) <= 0) return false;
        if (statusFilter === "quarantine" && Number(imp.rows_quarantined || 0) <= 0 && imp.status !== "quarantaine") return false;
        if (statusFilter === "attention") {
          const hasIssues =
            Number(imp.potential_duplicates || 0) > 0 ||
            Number(imp.rows_quarantined || 0) > 0 ||
            imp.status === "echoue";
          if (!hasIssues) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date-desc") {
          return new Date(b.created_date || 0) - new Date(a.created_date || 0);
        }
        if (sortBy === "date-asc") {
          return new Date(a.created_date || 0) - new Date(b.created_date || 0);
        }
        if (sortBy === "name-asc") {
          return (a.file_name || "").localeCompare(b.file_name || "");
        }
        if (sortBy === "quality-desc") {
          return (Number(b.quality_score) || 0) - (Number(a.quality_score) || 0);
        }
        if (sortBy === "rows-desc") {
          return (Number(b.rows_processed) || 0) - (Number(a.rows_processed) || 0);
        }
        return 0;
      });
  }, [imports, searchTerm, entityFilter, statusFilter, sortBy]);

  // Réinitialiser la page quand les filtres changent
  const totalPages = Math.max(1, Math.ceil(filteredImports.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedImports = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredImports.slice(startIndex, startIndex + pageSize);
  }, [filteredImports, safeCurrentPage, pageSize]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() || entityFilter !== "all" || statusFilter !== "all" || sortBy !== "date-desc"
  );

  const handleResetFilters = () => {
    setSearchTerm("");
    setEntityFilter("all");
    setStatusFilter("all");
    setSortBy("date-desc");
    setCurrentPage(1);
  };

  // Helper pour l'icône de fichier
  const getFileIcon = (fileName = "") => {
    const fn = fileName.toLowerCase();
    if (fn.endsWith(".xlsx") || fn.endsWith(".xls")) {
      return <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />;
    }
    if (fn.endsWith(".pdf")) {
      return <FileText className="h-4 w-4 text-rose-600 shrink-0" />;
    }
    return <FileText className="h-4 w-4 text-blue-600 shrink-0" />;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <Clock className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
        Chargement de l'historique des imports…
      </div>
    );
  }

  if (!imports || imports.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold">Historique des imports</h2>
        <EmptyState
          icon={Download}
          title="Aucun import"
          description="Vos imports et journaux d'intégration apparaîtront ici."
        />
      </div>
    );
  }

  const startRecord = filteredImports.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, filteredImports.length);

  return (
    <div className="space-y-4">
      {/* Barre de titre et action de réduction */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Historique des imports</h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {stats.total} import{stats.total > 1 ? "s" : ""}
          </span>
          {stats.attentionCount > 0 && (
            <button
              onClick={() => {
                setStatusFilter(statusFilter === "attention" ? "all" : "attention");
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors"
              title="Filtrer les imports nécessitant votre attention"
            >
              <AlertCircle className="h-3 w-3" />
              {stats.attentionCount} action{stats.attentionCount > 1 ? "s" : ""} requise{stats.attentionCount > 1 ? "s" : ""}
            </button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="mr-1.5 h-4 w-4" /> Développer l'historique
            </>
          ) : (
            <>
              <ChevronUp className="mr-1.5 h-4 w-4" /> Réduire
            </>
          )}
        </Button>
      </div>

      {/* Vue repliée compacte */}
      {isCollapsed ? (
        <div
          onClick={() => setIsCollapsed(false)}
          className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>
              <strong>{stats.total}</strong> imports au total · <strong>{stats.totalRows.toLocaleString("fr-CA")}</strong> lignes traitées
              {stats.avgQuality != null && ` · Qualité moyenne ${stats.avgQuality}%`}
            </span>
          </div>
          <span className="text-xs font-medium text-primary hover:underline">Afficher le détail</span>
        </div>
      ) : (
        <>
          {/* Cartes KPI synthétiques */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-xs text-muted-foreground">Fichiers importés</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-xs text-muted-foreground">Lignes traitées</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-foreground">
                {stats.totalRows.toLocaleString("fr-CA")}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <p className="text-xs text-muted-foreground">Qualité moyenne</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-foreground">
                {stats.avgQuality != null ? `${stats.avgQuality}%` : "—"}
              </p>
            </div>
            <div
              className={`rounded-xl border p-3.5 shadow-sm transition-colors ${
                stats.attentionCount > 0
                  ? "border-amber-200 bg-amber-50/50 cursor-pointer hover:bg-amber-50"
                  : "border-border bg-card"
              }`}
              onClick={() => {
                if (stats.attentionCount > 0) {
                  setStatusFilter(statusFilter === "attention" ? "all" : "attention");
                  setCurrentPage(1);
                }
              }}
            >
              <p className="text-xs text-muted-foreground">À vérifier</p>
              <p
                className={`mt-1 text-xl font-bold tracking-tight ${
                  stats.attentionCount > 0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {stats.attentionCount > 0 ? `${stats.attentionCount} import(s)` : "Aucun doublon"}
              </p>
            </div>
          </div>

          {/* Barre d'outils : recherche, filtres et tri */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border bg-muted/20 p-3">
            {/* Recherche textuelle */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Rechercher un fichier, entité…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 pl-8 pr-8 text-xs bg-background"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Sélecteurs de filtrage */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtre Entité */}
              <div className="w-36">
                <Select
                  value={entityFilter}
                  onValueChange={(val) => {
                    setEntityFilter(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Entité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes entités</SelectItem>
                    {entityOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtre Statut */}
              <div className="w-40">
                <Select
                  value={statusFilter}
                  onValueChange={(val) => {
                    setStatusFilter(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="complete">Succès</SelectItem>
                    <SelectItem value="attention">À vérifier (Doublons/Quar.)</SelectItem>
                    <SelectItem value="duplicates">Doublons à vérifier</SelectItem>
                    <SelectItem value="quarantine">Lignes quarantaine</SelectItem>
                    <SelectItem value="echoue">Échoués</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tri */}
              <div className="w-44">
                <Select
                  value={sortBy}
                  onValueChange={(val) => {
                    setSortBy(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Tri" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Plus récent d'abord</SelectItem>
                    <SelectItem value="date-asc">Plus ancien d'abord</SelectItem>
                    <SelectItem value="name-asc">Nom (A → Z)</SelectItem>
                    <SelectItem value="rows-desc">Plus de lignes</SelectItem>
                    <SelectItem value="quality-desc">Meilleure qualité</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Réinitialiser les filtres */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Réinitialiser
                </Button>
              )}
            </div>
          </div>

          {/* Tableau des imports paginé */}
          {filteredImports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <Filter className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-semibold">Aucun import correspondant</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Aucun fichier ne répond aux critères de recherche ou de filtre sélectionnés.
              </p>
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4 text-xs">
                Réinitialiser tous les filtres
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fichier</th>
                    <th className="px-4 py-3 font-medium">Entité</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Lignes</th>
                    <th className="px-4 py-3 font-medium">Qualité</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {paginatedImports.map((imp) => {
                    const quality = imp.quality_score != null ? Number(imp.quality_score) : null;
                    const hasDuplicates = Number(imp.potential_duplicates || 0) > 0;
                    const hasQuarantine = Number(imp.rows_quarantined || 0) > 0;

                    return (
                      <tr key={imp.id} className="hover:bg-muted/30 transition-colors">
                        {/* Fichier */}
                        <td className="max-w-[200px] px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getFileIcon(imp.file_name)}
                            <span className="truncate font-medium text-foreground" title={imp.file_name}>
                              {imp.file_name}
                            </span>
                          </div>
                        </td>

                        {/* Entité */}
                        <td className="px-4 py-3 text-xs">
                          {imp.entity_type ? (
                            <span className="inline-flex rounded-md bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                              {imp.entity_type}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Type de source */}
                        <td className="px-4 py-3 uppercase text-xs text-muted-foreground font-mono">
                          {imp.source_type}
                        </td>

                        {/* Lignes traitées */}
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            <span className="font-semibold text-foreground">
                              {imp.rows_processed || 0}
                            </span>
                            {imp.total_rows != null && (
                              <span className="text-muted-foreground"> / {imp.total_rows}</span>
                            )}
                          </div>
                          {imp.total_rows != null && (
                            <RepartitionLignes
                              m={{
                                ...imp,
                                valid_rows: imp.rows_processed,
                                quarantined_rows: imp.rows_quarantined,
                              }}
                              compact
                            />
                          )}
                        </td>

                        {/* Qualité */}
                        <td className="px-4 py-3">
                          {quality != null ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                quality >= 90
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : quality >= 70
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-red-50 text-red-700 border border-red-200"
                              }`}
                            >
                              {quality}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Statut */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              imp.status === "complete"
                                ? "text-emerald-600"
                                : imp.status === "echoue"
                                ? "text-red-600"
                                : "text-amber-600"
                            }`}
                          >
                            {imp.status === "complete" && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {imp.status === "echoue" && <AlertCircle className="h-3.5 w-3.5" />}
                            {imp.status !== "complete" && imp.status !== "echoue" && (
                              <Clock className="h-3.5 w-3.5" />
                            )}
                            {imp.status}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {imp.created_date ? new Date(imp.created_date).toLocaleDateString("fr-CA") : "—"}
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {hasDuplicates && (
                            <button
                              onClick={() => onDoublons?.(imp)}
                              title="Lignes identiques à une autre du fichier : exclure ou conserver après vérification"
                              className="mr-1.5 inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors shadow-sm"
                            >
                              <Copy className="h-3.5 w-3.5" /> Doublons ({imp.potential_duplicates})
                            </button>
                          )}

                          {hasQuarantine && (
                            imp.entity_type ? (
                              <button
                                onClick={() => onRetraiter?.(imp)}
                                title="Relire les lignes en attente avec ce que l'application sait maintenant"
                                className="mr-1.5 inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-xs font-medium text-sky-800 hover:bg-sky-100 transition-colors shadow-sm"
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Retraiter
                              </button>
                            ) : (
                              <div className="inline-block mr-1.5 align-middle text-left">
                                <Select onValueChange={(val) => onRetraiter?.(imp, val)}>
                                  <SelectTrigger
                                    className="h-8 w-40 text-xs shadow-sm"
                                    title="Choisir le type de ces lignes pour les intégrer"
                                  >
                                    <SelectValue placeholder="Intégrer comme…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {entityOptions.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )
                          )}

                          <button
                            onClick={() => onDelete?.(imp)}
                            title="Supprimer cet import et ses enregistrements associés"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination et indicateurs de volume */}
          {filteredImports.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
              {/* Comptage */}
              <div className="flex items-center gap-2">
                <span>
                  Affichage de <strong>{startRecord}</strong> à <strong>{endRecord}</strong> sur{" "}
                  <strong>{filteredImports.length}</strong> import{filteredImports.length > 1 ? "s" : ""}
                </span>
                {filteredImports.length < imports.length && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                    ({imports.length - filteredImports.length} masqué{imports.length - filteredImports.length > 1 ? "s" : ""} par les filtres)
                  </span>
                )}
              </div>

              {/* Contrôles de pagination et taille de page */}
              <div className="flex items-center gap-3">
                {/* Taille par page */}
                <div className="flex items-center gap-1.5">
                  <span>Lignes / page :</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => {
                      setPageSize(Number(val));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-16 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Boutons de navigation */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(1)}
                    title="Première page"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    title="Page précédente"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>

                  <span className="px-2 font-medium text-foreground">
                    Page {safeCurrentPage} / {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    title="Page suivante"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    title="Dernière page"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
