import { BEDTIMES, type TonightFilters } from "@/domain/tonight";

/** The part of the filters a device remembers: the mood is per evening. */
export type StoredTonight = Pick<TonightFilters, "bedtime" | "platforms">;

/** Each group remembers its own evening on the device. */
export const tonightStorageKey = (groupId: string): string =>
  `ww-tonight-v2:${groupId}`;

/** The raw saved evening of a group (a string: stable between renders). */
export function readStoredTonight(
  storage: Pick<Storage, "getItem">,
  groupId: string,
): string | null {
  return storage.getItem(tonightStorageKey(groupId));
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
