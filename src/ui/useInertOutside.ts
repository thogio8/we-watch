import { type RefObject, useEffect } from "react";

import { inertOutside } from "./inertOutside";

/** While `active`, everything outside `kept` is inert (see inertOutside). */
export function useInertOutside(
  active: boolean,
  kept: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active || kept.current === null) return;
    return inertOutside(kept.current);
  }, [active, kept]);
}
