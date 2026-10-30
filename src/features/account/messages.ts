import { formatLongDate } from "@/domain/time";
import { quoted } from "@/ui/quoted";

/** Texts of « MON COMPTE ». */
export const UNNAMED_PASSKEY = "CLÉ D’ACCÈS";
export const LAST_PASSKEY = "GARDE AU MOINS UNE CLÉ D’ACCÈS";
export const WRONG_NAME = "TAPE TON PRÉNOM EXACT";
export const RENAME_FAILED = "PAS RÉUSSI À CHANGER TON PRÉNOM, RÉESSAIE";
export const REMOVE_PASSKEY_FAILED = "PAS RÉUSSI À SUPPRIMER LA CLÉ, RÉESSAIE";
export const REMOVE_PASSKEY_WARNING =
  "CET APPAREIL NE POURRA PLUS T’OUVRIR WEWATCH AVEC ELLE.";
export const THIS_DEVICE = "CET APPAREIL";
export const THIS_DEVICE_WARNING =
  "C’EST CET APPAREIL\u00A0: TU SERAS DÉCONNECTÉ·E ICI.";
export const REVOKE_FAILED = "PAS RÉUSSI À DÉCONNECTER L’APPAREIL, RÉESSAIE";
export const DELETE_QUESTION = "SUPPRIMER TON COMPTE\u00A0?";
export const DELETE_WARNING =
  "TES CLÉS, TES APPAREILS ET TES BOF DISPARAISSENT, AVEC LES GROUPES OÙ TU ES SEUL·E. AILLEURS, TES FILMS RESTENT.";
export const DELETE_FAILED = "PAS RÉUSSI À SUPPRIMER TON COMPTE, RÉESSAIE";

/** Announced once my name is changed. */
export function renamedTo(name: string): string {
  return `C’EST NOTÉ\u00A0: TU T’APPELLES ${name.toLocaleUpperCase("fr-FR")}`;
}

/** « ajoutée le 28 octobre 2026 » (a passkey). */
export function addedOn(date: Date): string {
  return `ajoutée le ${formatLongDate(date)}`;
}

/** « actif le 30 octobre 2026 » (a device). */
export function activeOn(date: Date): string {
  return `actif le ${formatLongDate(date)}`;
}

/** « SUPPRIMER LA CLÉ « IPHONE · SAFARI » ? », in capitals as in its row. */
export function removePasskeyQuestion(name: string): string {
  return `SUPPRIMER LA CLÉ ${quoted(name.toLocaleUpperCase("fr-FR"))}\u00A0?`;
}

/** « DÉCONNECTER « MAC · CHROME » ? », in capitals as in its row. */
export function revokeQuestion(device: string): string {
  return `DÉCONNECTER ${quoted(device.toLocaleUpperCase("fr-FR"))}\u00A0?`;
}

/** The field of the deletion ticket: my name as stored, case included. */
export function deleteField(name: string): string {
  return `TAPE ${quoted(name)} POUR CONFIRMER`;
}
