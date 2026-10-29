const MAX_LENGTH = 30;

/**
 * Normalises a display name: trimmed, inner whitespace collapsed to one space,
 * 1 to 30 characters (code points, so accents and emoji count once).
 * Returns null when the input is not a valid name.
 */
export function parseDisplayName(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const name = input.trim().replace(/\s+/g, " ");
  const length = [...name].length;
  return length >= 1 && length <= MAX_LENGTH ? name : null;
}
