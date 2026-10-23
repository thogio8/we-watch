"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

/** Calls `onTick` at every minute boundary, and when the tab becomes visible again. */
function subscribe(onTick: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(
      () => {
        onTick();
        schedule();
      },
      MINUTE_MS - (Date.now() % MINUTE_MS),
    );
  };
  schedule();
  document.addEventListener("visibilitychange", onTick);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onTick);
  };
}

/** Stable within a minute, so React only re-renders when the minute changes. */
const currentMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

/** No clock on the server: the device's local time only exists after hydration. */
const serverMinute = () => null;

/** The device's current time, truncated to the minute; null until hydrated. */
export function useMinuteClock(): Date | null {
  const minute = useSyncExternalStore(subscribe, currentMinute, serverMinute);
  return minute === null ? null : new Date(minute);
}
