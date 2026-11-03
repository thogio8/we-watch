"use client";

import { useEffect, useRef } from "react";

/**
 * A button disabled while its send runs loses focus: once `pending` is over
 * and `sent()` was called, the focus comes back to it (not a field, which
 * would reopen a phone's keyboard), unless something else took it meanwhile.
 */
export function useFocusBack(pending: boolean) {
  const button = useRef<HTMLButtonElement>(null);
  const done = useRef(false);
  useEffect(() => {
    if (pending || !done.current) return;
    done.current = false;
    const active = document.activeElement;
    if (active === document.body || active === button.current) {
      button.current?.focus();
    }
  }, [pending]);
  return {
    button,
    sent: () => {
      done.current = true;
    },
  };
}
