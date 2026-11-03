import { vi } from "vitest";
import type { CurrentUser } from "../session";

export const LEA: CurrentUser = {
  userId: "user-1",
  name: "Léa",
  sessionId: "session-1",
};

// Picked up by `vi.mock("@/server/session")`: signed in as Léa by default.
export const getCurrentUser = vi.fn(
  async (): Promise<CurrentUser | null> => LEA,
);
export const assertSignedIn = vi.fn(async (): Promise<CurrentUser> => LEA);
// Whoever assertSignedIn answers (or its refusal), signed in recently.
export const assertRecentlySignedIn = vi.fn(
  async (): Promise<CurrentUser & { recent: boolean }> => ({
    ...(await assertSignedIn()),
    recent: true,
  }),
);
