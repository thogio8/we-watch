import { BEDTIMES, type TonightFilters } from "@/domain/tonight";

/** The part of the filters a device remembers: the mood is per evening. */
export type StoredTonight = Pick<TonightFilters, "bedtime" | "platforms">;

export const TONIGHT_STORAGE_KEY = "ww-tonight-v1";

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
