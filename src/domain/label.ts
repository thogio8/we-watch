// C0/C1 controls and bidi marks/overrides/isolates (spoofing).
const FORBIDDEN = /[\p{Cc}‎‏‪-‮⁦-⁩]/u;
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/**
 * Normalises a short user-chosen label (display name, group name): trimmed,
 * inner whitespace collapsed to one space, 1 to maxLength characters (code
 * points, so accents and emoji count once), NFC, with at least one visible
 * character and no control or bidi characters.
 * Returns null when the input is not a valid label.
 */
export function parseLabel(input: unknown, maxLength: number): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const label = input.normalize("NFC").trim().replace(/\s+/g, " ");
  const length = [...label].length;
  const valid =
    length <= maxLength && !FORBIDDEN.test(label) && VISIBLE.test(label);
  return valid ? label : null;
}
