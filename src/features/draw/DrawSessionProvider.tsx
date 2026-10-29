"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
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
import type { TonightFilters } from "@/domain/tonight";
import {
  parseStoredTonight,
  readStoredTonight,
  serializeTonight,
  tonightStorageKey,
} from "./tonightStorage";

interface DrawSession {
  state: DrawSessionState;
  dispatch: Dispatch<DrawSessionAction>;
  filters: TonightFilters;
  setFilters: (filters: TonightFilters) => void;
}

/** A move in one group's draw: the other groups' evenings are left alone. */
interface GroupDrawAction {
  groupId: string;
  action: DrawSessionAction;
}

type Sessions = Readonly<Record<string, DrawSessionState>>;

function sessionsReducer(sessions: Sessions, move: GroupDrawAction): Sessions {
  const state = sessions[move.groupId] ?? initialDrawSession;
  return {
    ...sessions,
    [move.groupId]: drawSessionReducer(state, move.action),
  };
}

interface DrawSessions {
  sessions: Sessions;
  dispatch: Dispatch<GroupDrawAction>;
  /** The filters chosen in this session, per group. */
  chosen: Readonly<Record<string, TonightFilters>>;
  choose: (groupId: string, filters: TonightFilters) => void;
}

const DrawSessionContext = createContext<DrawSessions | null>(null);

/** Private browsing or a full disk must not break the draw. */
function readStorage(groupId: string): string | null {
  try {
    return readStoredTonight(localStorage, groupId);
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

function writeStorage(groupId: string, value: string): void {
  try {
    localStorage.setItem(tonightStorageKey(groupId), value);
  } catch {
    // Not remembered: the filters still apply for this session.
  }
}

/**
 * Holds the draw sessions above the routes (root layout), one per group, so
 * the current movie, the « not tonight » pile and the filters survive tab and
 * group switches. Only the bedtime and the platforms are remembered on the
 * device (spec §11.1).
 */
export function DrawSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, dispatch] = useReducer(sessionsReducer, {});
  const [chosen, setChosen] = useState<DrawSessions["chosen"]>({});
  const choose = useCallback(
    (groupId: string, filters: TonightFilters) =>
      setChosen((all) => ({ ...all, [groupId]: filters })),
    [],
  );

  return (
    <DrawSessionContext value={{ sessions, dispatch, chosen, choose }}>
      {children}
    </DrawSessionContext>
  );
}

/** The draw session of one group. */
export function useDrawSession(groupId: string): DrawSession {
  const all = useContext(DrawSessionContext);
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => readStorage(groupId),
    serverStorage,
  );
  const groupDispatch = all?.dispatch;
  const dispatch = useCallback(
    (action: DrawSessionAction) => groupDispatch?.({ groupId, action }),
    [groupDispatch, groupId],
  );
  if (all === null) {
    throw new Error("useDrawSession must be used inside <DrawSessionProvider>");
  }
  // This session's choice wins over the stored one, even if it could not be
  // saved (private browsing). The mood is per evening: never stored.
  const filters = all.chosen[groupId] ?? {
    ...parseStoredTonight(stored),
    moods: [],
  };

  const setFilters = (next: TonightFilters) => {
    all.choose(groupId, next);
    writeStorage(groupId, serializeTonight(next));
  };

  return {
    state: all.sessions[groupId] ?? initialDrawSession,
    dispatch,
    filters,
    setFilters,
  };
}
