import { vi } from "vitest";

/**
 * jsdom has no matchMedia. With `reducedMotion`, motion resolves animations
 * at once, which keeps most UI tests synchronous.
 */
export function stubMatchMedia({ reducedMotion }: { reducedMotion: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reducedMotion && query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) satisfies MediaQueryList,
  );
}
