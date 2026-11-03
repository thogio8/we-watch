import { expect, type Mock, vi } from "vitest";
import { withinLimit } from "@/server/rate-limit";
import { assertSignedIn } from "@/server/session";

type ActionLimit = Parameters<typeof withinLimit>[0];

/**
 * With `vi.mock("@/server/session")` and `vi.mock("@/server/rate-limit")`:
 * without a session, `call` is refused before the limit counts anything;
 * with one, a refused limit (`limit` of `subject`) answers `refusal`, a
 * result, before any validation, and none of `untouched` runs.
 */
export async function expectLimitedFirst(
  call: () => Promise<unknown>,
  expected: {
    limit: ActionLimit;
    subject: string;
    refusal: unknown;
    untouched: readonly Mock[];
  },
): Promise<void> {
  vi.mocked(assertSignedIn).mockRejectedValueOnce(new Error("not signed in"));
  await expect(call()).rejects.toThrow("not signed in");
  expect(withinLimit).not.toHaveBeenCalled();

  vi.mocked(withinLimit).mockResolvedValueOnce(false);
  await expect(call()).resolves.toEqual(expected.refusal);
  expect(withinLimit).toHaveBeenCalledExactlyOnceWith(
    expected.limit,
    expected.subject,
  );
  for (const fn of expected.untouched) {
    expect(fn).not.toHaveBeenCalled();
  }
}
