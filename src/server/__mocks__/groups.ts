import { vi } from "vitest";
import type { ActiveGroup } from "../groups";
import { LEA } from "./session";

export const LEA_GROUP = { id: "groupe-1", name: "NOUS DEUX", memberCount: 2 };

// Picked up by `vi.mock("@/server/groups")`: Léa is a member of every group.
export const getActiveGroup = vi.fn(async (): Promise<ActiveGroup | null> => ({
  user: LEA,
  group: LEA_GROUP,
  groups: [LEA_GROUP],
}));
export const assertMember = vi.fn(async (groupId: unknown) => ({
  user: LEA,
  groupId: groupId as string,
}));
export const rememberGroup = vi.fn(async (): Promise<void> => {});
export const isMemberOf = vi.fn(async (): Promise<boolean> => true);
