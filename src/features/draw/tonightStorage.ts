import { LEGACY_GROUP_ID } from "@/domain/group";
import { BEDTIMES, type TonightFilters } from "@/domain/tonight";

/** The part of the filters a device remembers: the mood is per evening. */
export type StoredTonight = Pick<TonightFilters, "bedtime" | "platforms">;

/** Before groups, one evening per device: now the legacy group's. */
const LEGACY_STORAGE_KEY = "ww-tonight-v1";

/** Each group remembers its own evening on the device. */
export const tonightStorageKey = (groupId: string): string =>
  `ww-tonight-v2:${groupId}`;

/**
 * The raw saved evening of a group (a string: stable between renders). The
 * legacy group falls back on the key from before groups until it saves its own.
 */
export function readStoredTonight(
  storage: Pick<Storage, "getItem">,
  groupId: string,
): string | null {
  const saved = storage.getItem(tonightStorageKey(groupId));
  if (saved !== null || groupId !== LEGACY_GROUP_ID) return saved;
  return storage.getItem(LEGACY_STORAGE_KEY);
}

const EMPTY: StoredTonight = { bedtime: null, platforms: [] };

/** Reads what was saved, dropping anything unknown or malformed. */
export function parseStoredTonight(raw: string | null): StoredTonight {
  if (raw === null) return EMPTY;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (typeof value !== "object" || value === null) return EMPTY;
  const { bedtime, platforms } = value as Record<string, unknown>;
  return {
    bedtime: BEDTIMES.some((b) => b.minutes === bedtime)
      ? (bedtime as number)
      : null,
    platforms: Array.isArray(platforms)
      ? platforms.filter((key): key is string => typeof key === "string")
      : [],
  };
}

export function serializeTonight(filters: TonightFilters): string {
  const stored: StoredTonight = {
    bedtime: filters.bedtime,
    platforms: filters.platforms,
  };
  return JSON.stringify(stored);
}
