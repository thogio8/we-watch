const pad = (n: number): string => String(n).padStart(2, "0");

/** End time of a movie started at `start`, or null if the runtime is unknown. */
export function computeEndTime(
  start: Date,
  runtimeMinutes: number | null,
): Date | null {
  if (!runtimeMinutes) return null;
  return new Date(start.getTime() + runtimeMinutes * 60_000);
}

/** Local clock time as "HHHMM", e.g. "09H05". */
export function formatClock(date: Date): string {
  return `${pad(date.getHours())}H${pad(date.getMinutes())}`;
}

/** Runtime as "XhMM", e.g. "2h05"; null if unknown. */
export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null;
  return `${Math.floor(minutes / 60)}h${pad(minutes % 60)}`;
}

/** Local date as "DD/MM". */
export function formatShortDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}
