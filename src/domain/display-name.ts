import { parseLabel } from "./label";

const MAX_LENGTH = 30;

/** A display name: a label of 1 to 30 characters (see parseLabel). */
export function parseDisplayName(input: unknown): string | null {
  return parseLabel(input, MAX_LENGTH);
}
