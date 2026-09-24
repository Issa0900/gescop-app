// Fichiers téléversés par l'utilisateur (ventes, paie, trésorerie).
//
// Depuis le 24 sept. 2026, l'écran Importer les envoie en stockage PRIVÉ
// (`Core.UploadPrivateFile`, qui rend un `file_uri`) : un lien public vers les
// données financières d'un client contredisait la mention Loi 25 de l'app.
// Les fonctions ne lisent le fichier qu'à travers une URL signée de courte
// durée, créée au moment de la lecture. Les anciens imports, dont `file_url`
// est une URL publique, restent lisibles tels quels.

/** Durée de validité de l'URL signée : le temps de lire le fichier, pas plus. */
export const DUREE_URL_SIGNEE_S = 600;

export interface FichierEnvoye {
  file_uri?: string;
  file_url?: string;
  file_name?: string;
}

/**
 * URL à utiliser pour LIRE le fichier. `file_uri` (privé) est signé avec le
 * client de l'utilisateur, jamais en rôle service : Base44 ne signe ainsi que
 * les fichiers auxquels cet utilisateur a droit.
 */
export async function urlDeLecture(base44: any, fichier: FichierEnvoye): Promise<string> {
  const uri = typeof fichier?.file_uri === "string" ? fichier.file_uri.trim() : "";
  if (uri) {
    const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: DUREE_URL_SIGNEE_S });
    const signee = res?.signed_url || res?.data?.signed_url;
    if (!signee) throw new Error("Lien de lecture du fichier privé non obtenu");
    return signee;
  }
  const url = typeof fichier?.file_url === "string" ? fichier.file_url.trim() : "";
  if (url) return url;
  throw new Error("Fichier sans file_uri ni file_url");
}

/**
 * Ce qui est conservé sur l'import (`Import.file_url`) : l'URI privée, qui
 * n'ouvre rien sans signature, ou l'URL d'un ancien import. Jamais l'URL
 * signée, qui donnerait accès au fichier à quiconque lit l'enregistrement.
 */
export function referenceFichier(fichier: FichierEnvoye): string {
  return String(fichier?.file_uri || fichier?.file_url || "").trim();
}
