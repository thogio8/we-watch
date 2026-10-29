"use client";

import { useSyncExternalStore } from "react";
import { passkeysSupported } from "./passkeys";

/** The browser never gains or loses WebAuthn: nothing to listen to. */
const subscribe = () => () => {};

/**
 * Whether this browser handles passkeys. True on the server and during
 * hydration (same markup on both sides), then the browser's real answer.
 */
export function usePasskeysSupported(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => passkeysSupported(window),
    () => true,
  );
}
