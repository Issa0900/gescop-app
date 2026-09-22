import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Copy } from "lucide-react";

/**
 * Doublons potentiels d'un import, a verifier par un humain.
 *
 * Regle du 22 sept 2026 : deux lignes strictement identiques sans identifiant
 * sont importees toutes les deux et signalees — elles peuvent etre deux ventes
 * reelles. Ici, l'utilisateur tranche ligne par ligne :
 *   « Exclure » : c'est un doublon, une copie sort des donnees et des KPI
 *                 (la ligne brute reste au registre, la decision est tracee) ;
 *   « Conserver » : ce sont des faits reels, le signalement est clos.
 */
export default function DoublonsAVerifier({ imp, onClose }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [enCours, setEnCours] = useState(null);

  const { data: signalements = [], isLoading, refetch } = useQuery({
    queryKey: ["doublons-a-verifier", imp?.id],
    enabled: Boolean(imp?.id),
    queryFn: async () => {
      const rows = await base44.entities.ImportIssue.filter({ import_id: imp.id, row_status: "DUPLICATE_EXACT" });
      return (rows || [])
        .filter((r) => !r.review_status || r.review_status === "A_VERIFIER")
        .sort((a, b) => (a.row_number || 0) - (b.row_number || 0));
    },
  });

  const decider = async (issue, decision) => {
    setEnCours(issue.id);
    try {
      const res = await base44.functions.invoke("resolveDuplicate", { issue_id: issue.id, decision });
      const data = res.data || res;
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        toast({
          title: decision === "exclure"
            ? `Ligne ${issue.row_number ?? ""} exclue des données — ligne brute conservée au registre`
            : `Ligne ${issue.row_number ?? ""} conservée comme ligne réelle`,
        });
        qc.invalidateQueries();
      }
      await refetch();
    } catch (e) {
      toast({ title: "Erreur: " + (e.response?.data?.error || e.message), variant: "destructive" });
    } finally {
      setEnCours(null);
    }
  };

  const valeurs = (issue) => {
    try {
      return Object.entries(JSON.parse(issue.raw_row || "{}")).filter(([, v]) => String(v ?? "").trim() !== "").slice(0, 8);
    } catch {
      return [];
    }
  };

  return (
    <Dialog open={Boolean(imp)} onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" /> Doublons potentiels à vérifier
          </DialogTitle>
          <DialogDescription>
            Ces lignes sont strictement identiques à une autre ligne de « {imp?.file_name} », sans identifiant pour
            prouver qu'il s'agit d'un doublon. Elles ont été importées pour ne perdre aucune donnée. Excluez celles qui
            sont de vraies répétitions ; conservez celles qui sont des faits réels (par exemple deux ventes identiques).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : signalements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun doublon potentiel en attente pour cet import.</p>
        ) : (
          <ul className="space-y-3">
            {signalements.map((issue) => (
              <li key={issue.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">
                  Ligne {issue.row_number ?? "?"}
                  <span className="ml-2 font-normal text-muted-foreground">{issue.detail}</span>
                </p>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  {valeurs(issue).map(([k, v]) => (
                    <div key={k} className="flex min-w-0 gap-1">
                      <dt className="shrink-0 text-muted-foreground">{k} :</dt>
                      <dd className="truncate" title={String(v)}>{String(v)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={enCours === issue.id} onClick={() => decider(issue, "conserver")}>
                    Conserver (ligne réelle)
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={enCours === issue.id}
                    onClick={() => {
                      if (window.confirm(`Exclure la ligne ${issue.row_number ?? ""} des données et des indicateurs ? Sa ligne brute restera conservée dans le registre de l'import.`)) {
                        decider(issue, "exclure");
                      }
                    }}
                  >
                    Exclure (doublon)
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
