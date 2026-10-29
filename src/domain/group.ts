import { parseLabel } from "./label";

const MAX_LENGTH = 30;

/** The group created from the pre-accounts list (migration, 2.0 piece 2). */
export const LEGACY_GROUP_ID = "nous-deux";
export const LEGACY_GROUP_NAME = "NOUS DEUX";

/** Cookie remembering the displayed group. */
export const GROUP_COOKIE = "ww_group";

export type GroupSummary = { id: string; name: string; memberCount: number };

/** A group name: a label of 1 to 30 characters (see parseLabel). */
export function parseGroupName(input: unknown): string | null {
  return parseLabel(input, MAX_LENGTH);
}
