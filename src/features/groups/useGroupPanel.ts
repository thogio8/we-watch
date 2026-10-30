"use client";

import {
  type FocusEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { CHOOSE_FAILED } from "./messages";
import { takePillFocus } from "./pillFocus";

interface GroupPanelOptions {
  activeId: string;
  choose: (groupId: string) => Promise<void>;
}

type Refs = {
  pillRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  activeRef: RefObject<HTMLButtonElement | null>;
};

/** Whether `target` is the pill or inside the panel. */
const inside = (
  { pillRef, panelRef }: Omit<Refs, "activeRef">,
  target: EventTarget | null,
) =>
  target instanceof Node &&
  Boolean(
    panelRef.current?.contains(target) || pillRef.current?.contains(target),
  );

/**
 * While open: focus on the displayed group; Escape closes the panel and gives
 * the focus back to the pill. A touch beside it lands on the scrim (dismiss).
 */
function useEscape(
  open: boolean,
  activeRef: Refs["activeRef"],
  close: (focus: boolean) => void,
) {
  useEffect(() => {
    if (!open) return;
    activeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, activeRef]);
}

/**
 * The pill's panel: open and close (Escape, a touch beside it, focus moving
 * away), focus handling, and the group switch guarded against double taps.
 */
export function useGroupPanel({ activeId, choose }: GroupPanelOptions) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choosing = useRef(false);
  const pillRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const refs: Refs = { pillRef, panelRef, activeRef };
  const panelId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setCreating(false);
    setError(null);
    if (restoreFocus) pillRef.current?.focus();
  }, []);
  useEscape(open, activeRef, close);

  useEffect(() => {
    if (takePillFocus()) pillRef.current?.focus();
  }, []);

  /** Tabbing out of the panel folds it, focus left where it went. */
  const onBlur = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next !== null && !inside(refs, next)) close(false);
  };

  async function pick(groupId: string) {
    if (groupId === activeId) return close(true);
    if (choosing.current) return;
    choosing.current = true;
    setPending(true);
    setError(null);
    try {
      // The action sets the cookie and revalidates: its response already
      // carries the page re-rendered for the chosen group.
      await choose(groupId);
      close(true);
    } catch {
      setError(CHOOSE_FAILED);
    } finally {
      choosing.current = false;
      setPending(false);
    }
  }

  return {
    open,
    toggle: () => (open ? close(false) : setOpen(true)),
    /** A touch on the scrim (iOS only sends taps to clickable elements). */
    dismiss: () => close(true),
    creating,
    toggleCreating: () => setCreating(!creating),
    pending,
    error,
    pick,
    /** The page re-rendered with the new group came with the response. */
    created: () => close(true),
    /** A link in the panel was followed: the next page takes the focus. */
    followed: () => close(false),
    onBlur,
    refs,
    panelId,
  };
}
