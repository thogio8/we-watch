/** Texts of the group pill, its panel and the first group screen (spec §6). */
export const GROUP_NAME_ERROR = "UN NOM DE 1 À 30 CARACTÈRES";
export const CREATE_FAILED = "PAS RÉUSSI À CRÉER LE GROUPE, RÉESSAIE";
export const INVITE_INVALID = "CE LIEN N’EST PLUS VALABLE";
export const CHOOSE_FAILED = "PAS RÉUSSI À CHANGER DE GROUPE, RÉESSAIE";

/** « 1 MEMBRE », « 2 MEMBRES ». */
export function membersLabel(count: number): string {
  return `${count} ${count === 1 ? "MEMBRE" : "MEMBRES"}`;
}
