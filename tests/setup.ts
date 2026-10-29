import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Shared teardown, so no test file has to repeat it. Stubbed globals and env
// are kept: functional tests set them once per file (tests/helpers).
afterEach(() => {
  if (typeof document !== "undefined") {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});
