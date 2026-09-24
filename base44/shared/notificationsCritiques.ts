// Courriel « anomalie critique » / « risque majeur ».
//
// Les deux workflows Base44 prévus pour cela ne pouvaient pas fonctionner :
// analyzeBusiness crée anomalies et risques par bulkCreate, qui ne déclenche
// pas les automatisations d'entité, et un workflow appelle la fonction sans
// session utilisateur (401). La notification part donc d'analyzeBusiness, qui
// a la session de l'utilisateur.
//
// Règle décidée par Issa (24 sept. 2026) : on n'écrit que pour un élément
// NOUVEAU — même titre non notifié depuis JOURS_NOUVEAUTE jours. Les anomalies
// sont recréées à chaque analyse ; sans cette règle, chaque analyse renverrait
// le même courriel. La mémoire est l'alerte in-app que crée chaque
// notification (catégorie "anomaly" ou "risk"), qui survit aux analyses.

export const JOURS_NOUVEAUTE = 30;

export type TypeCritique = "anomaly" | "risk";

/** Même titre à la casse, aux accents et aux espaces près. */
export function cleTitre(titre: unknown): string {
  return String(titre ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

export function estCritique(type: TypeCritique, rec: any): boolean {
  return type === "anomaly" ? rec?.severity === "critique" : rec?.urgency === "elevee";
}

/**
 * Éléments critiques à notifier : critiques, avec un titre, pas deux fois le
 * même titre dans la même analyse, et pas déjà notifiés dans la fenêtre.
 * Une alerte de notification sans date lisible compte comme récente : dans le
 * doute on n'écrit pas deux fois.
 */
export function aNotifier(
  type: TypeCritique,
  elements: any[],
  alertesExistantes: any[],
  maintenant: Date = new Date(),
  jours: number = JOURS_NOUVEAUTE,
): any[] {
  const limite = maintenant.getTime() - jours * 86_400_000;
  const dejaVus = new Set(
    (alertesExistantes || [])
      .filter((a) => a?.category === type)
      .filter((a) => {
        const t = Date.parse(a?.created_date || "");
        return Number.isNaN(t) || t >= limite;
      })
      .map((a) => cleTitre(a.title)),
  );
  const retenus: any[] = [];
  for (const e of elements || []) {
    const cle = cleTitre(e?.title);
    if (!cle || !estCritique(type, e) || dejaVus.has(cle)) continue;
    dejaVus.add(cle);
    retenus.push(e);
  }
  return retenus;
}

export function composerCourriel(type: TypeCritique, record: any) {
  const title = record.title;
  const description = record.description;
  const detail = type === "anomaly" ? record.explanation : record.category;
  const financial_impact = Number(record.financial_impact) || 0;
  const impactStr = financial_impact
    ? `Impact financier estimé: ${financial_impact > 0 ? "+" : ""}${Math.round(financial_impact).toLocaleString("fr-CA")} $`
    : "";
  const typeLabel = type === "anomaly" ? "Anomalie critique" : "Risque majeur";
  const subject = `[GESCOP] ${typeLabel} détectée : ${title}`;
  const body = [
    `Bonjour,`,
    ``,
    `GESCOP a détecté un élément nécessitant votre attention immédiate :`,
    ``,
    `Type: ${typeLabel}`,
    `Titre: ${title}`,
    description ? `Description: ${description}` : "",
    detail ? `Détails: ${detail}` : "",
    impactStr,
    ``,
    `Connectez-vous à votre tableau de bord GESCOP pour consulter les détails et les actions recommandées.`,
    ``,
    `Cordialement,`,
    `L'équipe GESCOP`,
  ].filter(Boolean).join("\n");
  return { subject, body, typeLabel, message: description || detail || typeLabel };
}

/**
 * Envoie le courriel au propriétaire et crée l'alerte in-app qui sert de
 * mémoire. `destinataire` vient toujours de la session ou de l'enregistrement
 * relu, jamais d'un corps de requête.
 */
export async function notifier(base44: any, type: TypeCritique, record: any, destinataire: { id: string; email: string }) {
  const c = composerCourriel(type, record);
  await base44.asServiceRole.integrations.Core.SendEmail({ to: destinataire.email, subject: c.subject, body: c.body });
  await base44.asServiceRole.entities.Alert.create({
    title: record.title,
    message: c.message,
    level: "critique",
    category: type,
    status: "non_lue",
    link_type: type,
    link_id: record.id || undefined,
    created_by_id: destinataire.id,
  });
}

/**
 * Depuis analyzeBusiness : notifie les anomalies critiques et risques
 * d'urgence élevée nouveaux. Une panne d'envoi n'interrompt pas l'analyse.
 */
export async function notifierNouveautes(
  base44: any,
  user: { id: string; email?: string },
  anomalies: any[],
  risques: any[],
  maintenant: Date = new Date(),
): Promise<{ envoyes: number; erreurs: string[] }> {
  const erreurs: string[] = [];
  if (!user?.email) return { envoyes: 0, erreurs: ["utilisateur sans adresse courriel"] };
  let existantes: any[] = [];
  try {
    existantes = await base44.entities.Alert.filter({ category: { $in: ["anomaly", "risk"] } }, "-created_date", 1000);
  } catch (e: any) {
    // Sans mémoire, on ne peut pas savoir ce qui est nouveau : on n'écrit pas.
    return { envoyes: 0, erreurs: [`lecture des alertes impossible : ${e?.message || e}`] };
  }
  const lots: [TypeCritique, any[]][] = [
    ["anomaly", aNotifier("anomaly", anomalies, existantes, maintenant)],
    ["risk", aNotifier("risk", risques, existantes, maintenant)],
  ];
  let envoyes = 0;
  for (const [type, elements] of lots) {
    for (const e of elements) {
      try {
        await notifier(base44, type, e, { id: user.id, email: user.email });
        envoyes += 1;
      } catch (err: any) {
        erreurs.push(`${e.title} : ${err?.message || err}`);
      }
    }
  }
  return { envoyes, erreurs };
}
