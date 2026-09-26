export const ADMIN_EMAILS = [
  "issaouedraogo0900@gmail.com",
];

export const VALID_PILOT_CODES = [
  "PILOTE2026",
  "PILOTE",
  "PILOT2026",
  "GESCOP-VIP",
  "VIP-GESCOP",
  "PILOTE-PRO",
];

/**
 * Calcule la date d'expiration exacte d'un mois gratuit à partir de la date de départ.
 * Gère correctement les mois de 28, 29, 30 ou 31 jours sans déborder sur le mois suivant.
 * Exemples :
 * - 26 septembre -> 26 octobre
 * - 31 janvier -> 28 février (ou 29 en bissextile)
 * - 31 mars -> 30 avril
 *
 * @param {Date|string|number} [startDate=new Date()]
 * @returns {Date}
 */
export function computePilotExpirationDate(startDate = new Date()) {
  const start = new Date(startDate);
  const target = new Date(start.getTime());
  target.setMonth(target.getMonth() + 1);
  if (target.getDate() !== start.getDate()) {
    target.setDate(0); // repli sur le dernier jour du mois en cas de décalage de fin de mois
  }
  return target;
}

/**
 * Évalue la validité d'un accès pilote (expiration après 1 mois)
 * @param {string|null} expiresAtStr Date ISO d'expiration
 * @param {number} [currentTime=Date.now()] Horodatage courant
 * @returns {{ isValid: boolean, isExpired: boolean, daysRemaining: number }}
 */
export function checkPilotValidity(expiresAtStr, currentTime = Date.now()) {
  if (!expiresAtStr) {
    return { isValid: false, isExpired: false, daysRemaining: 0 };
  }
  const expTime = new Date(expiresAtStr).getTime();
  if (isNaN(expTime)) {
    return { isValid: false, isExpired: false, daysRemaining: 0 };
  }
  const diffMs = expTime - currentTime;
  const isExpired = diffMs <= 0;
  const isValid = diffMs > 0;
  const daysRemaining = isValid ? Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24))) : 0;

  return { isValid, isExpired, daysRemaining };
}
