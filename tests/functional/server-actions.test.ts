import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/create-database";
import { createGroups } from "@/db/groups";
import { GROUP_COOKIE } from "@/domain/group";
import { startServerStack } from "../helpers/functional";

// No session mock: the real session read, from a request without cookies.
vi.mock("next/headers");
vi.mock("next/cache");

const FEATURES = join(process.cwd(), "src/features");
/** Public by design: it prepares a signup, so there is no session yet. */
const PUBLIC_ACTIONS = new Set(["signin/actions.ts#prepareSignup"]);

/** Every "use server" module of src/features, found on disk: a new one is checked too. */
const serverActionModules = readdirSync(FEATURES, { recursive: true })
  .map(String)
  .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
  .filter((path) =>
    /^\s*["']use server["']/.test(readFileSync(join(FEATURES, path), "utf8")),
  )
  .sort();

let db: Database;
let groupId = "";
let token = "";
beforeAll(async () => {
  ({ db } = await startServerStack());
});
beforeEach(async () => {
  // A real group of Léa's, with its invite link: only the session is missing.
  const groups = createGroups(db);
  ({ id: groupId } = await groups.create({
    name: "LA COLOC",
    userId: "user-1",
  }));
  token = await groups.ensureInvite(groupId);
});

/** Every row of every table: a refused action leaves it unchanged. */
async function snapshot(): Promise<Record<string, unknown[]>> {
  const tables = await db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
  );
  const rows: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    rows[name] = await db.all(sql.raw(`SELECT * FROM "${name}"`));
  }
  return rows;
}

/** Plausible arguments: a group I belong to first, then a movie, a choice, a page. */
function argumentsFor(): unknown[] {
  const form = new FormData();
  form.set("name", "LES AUTRES");
  return [groupId, 550, "want", 1, form, token];
}

describe("Server Actions sans session (fonctionnel, méta-test)", () => {
  it("trouve les modules d'actions des écrans", () => {
    expect(serverActionModules).toEqual(
      expect.arrayContaining([
        "draw/actions.ts",
        "groups/actions.ts",
        "list/actions.ts",
        "signin/actions.ts",
        "swipe/actions.ts",
      ]),
    );
  });

  it.each(serverActionModules)(
    "chaque action de %s est refusée sans rien écrire",
    async (path) => {
      const actions = (await import(join(FEATURES, path))) as Record<
        string,
        unknown
      >;
      const guarded = Object.entries(actions).filter(
        ([name]) => !PUBLIC_ACTIONS.has(`${path}#${name}`),
      );
      const before = await snapshot();

      for (const [name, action] of guarded) {
        expect(action, name).toBeTypeOf("function");
        const call = (action as (...args: unknown[]) => Promise<unknown>)(
          ...argumentsFor(),
        );
        await expect(call, name).rejects.toThrow(
          "Server Action refused: not signed in",
        );
      }
      expect(await snapshot()).toEqual(before);
      expect((await cookies()).get(GROUP_COOKIE)).toBeUndefined();
    },
  );
});
