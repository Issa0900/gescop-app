import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Download,
  ArrowRight,
  RotateCcw,
  Copy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import ImportProgress from "@/components/import/ImportProgress";
import PlanConfirmation from "@/components/import/PlanConfirmation";
import DoublonsAVerifier from "@/components/import/DoublonsAVerifier";
import ImportHistory, { RepartitionLignes } from "@/components/import/ImportHistory";
import { motion } from "@/lib/fake-framer-motion.jsx";
import { supprimerImport, MESSAGE_ALERTES } from "@/lib/supprimerImport";
import { ajouterTermes, lireDictionnaire } from "@/lib/dictionnaire";
import { purgerTout } from "@/lib/purge";

const acceptedTypes = ".csv,.xlsx,.xls,.tsv,.pdf";

const ENTITY_OPTIONS = [
  { value: "Transaction", label: "Transactions (revenus/dépenses)" },
  { value: "Order", label: "Commandes (orders)" },
  { value: "ExecutiveSummary", label: "Sommaire exécutif" },
  { value: "Asset", label: "Immobilisations (actifs)" },
  { value: "Customer", label: "Clients (customers)" },
  { value: "Product", label: "Produits (products)" },
  { value: "Inventory", label: "Stocks (inventory)" },
  { value: "Campaign", label: "Campagnes (campaigns)" },
  { value: "CampaignDaily", label: "Campagnes journalières" },
  { value: "Cashflow", label: "Flux de trésorerie" },
  { value: "Expense", label: "Dépenses (expenses)" },
  { value: "Employee", label: "Employés" },
  { value: "Payroll", label: "Paie (payroll)" },
  { value: "Supplier", label: "Fournisseurs" },
  { value: "Purchase", label: "Achats (purchases)" },
  { value: "Interaction", label: "Interactions client" },
  { value: "Competitor", label: "Concurrents" },
  { value: "Goal", label: "Objectifs (goals)" },
  { value: "Event", label: "Événements" },
  { value: "ExternalSignal", label: "Signaux externes (radar)" },
];


export default function ImportPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState(null);
  // L'import se fait en deux temps : on analyse d'abord, l'utilisateur valide
  // la lecture, et seulement ensuite on ecrit. Tant que `analyses` est rempli,
  // rien n'a ete enregistre.
  const [analyses, setAnalyses] = useState(null);
  const [champsParEntite, setChampsParEntite] = useState(null);
  const [requisParEntite, setRequisParEntite] = useState(null);
  const [fichiersEnvoyes, setFichiersEnvoyes] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [purging, setPurging] = useState(false);
  const [manualEntity, setManualEntity] = useState("");
  // Import dont on verifie les doublons potentiels (fenetre ouverte), ou null.
  const [doublonsDe, setDoublonsDe] = useState(null);
  const { company } = useCompany();

  const { data: imports, isLoading } = useQuery({
    queryKey: ["imports"],
    queryFn: async () => {
      const list = await base44.entities.Import.list("-created_date", 200);
      return list || [];
    },
  });

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setUploading(true);
    setAnalyses(null); // Unmount PlanConfirmation immediately so state resets for the new file
    setImportResult(null);
    try {
      const uploadedFiles = [];
      for (const file of files) {
        // Stockage privé : les fichiers financiers des clients ne doivent pas
        // avoir d'URL publique (Loi 25). Les fonctions les lisent par une URL
        // signée de courte durée (base44/shared/fichierPrive.ts).
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        uploadedFiles.push({ file_uri, file_name: file.name });
      }
      setUploading(false);
      setAnalyzing(true);
      const res = await base44.functions.invoke("importMultiData", {
        files: uploadedFiles,
        entity_override: manualEntity || null,
        mode: "analyser",
      });
      const data = res.data || res;
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
        return;
      }
      const lisibles = (data.results || []).filter((r) => r.plan);
      // Les feuilles vides ou illisibles n'ont pas de plan : elles vont
      // directement au recapitulatif, il n'y a rien a confirmer dessus.
      const nonLisibles = (data.results || []).filter((r) => !r.plan);
      if (lisibles.length === 0) {
        setImportResult({ results: nonLisibles });
        toast({ title: "Aucun fichier lisible", variant: "destructive" });
        return;
      }
      setFichiersEnvoyes(uploadedFiles);
      setChampsParEntite(data.champs_par_entite || {});
      setRequisParEntite(data.requis_par_entite || {});
      setAnalyses(lisibles);
    } catch (e) {
      toast({ title: "Erreur: " + (e.response?.data?.error || e.message), variant: "destructive" });
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  /**
   * Les corrections faites sur l'ecran de lecture sont apprises : chaque
   * colonne rattachee a la main rejoint le dictionnaire de l'entreprise, qui
   * est consulte en priorite a chaque import et au retraitement. C'est ce que
   * Parametres > Dictionnaire promettait sans que rien ne l'ecrive.
   */
  const apprendreCorrections = async (plans) => {
    const appris = {};
    for (const plan of Object.values(plans || {})) {
      for (const c of plan?.colonnes || []) {
        if (c.source === "humain" && c.champ) appris[c.colonne] = c.champ;
      }
    }
    if (Object.keys(appris).length === 0) return 0;
    const companies = await base44.entities.Company.list();
    const company = companies?.[0];
    if (!company) return 0;
    // Complète le dictionnaire dans sa forme actuelle : une forme liste
    // (Paramètres) était remplacée par les seuls termes appris.
    const suivant = ajouterTermes(company.company_dictionary, appris);
    if (!suivant) return 0;
    await base44.entities.Company.update(company.id, { company_dictionary: suivant });
    const avant = new Map(lireDictionnaire(company.company_dictionary).map((x) => [x.term.trim().toLowerCase(), x.maps_to]));
    return Object.entries(appris).filter(([k, v]) => avant.get(k.trim().toLowerCase()) !== v).length;
  };

  /**
   * Retraitement sans reimport : les lignes conservees au registre sont relues
   * avec ce que l'application sait maintenant. D'abord une simulation (rien
   * n'est ecrit), puis confirmation.
   */
  const handleRetraiter = async (imp, typeChoisi) => {
    try {
      const corps = { import_id: imp.id, entity_type: typeChoisi || undefined };
      const sim = await base44.functions.invoke("reprocessImport", { ...corps, mode: "simuler" });
      const simu = sim.data || sim;
      if (simu.error) { toast({ title: simu.error, variant: "destructive" }); return; }
      const r = simu.results?.[0] || {};
      if (r.statut === "type_requis") { toast({ title: r.message }); return; }
      if (!simu.recovered) {
        toast({
          title: "Aucune ligne récupérable pour l'instant",
          description: `${r.candidates || 0} ligne(s) en attente restent conservées. Complétez le dictionnaire ou choisissez un autre type, puis réessayez.`,
        });
        return;
      }
      if (!window.confirm(`${simu.recovered} ligne(s) sur ${r.candidates} peuvent être intégrées maintenant${typeChoisi ? ` en tant que ${typeChoisi}` : ""}. Les intégrer ?`)) return;
      const res = await base44.functions.invoke("reprocessImport", corps);
      const data = res.data || res;
      if (data.error) { toast({ title: data.error, variant: "destructive" }); return; }
      toast({ title: `${data.recovered} ligne(s) récupérée(s) sans réimport` });
      qc.invalidateQueries();
    } catch (e) {
      toast({ title: "Erreur: " + (e.response?.data?.error || e.message), variant: "destructive" });
    }
  };

  /** Deuxieme temps : l'utilisateur a valide la lecture, on ecrit fichier par fichier pour éviter les timeouts */
  const lancerImport = async (plans) => {
    setProcessing(true);
    const accumulatedResults = [];
    let totalImported = 0;
    try {
      // Les termes appris servent des cet import, et peuvent debloquer des
      // lignes en attente dans les imports precedents.
      let appris = 0;
      try { appris = await apprendreCorrections(plans); } catch { /* l'apprentissage ne bloque jamais l'import */ }
      for (let i = 0; i < fichiersEnvoyes.length; i++) {
        const file = fichiersEnvoyes[i];
        const filePlans = {};
        for (const [key, p] of Object.entries(plans || {})) {
          if (key === file.file_name || key.startsWith(file.file_name + " [") || key.startsWith(file.file_name)) {
            filePlans[key] = p;
          }
        }
        let fileDone = false;
        let attempt = 0;
        while (!fileDone && attempt < 20) {
          attempt++;
          const res = await base44.functions.invoke("importMultiData", {
            files: [file],
            entity_override: manualEntity || null,
            plans: filePlans,
          });
          const data = res.data || res;
          
          if (data.results) {
            const result = data.results[0];
            const fileRows = data.results.reduce((s, r) => s + (r.rows || 0), 0);
            totalImported += fileRows;
            
            if (result && result.rateLimited) {
               toast({ title: `Reprise automatique en cours...`, description: `Pause de sécurité de 10s pour contourner les limites du serveur. (${fileRows} insérées sur cette passe)` });
               await new Promise(r => setTimeout(r, 10000)); // Attendre 10s que le quota se libère
               continue; // On relance : deduplicateRows ignorera instantanément celles déjà insérées !
            } else {
               accumulatedResults.push(...data.results);
               fileDone = true;
            }
          } else if (data.error) {
            accumulatedResults.push({ file_name: file.file_name, status: "echoue", rows: 0, error: data.error });
            fileDone = true;
          }
        }
      }
      setAnalyses(null);
      setImportResult({ results: accumulatedResults });
      const okCount = accumulatedResults.filter((r) => r.status === "complete").length;
      let recuperees = 0;
      if (appris > 0) {
        try {
          const rep = await base44.functions.invoke("reprocessImport", { tous: true });
          recuperees = (rep.data || rep).recovered || 0;
        } catch { /* le retraitement reste disponible depuis l'historique */ }
      }
      toast({
        title: "Import terminé",
        description: `${okCount}/${accumulatedResults.length} fichiers traités, ${totalImported} lignes importées`
          + (appris > 0 ? ` · ${appris} correction(s) apprise(s) dans le dictionnaire` : "")
          + (recuperees > 0 ? ` · ${recuperees} ligne(s) d'imports précédents récupérée(s)` : ""),
      });
      qc.invalidateQueries();
    } catch (e) {
      toast({ title: "Erreur: " + (e.response?.data?.error || e.message), variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const annulerAnalyse = () => {
    setAnalyses(null);
    setFichiersEnvoyes([]);
  };

  /**
   * Delete an import AND the records it created.
   *
   * The journal entry is the ONLY link between a row and the file it came from,
   * so it must never be removed while rows still point at it. The previous
   * version deleted it unconditionally: if the cascade matched nothing — an
   * import whose entity_type was empty (it silently fell back to "Transaction"),
   * an entity the client does not expose, or a partial server-side delete — the
   * import vanished from the list, the rows stayed, and the toast still said
   * "supprimés". Those rows then became unreachable: nothing pointed to them
   * any more, and only the global purge could clear them.
   *
   * Now: delete, verify, and keep the journal entry if anything survives —
   * Observations included (src/lib/supprimerImport.js).
   */
  const handleDelete = async (imp) => {
    const entityName = imp.entity_type;
    // Import d'une feuille au type non reconnu : aucune donnee metier, seulement
    // ses lignes brutes dans le registre. Rien ne peut rester orphelin.
    const quarantaine = !entityName && imp.status === "quarantaine";
    if (!quarantaine && (!entityName || !base44.entities[entityName])) {
      toast({
        title: "Suppression impossible",
        description: `Cet import ne précise pas de type d'entité valide (${entityName || "vide"}). `
          + "Le supprimer laisserait ses données sans rattachement. Utilisez « Tout supprimer » si vous voulez repartir de zéro.",
        variant: "destructive",
      });
      return;
    }
    const question = quarantaine
      ? `Supprimer cet import effacera aussi ses ${imp.rows_quarantined || 0} ligne(s) conservée(s) telles quelles. Continuer ?`
      : `Supprimer cet import effacera aussi tous les enregistrements ${entityName} associés. Continuer ?`;
    if (!window.confirm(question)) return;

    try {
      // Lignes, Observations (le moteur KPI s'en sert), registre, puis
      // l'import — avec verification (src/lib/supprimerImport.js).
      const r = await supprimerImport(base44.entities, imp);
      qc.invalidateQueries();
      if (r.statut === "incomplet") {
        // L'import est conserve pour que les lignes restent atteignables.
        toast({
          title: "Suppression incomplète",
          description: `${r.supprimes} enregistrement(s) ${entityName} supprimé(s), mais il reste `
            + `${r.restants ? "des enregistrements" : "des observations"}. `
            + "L'import a été conservé pour que vous puissiez relancer la suppression — sinon ces lignes deviendraient introuvables.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: quarantaine
          ? "Import supprimé · lignes conservées effacées"
          : `Import supprimé · ${r.supprimes} enregistrement(s) ${entityName} effacé(s)`,
        // Les alertes d'analyse portent sur l'ensemble des donnees et ne sont
        // reliees a aucun import : elles ne sont pas effacees ici.
        description: quarantaine ? undefined : MESSAGE_ALERTES,
      });
    } catch (e) {
      toast({ title: "Erreur: " + e.message, variant: "destructive" });
    }
  };

  const handlePurgeAll = async () => {
    // Un import en cours continuerait d'ecrire apres la purge : on attend sa fin.
    if (uploading || analyzing || processing) {
      toast({ title: "Un import est en cours", description: "Attendez sa fin avant de tout supprimer.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Cela supprimera DÉFINITIVEMENT toutes vos transactions, KPI, anomalies, risques, opportunités et recommandations. Continuer ?")) return;
    try {
      setPurging(true);
      // Chaque table est videe, relue et revidee tant qu'il en reste ; le
      // bilan dit exactement ce qui resterait (src/lib/purge.js).
      const bilan = await purgerTout(base44.entities, { company });
      qc.invalidateQueries();
      if (bilan.complet) {
        toast({
          title: "Toutes les données ont été purgées",
          description: bilan.entreprise ? "Le score de santé de la fiche entreprise n'a pas pu être remis à « non mesuré »." : undefined,
        });
      } else {
        toast({
          title: "Purge incomplète",
          description: `Il reste des données dans : ${bilan.restantes.join(", ")}. Relancez « Tout supprimer ».`
            + (Object.keys(bilan.erreurs).length ? ` Erreur : ${Object.values(bilan.erreurs)[0]}` : ""),
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Erreur: " + e.message, variant: "destructive" });
    } finally {
      setPurging(false);
    }
  };


  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Importer des données</h1>
        <p className="mt-2 text-slate-600">
          Téléversez vos fichiers (CSV, Excel, PDF). L'IA extrait et normalise automatiquement vos données.
        </p>
      </div>

      {/* Manual entity type selector */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="shrink-0">
            <Label htmlFor="entity-select" className="text-sm font-semibold text-slate-900">Type de données cible</Label>
            <p className="mt-1 text-xs text-slate-500">Choisissez le type si la détection automatique échoue souvent</p>
          </div>
          <Select value={manualEntity} onValueChange={setManualEntity}>
            <SelectTrigger id="entity-select" className="sm:w-80 bg-slate-50">
              <SelectValue placeholder="Détection automatique (recommandé)" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Drop zone */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
          dragOver ? "border-primary bg-primary/5 shadow-inner" : "border-slate-300 bg-white hover:border-primary/50 hover:bg-slate-50"
        }`}
      >
        {uploading || analyzing || processing ? (
          <ImportProgress phase={uploading ? "uploading" : analyzing ? "analyzing" : "processing"} />
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${dragOver ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500'}`}>
              <Upload className="h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">Glissez vos fichiers ici ou cliquez pour parcourir</p>
              <p className="mt-1.5 text-sm text-slate-500">Support: CSV, XLSX, XLS, TSV, PDF (texte sélectionnable)</p>
            </div>
            <label>
              <input
                type="file"
                accept={acceptedTypes}
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = null;
                }}
              />
              <span className="inline-flex cursor-pointer items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
                Parcourir les fichiers
              </span>
            </label>
          </div>
        )}
      </motion.div>

      {/* Entre la lecture et l'ecriture : l'utilisateur valide ce qui a ete compris. */}
      {analyses && !importResult ? (
        <PlanConfirmation
          analyses={analyses}
          champsParEntite={champsParEntite}
          requisParEntite={requisParEntite}
          entityOptions={ENTITY_OPTIONS}
          onConfirmer={lancerImport}
          onAnnuler={annulerAnalyse}
          enCours={processing}
        />
      ) : null}

      {importResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold text-emerald-900">Import multi-fichiers terminé</h2>
          </div>
          <div className="overflow-x-auto rounded-lg border border-emerald-200">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="bg-emerald-100/50 text-left text-xs uppercase text-emerald-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Fichier / feuille</th>
                  <th className="px-4 py-2 font-medium">Entité</th>
                  <th className="px-4 py-2 font-medium">Lues</th>
                  <th className="px-4 py-2 font-medium">Importées</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {(importResult.results || []).map((r, i) => (
                  <tr key={i}>
                    <td className="max-w-[200px] px-4 py-2 font-medium">
                      <span className="block truncate" title={r.file_name}>{r.file_name}</span>
                      {r.metrics && <RepartitionLignes m={r.metrics} />}
                      {(r.message || r.error) && (
                        <span className="mt-0.5 block text-xs font-normal text-amber-700">{r.message || r.error}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.entity || "—"}
                      {r.detected_via && <span className="ml-1 text-xs">({r.detected_via})</span>}
                    </td>
                    <td className="px-4 py-2">{r.rows_read ?? "—"}</td>
                    <td className="px-4 py-2">
                      {r.rows || 0}
                      {r.quarantined > 0 && <span className="ml-1 text-xs text-amber-700">+{r.quarantined} rejetées</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={r.status === "complete" ? "text-emerald-600" : r.status === "ignore" ? "text-muted-foreground" : r.status === "quarantaine" ? "text-amber-600" : "text-red-600"}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild><Link to="/">Commencer l'analyse IA <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
            <Button variant="outline" onClick={() => setImportResult(null)}>Fermer</Button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <FileSpreadsheet className="mb-2 h-5 w-5 text-emerald-600" />
          <p className="text-sm font-medium">Tableurs</p>
          <p className="text-xs text-muted-foreground">Colonnes: date, description, montant, type, catégorie</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <FileText className="mb-2 h-5 w-5 text-red-600" />
          <p className="text-sm font-medium">PDF texte</p>
          <p className="text-xs text-muted-foreground">Relevés bancaires, factures en PDF natif</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <CheckCircle2 className="mb-2 h-5 w-5 text-blue-600" />
          <p className="text-sm font-medium">Normalisation auto</p>
          <p className="text-xs text-muted-foreground">Détection des types, doublons et devises</p>
        </div>
      </div>

      {/* Import history optimisé */}
      <ImportHistory
        imports={imports}
        isLoading={isLoading}
        onDelete={handleDelete}
        onRetraiter={handleRetraiter}
        onDoublons={(imp) => setDoublonsDe(imp)}
        entityOptions={ENTITY_OPTIONS}
      />

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50/30 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">Purger toutes les données</p>
            <p className="mt-1 text-sm text-red-700">
              Supprime définitivement toutes vos données importées ainsi que les KPI, anomalies, risques,
              opportunités et recommandations produits par l'analyse. Irréversible.
            </p>
          </div>
          <Button variant="destructive" onClick={handlePurgeAll} disabled={purging || uploading || analyzing || processing}>
            {purging ? "Purge en cours…" : "Tout supprimer"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">Astuce</p>
        <p className="mt-1 text-blue-700">
          Après l'import, allez au tableau de bord et lancez l'analyse IA pour obtenir votre score de santé,
          vos KPI, vos risques et vos recommandations.{" "}
          <Link to="/" className="font-medium underline">Aller au tableau de bord →</Link>
        </p>
      </div>
      <DoublonsAVerifier imp={doublonsDe} onClose={() => setDoublonsDe(null)} />
    </motion.div>
  );
}
