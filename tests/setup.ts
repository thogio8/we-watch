import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Shared teardown, so no test file has to repeat it.
afterEach(() => {
  if (typeof document !== "undefined") {
    cleanup();
    localStorage.clear();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
