import { expect, type Mock, vi } from "vitest";
import { assertMember } from "@/server/groups";

/** What assertMember throws for a foreign or forged group, or no session. */
export const REFUSED = "Server Action refused: not a member";

/**
 * With `vi.mock("@/server/groups")`: `call` (on group "groupe-b") is refused
 * by assertMember before any validation, and none of `untouched` runs.
 */
export async function expectRefusedFirst(
  call: () => Promise<unknown>,
  untouched: readonly Mock[],
): Promise<void> {
  vi.mocked(assertMember).mockRejectedValueOnce(new Error(REFUSED));

  await expect(call()).rejects.toThrow(REFUSED);
  expect(assertMember).toHaveBeenCalledWith("groupe-b");
  for (const fn of untouched) {
    expect(fn).not.toHaveBeenCalled();
  }
}
