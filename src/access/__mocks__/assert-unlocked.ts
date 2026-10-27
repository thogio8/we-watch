import { vi } from "vitest";

// Picked up by `vi.mock("@/access/assert-unlocked")`: unlocked by default.
export const assertUnlocked = vi.fn(async (): Promise<void> => {});
