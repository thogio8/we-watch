import { type RefObject, useEffect, useRef } from "react";

/**
 * Once `open` turns false (closed, or undone), the focus goes to the first
 * element still on screen: the deck, else the page.
 */
export function useFocusOnClose(
  open: boolean,
  targets: readonly RefObject<HTMLElement | null>[],
) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      targets.find((target) => target.current !== null)?.current?.focus();
    }
    wasOpen.current = open;
  });
}
