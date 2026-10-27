import { vi } from "vitest";

// Picked up by `vi.mock("next/cache")`: Server Action tests only check calls.
export const revalidatePath = vi.fn();
