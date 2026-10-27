import { BEDTIMES, type TonightFilters } from "@/domain/tonight";

/** The part of the filters a device remembers: the mood is per evening. */
export type StoredTonight = Pick<TonightFilters, "bedtime" | "providerIds">;

export const TONIGHT_STORAGE_KEY = "ww-tonight-v1";

const EMPTY: StoredTonight = { bedtime: null, providerIds: [] };

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
  const { bedtime, providerIds } = value as Record<string, unknown>;
  return {
    bedtime: BEDTIMES.some((b) => b.minutes === bedtime)
      ? (bedtime as number)
      : null,
    providerIds: Array.isArray(providerIds)
      ? providerIds.filter((id): id is number => Number.isSafeInteger(id))
      : [],
  };
}

export function serializeTonight(filters: TonightFilters): string {
  const stored: StoredTonight = {
    bedtime: filters.bedtime,
    providerIds: filters.providerIds,
  };
  return JSON.stringify(stored);
}
