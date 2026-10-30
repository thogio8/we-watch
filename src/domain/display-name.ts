import { parseLabel } from "./label";

const MAX_LENGTH = 30;

/** A display name: a label of 1 to 30 characters (see parseLabel). */
export function parseDisplayName(input: unknown): string | null {
  return parseLabel(input, MAX_LENGTH);
}

// What a phone keyboard may type for an apostrophe: ’ ‘ ʼ and '.
const APOSTROPHES = /[‘’ʼ]/g;

/** A name as compared, never stored: no validation, older names included. */
const comparable = (name: string) =>
  name.normalize("NFC").trim().replace(/\s+/g, " ").replace(APOSTROPHES, "'");

/**
 * Whether `typed` is my name `name`, to confirm a deletion: case and
 * letters exact, but spaces as stored names have them (trimmed, collapsed)
 * and any apostrophe for any other, whatever the keyboard. Never validated:
 * a name written before the current rules can still be confirmed.
 */
export function confirmsName(typed: unknown, name: string): boolean {
  return typeof typed === "string" && comparable(typed) === comparable(name);
}
