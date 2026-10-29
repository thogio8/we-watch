"use client";

import { useRouter } from "next/navigation";
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
 * While open: focus on the displayed group; Escape or a touch beside the
 * panel closes it and gives the focus back to the pill.
 */
function useDismiss(
  open: boolean,
  refs: Refs,
  close: (focus: boolean) => void,
) {
  const { pillRef, panelRef, activeRef } = refs;
  useEffect(() => {
    if (!open) return;
    activeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    // A click, not a pointerdown: the scrim takes the whole tap, so the
    // screen under it never receives a ghost click.
    const onClick = (event: MouseEvent) => {
      if (!inside({ pillRef, panelRef }, event.target)) close(true);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open, close, pillRef, panelRef, activeRef]);
}

/**
 * The pill's panel: open and close (Escape, a touch beside it, focus moving
 * away), focus handling, and the group switch guarded against double taps.
 */
export function useGroupPanel({ activeId, choose }: GroupPanelOptions) {
  const router = useRouter();
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
  useDismiss(open, refs, close);

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
      await choose(groupId);
      close(true);
      router.refresh();
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
    creating,
    toggleCreating: () => setCreating(!creating),
    pending,
    error,
    pick,
    created: () => {
      close(true);
      router.refresh();
    },
    onBlur,
    refs,
    panelId,
  };
}
