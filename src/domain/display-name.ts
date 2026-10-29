const MAX_LENGTH = 30;
// C0/C1 controls and bidi marks/overrides/isolates (spoofing).
const FORBIDDEN = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/**
 * Normalises a display name: trimmed, inner whitespace collapsed to one space,
 * 1 to 30 characters (code points, so accents and emoji count once), NFC,
 * with at least one visible character and no control or bidi characters.
 * Returns null when the input is not a valid name.
 */
export function parseDisplayName(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const name = input.normalize("NFC").trim().replace(/\s+/g, " ");
  const length = [...name].length;
  const valid =
    length <= MAX_LENGTH && !FORBIDDEN.test(name) && VISIBLE.test(name);
  return valid ? name : null;
}
