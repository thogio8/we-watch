// Controls, and format characters (invisible: zero-width spaces, bidi marks,
// overrides and isolates, word joiner, BOM...) but the two emoji need: the
// zero-width joiner (U+200D, families) and the emoji variation selector
// (U+FE0F, red heart). Plus the fillers that render as blank letters
// (Hangul, braille).
const FORBIDDEN =
  /[\p{Cc}\u115F\u1160\u2800\u3164\uFFA0]|(?![\u200D\uFE0F])\p{Cf}/u;
// Subdivision flags (England, Scotland, Wales) are a black flag followed by
// 2 to 7 tag digits or lowercase tag letters (UTS #51: a region code such as
// « gbeng ») and a cancel tag (U+E007F), all \p{Cf}: allowed in that sequence
// only, so tags never hide text (uppercase, spaces, punctuation).
const SUBDIVISION_FLAG =
  /\u{1F3F4}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{2,7}\u{E007F}/gu;
// Whitespace, collapsed to one space; but U+FEFF, which JavaScript counts as
// whitespace: an invisible character inside a name is refused, not hidden.
const SPACES = /[^\S\uFEFF]+/g;
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/**
 * Normalises a short user-chosen label (display name, group name): trimmed,
 * inner whitespace collapsed to one space, 1 to maxLength characters (code
 * points, so accents and emoji count once), NFC, with at least one visible
 * character and no control, invisible format or blank filler character.
 * Returns null when the input is not a valid label.
 */
export function parseLabel(input: unknown, maxLength: number): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const label = input.normalize("NFC").trim().replace(SPACES, " ");
  const length = [...label].length;
  const valid =
    length <= maxLength &&
    !FORBIDDEN.test(label.replace(SUBDIVISION_FLAG, "")) &&
    VISIBLE.test(label);
  return valid ? label : null;
}
