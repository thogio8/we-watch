import { vi } from "vitest";

// Picked up by `vi.mock("@/server/revalidate")`: actions tests only check calls.
export const revalidateListPages = vi.fn();
export const revalidateGroupPages = vi.fn();
