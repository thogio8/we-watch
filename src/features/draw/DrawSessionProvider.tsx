"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useReducer,
} from "react";
import {
  type DrawSessionAction,
  type DrawSessionState,
  drawSessionReducer,
  initialDrawSession,
} from "@/domain/draw-session";

interface DrawSession {
  state: DrawSessionState;
  dispatch: Dispatch<DrawSessionAction>;
}

const DrawSessionContext = createContext<DrawSession | null>(null);

/**
 * Holds the draw session above the routes (root layout), so the current movie
 * and the « not tonight » pile survive tab switches. Never persisted.
 */
export function DrawSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(drawSessionReducer, initialDrawSession);
  return (
    <DrawSessionContext value={{ state, dispatch }}>
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
