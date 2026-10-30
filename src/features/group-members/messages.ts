import { formatShortDate } from "@/domain/time";
import { quoted } from "@/ui/quoted";

/** Texts of the « MEMBRES ET INVITATION » screen (spec §9). */
export const RENAME_FAILED = "PAS RÉUSSI À RENOMMER, RÉESSAIE";
export const LINK_FAILED = "PAS RÉUSSI À OBTENIR LE LIEN, RÉESSAIE";
export const COPY_FAILED = "COPIE IMPOSSIBLE\u00A0: SÉLECTIONNE LE LIEN";
export const REGENERATE_QUESTION =
  "L’ANCIEN LIEN NE MARCHERA PLUS. RÉGÉNÉRER\u00A0?";
export const REGENERATE_FAILED = "PAS RÉUSSI À RÉGÉNÉRER LE LIEN, RÉESSAIE";
export const REMOVE_FAILED = "PAS RÉUSSI À RETIRER, RÉESSAIE";
export const LEAVE_FAILED = "PAS RÉUSSI À QUITTER LE GROUPE, RÉESSAIE";
export const LAST_MEMBER =
  "TU ES LE DERNIER MEMBRE\u00A0: LE GROUPE ET SA LISTE SERONT SUPPRIMÉS.";

/** « depuis le 23/10 ». */
export function memberSince(joinedAt: Date): string {
  return `depuis le ${formatShortDate(joinedAt)}`;
}

/** « RETIRER LÉA DU GROUPE ? ». */
export function removeQuestion(name: string): string {
  return `RETIRER ${name.toLocaleUpperCase("fr-FR")} DU GROUPE\u00A0?`;
}

/** « QUITTER « NOUS DEUX » ? ». */
export function leaveQuestion(groupName: string): string {
  return `QUITTER ${quoted(groupName)}\u00A0?`;
}
