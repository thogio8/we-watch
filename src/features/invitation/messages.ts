import { quoted } from "@/ui/quoted";

/** Texts of the invitation page (spec §7, §9). */
export const INVALID_TITLE = ["CE LIEN N’EST", "PLUS VALABLE"] as const;
export const JOIN_FAILED = "PAS RÉUSSI À REJOINDRE LE GROUPE, RÉESSAIE";

/** « TU ES DÉJÀ DANS « NOM » ». */
export function memberTitle(groupName: string): string[] {
  return ["TU ES DÉJÀ", `DANS ${quoted(groupName)}`];
}
