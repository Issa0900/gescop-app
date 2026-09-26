import test from "node:test";
import assert from "node:assert/strict";

// Helper functions mirroring ImportHistory logic for robust regression testing
function computeStats(imports) {
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
}

function filterAndSortImports(imports, { searchTerm = "", entityFilter = "all", statusFilter = "all", sortBy = "date-desc" }) {
  if (!imports) return [];

  return imports
    .filter((imp) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = imp.file_name?.toLowerCase().includes(q);
        const matchEntity = imp.entity_type?.toLowerCase().includes(q);
        const matchSource = imp.source_type?.toLowerCase().includes(q);
        if (!matchName && !matchEntity && !matchSource) return false;
      }

      if (entityFilter !== "all" && imp.entity_type !== entityFilter) {
        return false;
      }

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
      if (sortBy === "date-desc") return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      if (sortBy === "date-asc") return new Date(a.created_date || 0) - new Date(b.created_date || 0);
      if (sortBy === "name-asc") return (a.file_name || "").localeCompare(b.file_name || "");
      if (sortBy === "quality-desc") return (Number(b.quality_score) || 0) - (Number(a.quality_score) || 0);
      if (sortBy === "rows-desc") return (Number(b.rows_processed) || 0) - (Number(a.rows_processed) || 0);
      return 0;
    });
}

function paginate(items, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(startIndex, startIndex + pageSize),
  };
}

test("Optimisation Historique Imports - Calculs statistiques (KPIs)", () => {
  const mockImports = [
    { id: "1", file_name: "commandes_2026.csv", rows_processed: 500, quality_score: 95, status: "complete" },
    { id: "2", file_name: "depenses_q1.xlsx", rows_processed: 250, quality_score: 85, status: "complete", potential_duplicates: 3 },
    { id: "3", file_name: "paie_aout.csv", rows_processed: 120, quality_score: 100, status: "complete", rows_quarantined: 5 },
    { id: "4", file_name: "banque_error.pdf", rows_processed: 0, quality_score: null, status: "echoue" },
  ];

  const stats = computeStats(mockImports);
  assert.equal(stats.total, 4, "Doit compter 4 imports");
  assert.equal(stats.totalRows, 870, "Total des lignes : 500 + 250 + 120 + 0 = 870");
  assert.equal(stats.avgQuality, 93, "Moyenne qualité : (95 + 85 + 100) / 3 = 93.33 -> 93%");
  assert.equal(stats.attentionCount, 3, "3 imports nécessitent attention (1 doublon, 1 quarantaine, 1 échoué)");
});

test("Optimisation Historique Imports - Recherche textuelle", () => {
  const mockImports = [
    { id: "1", file_name: "commandes_août.csv", entity_type: "Order", source_type: "csv" },
    { id: "2", file_name: "factures_fournisseurs.xlsx", entity_type: "Expense", source_type: "xlsx" },
    { id: "3", file_name: "grand_livre.pdf", entity_type: "Transaction", source_type: "pdf" },
  ];

  const res1 = filterAndSortImports(mockImports, { searchTerm: "commandes" });
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, "1");

  const res2 = filterAndSortImports(mockImports, { searchTerm: "expense" });
  assert.equal(res2.length, 1);
  assert.equal(res2[0].id, "2");

  const res3 = filterAndSortImports(mockImports, { searchTerm: "pdf" });
  assert.equal(res3.length, 1);
  assert.equal(res3[0].id, "3");
});

test("Optimisation Historique Imports - Filtre par statut d'attention", () => {
  const mockImports = [
    { id: "1", file_name: "propre.csv", status: "complete" },
    { id: "2", file_name: "avec_doublons.csv", status: "complete", potential_duplicates: 2 },
    { id: "3", file_name: "avec_rejets.csv", status: "quarantaine", rows_quarantined: 4 },
    { id: "4", file_name: "en_erreur.xlsx", status: "echoue" },
  ];

  const attentionList = filterAndSortImports(mockImports, { statusFilter: "attention" });
  assert.equal(attentionList.length, 3);
  assert.deepEqual(attentionList.map((x) => x.id).sort(), ["2", "3", "4"]);

  const duplicatesOnly = filterAndSortImports(mockImports, { statusFilter: "duplicates" });
  assert.equal(duplicatesOnly.length, 1);
  assert.equal(duplicatesOnly[0].id, "2");
});

test("Optimisation Historique Imports - Pagination avec volume de 60 imports", () => {
  const mockImports = Array.from({ length: 60 }, (_, i) => ({
    id: `imp-${i + 1}`,
    file_name: `import_${i + 1}.csv`,
    created_date: new Date(2026, 0, i + 1).toISOString(),
    rows_processed: 10,
  }));

  // Page 1 avec 10 items
  const p1 = paginate(mockImports, 1, 10);
  assert.equal(p1.items.length, 10);
  assert.equal(p1.totalPages, 6);
  assert.equal(p1.items[0].id, "imp-1");

  // Page 2 avec 25 items
  const p2 = paginate(mockImports, 2, 25);
  assert.equal(p2.items.length, 25);
  assert.equal(p2.totalPages, 3);
  assert.equal(p2.items[0].id, "imp-26");

  // Dépassement de borne (page 999 ramenée à la dernière page)
  const pOverflow = paginate(mockImports, 999, 10);
  assert.equal(pOverflow.page, 6);
  assert.equal(pOverflow.items.length, 10);
});

test("Optimisation Historique Imports - Tri par qualité et lignes", () => {
  const mockImports = [
    { id: "1", file_name: "B.csv", quality_score: 80, rows_processed: 100 },
    { id: "2", file_name: "A.csv", quality_score: 99, rows_processed: 50 },
    { id: "3", file_name: "C.csv", quality_score: 70, rows_processed: 500 },
  ];

  const sortedQuality = filterAndSortImports(mockImports, { sortBy: "quality-desc" });
  assert.equal(sortedQuality[0].id, "2"); // 99%
  assert.equal(sortedQuality[1].id, "1"); // 80%
  assert.equal(sortedQuality[2].id, "3"); // 70%

  const sortedRows = filterAndSortImports(mockImports, { sortBy: "rows-desc" });
  assert.equal(sortedRows[0].id, "3"); // 500 lignes
  assert.equal(sortedRows[1].id, "1"); // 100 lignes
  assert.equal(sortedRows[2].id, "2"); // 50 lignes

  const sortedName = filterAndSortImports(mockImports, { sortBy: "name-asc" });
  assert.equal(sortedName[0].file_name, "A.csv");
  assert.equal(sortedName[1].file_name, "B.csv");
  assert.equal(sortedName[2].file_name, "C.csv");
});
