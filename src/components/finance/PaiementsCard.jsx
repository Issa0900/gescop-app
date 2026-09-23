import React from "react";

const PAYE = /(paid|paye|payé|regle|réglé|encaisse|encaissé|complete|success|succes|succès)/i;
const ECHEC = /(fail|echec|échec|refus|declin|rejet|annul|cancel)/i;
const ATTENTE = /(pending|attente|en cours|processing|unpaid|impaye|impayé)/i;

export const statutPaiement = (p) =>
  ECHEC.test(p.status || "") ? "Échoué" : ATTENTE.test(p.status || "") ? "En attente" : PAYE.test(p.status || "") ? "Payé" : "Autre";

/**
 * Encaissements (entite Payment) : repartition par statut, et part des
 * commandes importees qui ont un paiement confirme (Payment.order_id ->
 * Order.order_id).
 */
export default function PaiementsCard({ payments, orders }) {
  const lignes = payments || [];
  if (lignes.length === 0) return null;
  const parStatut = lignes.reduce((acc, p) => { const s = statutPaiement(p); acc[s] = (acc[s] || 0) + 1; return acc; }, {});
  const payes = lignes.filter((p) => statutPaiement(p) === "Payé");
  const avecMontant = lignes.some((p) => p.amount !== undefined && p.amount !== null && p.amount !== "");
  const montant = payes.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const commandes = new Set((orders || []).map((o) => String(o.order_id)));
  const couvertes = [...new Set(payes.filter((p) => p.order_id != null).map((p) => String(p.order_id)))].filter((id) => commandes.has(id)).length;
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Encaissements</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["Payé", "En attente", "Échoué", "Autre"].filter((s) => parStatut[s]).map((s) => (
          <div key={s}>
            <p className="text-xs text-muted-foreground">{s}</p>
            <p className="text-xl font-bold tabular-nums">{parStatut[s].toLocaleString("fr-CA")}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {avecMontant ? `${Math.round(montant).toLocaleString("fr-CA")} $ encaissés. ` : ""}
        {commandes.size > 0
          ? `${couvertes.toLocaleString("fr-CA")} commande(s) sur ${commandes.size.toLocaleString("fr-CA")} ont un paiement confirmé (${Math.round((couvertes / commandes.size) * 100)} %).`
          : "Importez les commandes pour savoir lesquelles sont encaissées."}
      </p>
    </div>
  );
}
