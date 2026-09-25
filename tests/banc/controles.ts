// Controles communs aux bancs DEMO (verite_demo_modules.json) et jeux generes
// (verite.json) : chaque valeur attendue est calculee hors moteur ; ici on lit
// la meme valeur dans les tables importees, comme la page du module l'affiche.
import { soldesTresorerie } from "../../src/lib/tresorerie.js";
import { indexClients, clientDeCommande } from "../../src/lib/rapprochementClients.js";

export function calculerControle(c: any, t: Record<string, any[]>, kpi: (c: any) => any): any {
  switch (c.type) {
    case "kpi": return kpi(c);
    case "lignes": return (t[c.entite] || []).length;
    case "somme": return Math.round((t[c.entite] || []).reduce((s: number, r: any) => s + (Number(r[c.champ]) || 0), 0) * 100) / 100;
    case "distincts": return new Set((t[c.entite] || []).map((r: any) => r[c.champ]).filter((v: any) => v != null && v !== "")).size;
    case "compte": return (t[c.entite] || []).filter((r: any) => String(r[c.champ] ?? "") === c.valeur).length;
    case "solde": return soldesTresorerie(t.Cashflow || [], t.Transaction || []).soldeActuel;
    case "clients_rattaches": { const ix = indexClients(t.Customer || []); return (t.Order || []).filter((o) => clientDeCommande(o, ix)).length; }
    default: return `type inconnu ${c.type}`;
  }
}

export function libelleControle(c: any): string {
  if (c.type === "kpi") return `kpi ${c.id}${c.entites ? ` (${c.entites.join("+")})` : ""}`;
  if (c.type === "lignes") return `lignes ${c.entite}`;
  if (c.type === "compte") return `compte ${c.entite}.${c.champ} = ${c.valeur}`;
  if (c.type === "solde") return "solde de trésorerie";
  return `${c.type} ${c.entite || ""}.${c.champ || ""}`;
}
