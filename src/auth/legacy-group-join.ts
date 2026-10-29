import {
  getCurrentAdapter,
  type BetterAuthPlugin,
  type DBAdapter,
} from "better-auth";
import { LEGACY_GROUP_ID } from "@/domain/group";

const GROUPS = "group";
const MEMBERSHIPS = "membership";

/**
 * Declares the group and membership tables (src/db/group-schema.ts) to
 * Better Auth, so its adapter, and the transaction it runs the signup in, can
 * read and write them. No endpoint: groups are managed by the app, and so are
 * these tables: the Better Auth CLI must never migrate them.
 */
export const groupModels = {
  id: "group-models",
  schema: {
    [GROUPS]: {
      disableMigration: true,
      fields: {
        name: { type: "string", required: true },
        createdAt: { type: "date", required: true },
      },
    },
    [MEMBERSHIPS]: {
      // Also spares it Better Auth's schema check, which expects an `id`
      // column on every table it writes (the insert leaves the id out: see
      // ids.ts).
      disableMigration: true,
      fields: {
        groupId: { type: "string", required: true },
        userId: { type: "string", required: true },
        joinedAt: { type: "date", required: true },
        lastUsedAt: { type: "date", required: false },
      },
    },
  },
} satisfies BetterAuthPlugin;

/**
 * An owner account joins « NOUS DEUX », the list kept from before accounts,
 * when that group exists (a fresh instance has none). Written through the
 * adapter of the signup transaction: a signup that fails later rolls the
 * membership back with the user. The user is brand new, so the membership's
 * primary key cannot already be taken; were it ever, the insert would fail
 * and so would the whole signup, granting nothing.
 */
export async function joinLegacyGroup(
  adapter: DBAdapter,
  userId: string,
  now = new Date(),
): Promise<void> {
  const tx = await getCurrentAdapter(adapter);
  const where = [{ field: "id", value: LEGACY_GROUP_ID }];
  if ((await tx.findOne({ model: GROUPS, where })) === null) {
    return;
  }
  await tx.create({
    model: MEMBERSHIPS,
    // Just used: the group shown first on the new account.
    data: { groupId: LEGACY_GROUP_ID, userId, joinedAt: now, lastUsedAt: now },
  });
}
