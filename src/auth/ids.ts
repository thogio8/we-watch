import { generateRandomString } from "better-auth/crypto";

/**
 * Better Auth's id policy, with one exception. A membership
 * (src/db/group-schema.ts) has no `id` column: its key is group + user.
 * Returning `false` for it leaves the id out of the insert, which relies on
 * Better Auth internals (the adapter's id transform drops a falsy id), not on
 * a documented guarantee. The functional owner-signup tests, which write a
 * membership through the real adapter, are the tripwire on upgrades.
 * Every other model gets Better Auth's default id: 32 letters and digits
 * (`size || 32`, as in its own generator).
 */
export function generateId({ model, size }: { model: string; size?: number }) {
  return model === "membership"
    ? false
    : generateRandomString(size || 32, "a-z", "A-Z", "0-9");
}
