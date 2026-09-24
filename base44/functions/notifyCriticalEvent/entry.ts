import { createFixedClientFromRequest as createClientFromRequest } from "../../shared/client.ts";
import { notifier, aNotifier } from "../../shared/notificationsCritiques.ts";

const ENTITY_NAMES: Record<string, string> = { anomaly: "Anomaly", risk: "Risk" };

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Sans session, le SDK leve une exception au lieu de rendre null : c'etait
    // un 500. Un appel sans utilisateur (workflow, webhook, inconnu) recoit un
    // 401 explicite. Base44 ne documente aucun moyen de prouver qu'un appel
    // vient d'un workflow de l'app (le jeton de service est ajoute a TOUT
    // appel par la plateforme) : on ne fait donc confiance a aucun appel
    // anonyme, ni a un user_id du corps (voir qa/COMPTE-RENDU.md, lot 1.3).
    let caller: any = null;
    try {
      caller = await base44.auth.me();
    } catch {
      caller = null;
    }
    if (!caller) return Response.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { entity_type, entity_id } = body;

    const entityName = ENTITY_NAMES[entity_type];
    if (!entityName || !entity_id) {
      return Response.json({ error: "entity_type et entity_id requis" }, { status: 400 });
    }

    // Re-fetch the record through the CALLER's own client (not asServiceRole):
    // Anomaly/Risk RLS only allows reading rows the caller created, so this
    // fails for any entity_id the caller doesn't own. That's what closes the
    // IDOR — user_id, title, description, detail and financial_impact all
    // used to be taken straight from the request body, letting any
    // authenticated caller pick an arbitrary user_id to email and to plant a
    // fake "risque majeur"/"anomalie critique" alert on. Now the recipient
    // and the notification content both come only from the verified record.
    let record;
    try {
      record = await base44.entities[entityName].get(entity_id);
    } catch {
      record = null;
    }
    if (!record || record.created_by_id !== caller.id) {
      return Response.json({ error: "Introuvable" }, { status: 404 });
    }

    const user = await base44.asServiceRole.entities.User.get(caller.id);
    if (!user || !user.email) {
      return Response.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Meme regle que les notifications envoyees par analyzeBusiness : seulement
    // un element nouveau (meme titre non notifie depuis 30 jours), et meme
    // courriel + alerte-memoire (shared/notificationsCritiques.ts).
    const dejaNotifiees = await base44.entities.Alert.filter({ category: entity_type }, "-created_date", 1000);
    if (aNotifier(entity_type, [record], dejaNotifiees || []).length === 0) {
      return Response.json({ success: true, envoye: false, motif: "déjà notifié récemment ou non critique" });
    }
    await notifier(base44, entity_type, record, { id: caller.id, email: user.email });

    return Response.json({ success: true, envoye: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
