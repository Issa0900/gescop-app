// Statuts et taxonomie des rejets de l'import (directives §1, §9, §19, §20).
//
// Chaque ligne d'un fichier finit dans exactement UN de ces etats, et toute
// ligne qui n'entre pas dans les donnees laisse une trace (ImportIssue) avec un
// motif precis : jamais un simple « donnees invalides ». Le registre sert ensuite
// a retraiter sans reimporter (Phase 3).

/** Ce qu'est une ligne du fichier. */
export const ROW_STATUS = {
  /** Ecrite dans l'entite cible. */
  VALID: "VALID",
  /** Ecartee pour une raison corrigeable : champ manquant, valeur illisible... Retraitable. */
  QUARANTINED: "QUARANTINED",
  /** Copie d'une ligne deja presente : exclue par regle, pas une erreur de donnee. */
  DUPLICATE: "DUPLICATE",
  /** Total, sous-total, moyenne : exclue des faits, conservee dans l'audit (§10). */
  SUMMARY_ROW: "SUMMARY_ROW",
  /** Ligne que le plan de lecture a demande d'ignorer (commentaire, titre...). */
  IGNORED_ROW: "IGNORED_ROW",
  /** Lisible, mais le type de la feuille est inconnu : conservee brute (§2). */
  UNKNOWN: "UNKNOWN",
  /**
   * Importee (elle compte parmi les VALID), mais une valeur merite un regard :
   * montant negatif, valeur tres eloignee du reste (§8). Entree d'audit seulement.
   */
  ANOMALOUS: "ANOMALOUS",
  /**
   * Importee (VALID) mais strictement identique a une autre ligne du meme
   * fichier, sans identifiant pour trancher : doublon POTENTIEL, conserve et
   * signale — exclu seulement si une preuve le demontre (regle du 22 sept 2026).
   */
  DUPLICATE_EXACT: "DUPLICATE_EXACT",
} as const;
export type RowStatus = typeof ROW_STATUS[keyof typeof ROW_STATUS];

/** Pourquoi une ligne n'est pas entree dans les donnees (§19). */
export const REASON = {
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_DATE: "INVALID_DATE",
  INVALID_NUMERIC_VALUE: "INVALID_NUMERIC_VALUE",
  INVALID_ENUM_VALUE: "INVALID_ENUM_VALUE",
  DUPLICATE_RECORD: "DUPLICATE_RECORD",
  SUMMARY_ROW: "SUMMARY_ROW",
  IGNORED_BY_PLAN: "IGNORED_BY_PLAN",
  UNKNOWN_CONCEPT: "UNKNOWN_CONCEPT",
  STORAGE_REJECTED: "STORAGE_REJECTED",
  RATE_LIMITED: "RATE_LIMITED",
  TECHNICAL_PARSE_ERROR: "TECHNICAL_PARSE_ERROR",
  ANOMALOUS_VALUE: "ANOMALOUS_VALUE",
  DUPLICATE_EXACT: "DUPLICATE_EXACT",
  /** Meme identifiant metier qu'une ligne deja retenue, avec d'autres valeurs. */
  CONFLICTING_RECORD: "CONFLICTING_RECORD",
} as const;
export type ReasonCode = typeof REASON[keyof typeof REASON];

/** Libelles montrables a l'utilisateur. */
export const REASON_LABEL: Record<ReasonCode, string> = {
  MISSING_REQUIRED_FIELD: "champ obligatoire absent",
  INVALID_DATE: "date illisible",
  INVALID_NUMERIC_VALUE: "nombre illisible",
  INVALID_ENUM_VALUE: "valeur hors liste",
  DUPLICATE_RECORD: "doublon",
  SUMMARY_ROW: "ligne de total",
  IGNORED_BY_PLAN: "ignorée par le plan de lecture",
  UNKNOWN_CONCEPT: "type de feuille non reconnu",
  STORAGE_REJECTED: "refusée à l'enregistrement",
  RATE_LIMITED: "limite de débit atteinte",
  TECHNICAL_PARSE_ERROR: "fichier illisible",
  ANOMALOUS_VALUE: "valeur inhabituelle",
  DUPLICATE_EXACT: "doublon potentiel (ligne identique)",
  CONFLICTING_RECORD: "conflit : même identifiant, valeurs différentes",
};

/** Ou en est la recuperation d'une ligne ecartee (§17, §18). */
export const RECOVERY = {
  /** Peut etre retraitee (Phase 3) quand la reconnaissance ou le dictionnaire progresse. */
  PENDING: "PENDING",
  RECOVERED: "RECOVERED",
  /** Retraitee sans succes : l'erreur est dans la donnee elle-meme. */
  CONFIRMED_INVALID: "CONFIRMED_INVALID",
  /** Doublon, total : rien a recuperer. */
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;
export type RecoveryStatus = typeof RECOVERY[keyof typeof RECOVERY];

const RECUPERABLE: ReasonCode[] = [
  REASON.MISSING_REQUIRED_FIELD, REASON.INVALID_DATE, REASON.INVALID_NUMERIC_VALUE,
  REASON.INVALID_ENUM_VALUE, REASON.UNKNOWN_CONCEPT, REASON.STORAGE_REJECTED, REASON.RATE_LIMITED,
  // Un conflit depend de la regle d'identification : quand elle progresse
  // (payroll_id prioritaire, cle composee prouvee par le fichier), la ligne
  // doit pouvoir etre relue. Encore en conflit -> elle reste en attente.
  REASON.CONFLICTING_RECORD,
];

export function recoveryInitial(reason: ReasonCode): RecoveryStatus {
  return RECUPERABLE.includes(reason) ? RECOVERY.PENDING : RECOVERY.NOT_APPLICABLE;
}

/** Une ligne ecartee, telle qu'elle est enregistree dans ImportIssue. */
export interface ImportIssueRecord {
  import_id: string;
  file_name: string;
  entity_type: string | null;
  row_number: number | null;
  row_status: RowStatus;
  reason_code: ReasonCode;
  field?: string;
  raw_value?: string;
  detail?: string;
  raw_row: string;
  mapped_row?: string;
  recovery_status: RecoveryStatus;
  /** Doublon potentiel : decision humaine (A_VERIFIER, EXCLU, CONSERVE). */
  review_status?: "A_VERIFIER" | "EXCLU" | "CONSERVE";
}

/** Les chiffres d'un import (§20). Invariant : total_rows = somme des statuts. */
export interface ImportMetrics {
  total_rows: number;
  valid_rows: number;
  quarantined_rows: number;
  duplicate_rows: number;
  summary_rows: number;
  ignored_rows: number;
  unknown_rows: number;
  recovered_rows: number;
  unknown_fields: string[];
  fallback_values: number;
  derived_values: number;
  /** Valeurs importees mais signalees : negatives, tres eloignees (§8). */
  anomalous_values: number;
  /** Lignes identiques a une autre du fichier, conservees et signalees. */
  potential_duplicates: number;
  reasons: Partial<Record<ReasonCode, number>>;
}

export function metriquesVides(): ImportMetrics {
  return {
    total_rows: 0, valid_rows: 0, quarantined_rows: 0, duplicate_rows: 0, summary_rows: 0,
    ignored_rows: 0, unknown_rows: 0, recovered_rows: 0, unknown_fields: [],
    fallback_values: 0, derived_values: 0, anomalous_values: 0, potential_duplicates: 0, reasons: {},
  };
}

/**
 * Motif precis d'une ligne a laquelle manquent des champs obligatoires.
 *
 * « champ absent » n'est vrai que si le fichier n'avait rien a cet endroit. Si
 * une valeur etait la mais n'a pas pu etre lue, c'est elle qu'il faut nommer :
 * sinon l'utilisateur cherche une colonne qui est pourtant dans son fichier.
 */
export function motifChampManquant(
  champ: string,
  valeurBrute: any,
  typeChamp: any,
  valeurRefusee?: { value: string },
): { reason: ReasonCode; raw_value?: string } {
  if (valeurRefusee) return { reason: REASON.INVALID_ENUM_VALUE, raw_value: valeurRefusee.value };
  const presente = valeurBrute !== undefined && valeurBrute !== null && String(valeurBrute).trim() !== "";
  if (!presente) return { reason: REASON.MISSING_REQUIRED_FIELD };
  const brute = String(valeurBrute).slice(0, 200);
  if (typeChamp?.format === "date" || champ === "date") return { reason: REASON.INVALID_DATE, raw_value: brute };
  if (typeChamp?.type === "number") return { reason: REASON.INVALID_NUMERIC_VALUE, raw_value: brute };
  return { reason: REASON.MISSING_REQUIRED_FIELD, raw_value: brute };
}
