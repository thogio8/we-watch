"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useReducer,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type DrawSessionAction,
  type DrawSessionState,
  drawSessionReducer,
  initialDrawSession,
} from "@/domain/draw-session";
import type { MoodId, TonightFilters } from "@/domain/tonight";
import {
  parseStoredTonight,
  type StoredTonight,
  serializeTonight,
  TONIGHT_STORAGE_KEY,
} from "./tonightStorage";

interface DrawSession {
  state: DrawSessionState;
  dispatch: Dispatch<DrawSessionAction>;
  filters: TonightFilters;
  setFilters: (filters: TonightFilters) => void;
}

const DrawSessionContext = createContext<DrawSession | null>(null);

/** Private browsing or a full disk must not break the draw. */
function readStorage(): string | null {
  try {
    return localStorage.getItem(TONIGHT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Another tab of the app changed the remembered filters. */
function subscribeStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** No localStorage on the server: nothing is remembered until hydration. */
const serverStorage = () => null;

function writeStorage(value: string): void {
  try {
    localStorage.setItem(TONIGHT_STORAGE_KEY, value);
  } catch {
    // Not remembered: the filters still apply for this session.
  }
}

/**
 * Holds the draw session above the routes (root layout), so the current movie,
 * the « not tonight » pile and the filters survive tab switches. Only the
 * bedtime and the platforms are remembered on the device (spec §11.1).
 */
export function DrawSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(drawSessionReducer, initialDrawSession);
  const stored = useSyncExternalStore(
    subscribeStorage,
    readStorage,
    serverStorage,
  );
  // This session's choice wins over the stored one, even if it could not be
  // saved (private browsing).
  const [chosen, setChosen] = useState<StoredTonight | null>(null);
  const [moods, setMoods] = useState<readonly MoodId[]>([]);
  const filters: TonightFilters = {
    ...(chosen ?? parseStoredTonight(stored)),
    moods,
  };

  const setFilters = (next: TonightFilters) => {
    setChosen({ bedtime: next.bedtime, platforms: next.platforms });
    setMoods(next.moods);
    writeStorage(serializeTonight(next));
  };

  return (
    <DrawSessionContext value={{ state, dispatch, filters, setFilters }}>
      {children}
    </DrawSessionContext>
  );
}

export function useDrawSession(): DrawSession {
  const session = useContext(DrawSessionContext);
  if (session === null) {
    throw new Error("useDrawSession must be used inside <DrawSessionProvider>");
  }
  return session;
}
