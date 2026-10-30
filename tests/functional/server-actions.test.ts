import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { passkey } from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { createGroups } from "@/db/groups";
import { GROUP_COOKIE } from "@/domain/group";
import { startServerStack } from "../helpers/functional";

// No session mock: the real session read, from a request without cookies.
vi.mock("next/headers");
vi.mock("next/cache");

const SRC = join(process.cwd(), "src");
/** Public by design: it prepares a signup, so there is no session yet. */
const PUBLIC_ACTIONS = new Set(["features/signin/actions.ts#prepareSignup"]);

const DIRECTIVE = /^\s*["']use server["'];?\s*$/m;

/** Every source file of src (tests aside), with its text. */
const sources = readdirSync(SRC, { recursive: true })
  .map(String)
  .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
  .sort()
  .map((path) => ({ path, text: readFileSync(join(SRC, path), "utf8") }));

/** Every "use server" module of src, found on disk: a new one is checked too. */
const serverActionModules = sources
  .filter(({ text }) => /^["']use server["']/.test(text))
  .map(({ path }) => path);

let db: Database;
let groupId = "";
let token = "";
beforeAll(async () => {
  ({ db } = await startServerStack());
  // Two passkeys of Léa's: deleting one would be allowed with a session.
  await db.insert(passkey).values(
    ["passkey-1", "passkey-2"].map((id) => ({
      id,
      userId: "user-1",
      publicKey: "key",
      credentialID: id,
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
    })),
  );
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
function defaultArguments(): unknown[] {
  return [groupId, 550, "want", 1, aForm(), token];
}

function aForm(): FormData {
  const form = new FormData();
  form.set("name", "LES AUTRES");
  return form;
}

/** Each action's real arguments, where the default list does not fit. */
const ARGUMENTS: Record<string, () => unknown[]> = {
  "features/groups/actions.ts#createGroup": () => [aForm()],
  "features/groups/actions.ts#renameGroup": () => [groupId, aForm()],
  "features/groups/actions.ts#removeMember": () => [groupId, "user-1"],
  "features/groups/actions.ts#joinGroup": () => [token],
  "features/list/actions.ts#searchCatalog": () => [groupId, "Fight Club"],
  "features/swipe/actions.ts#loadMoreCards": () => [groupId, "popular", 2],
  "features/account/actions.ts#listMyPasskeys": () => [],
  "features/account/actions.ts#deletePasskey": () => ["passkey-1"],
};

const argumentsFor = (action: string) =>
  (ARGUMENTS[action] ?? defaultArguments)();

describe("Server Actions sans session (fonctionnel, méta-test)", () => {
  it("trouve les modules d'actions des écrans", () => {
    expect(serverActionModules).toEqual(
      expect.arrayContaining([
        "features/account/actions.ts",
        "features/draw/actions.ts",
        "features/groups/actions.ts",
        "features/list/actions.ts",
        "features/signin/actions.ts",
        "features/swipe/actions.ts",
      ]),
    );
  });

  it("aucune directive « use server » ailleurs qu’en tête de fichier", () => {
    const misplaced = sources
      .filter(({ text }) => DIRECTIVE.test(text.slice(text.indexOf("\n"))))
      .map(({ path }) => path);

    expect(misplaced).toEqual([]);
  });

  it("chaque argument prévu désigne une action existante", async () => {
    const exported: string[] = [];
    for (const path of serverActionModules) {
      const actions = (await import(join(SRC, path))) as object;
      exported.push(...Object.keys(actions).map((name) => `${path}#${name}`));
    }

    expect(exported).toEqual(expect.arrayContaining(Object.keys(ARGUMENTS)));
  });

  it.each(serverActionModules)(
    "chaque action de %s est refusée sans rien écrire",
    async (path) => {
      const actions = (await import(join(SRC, path))) as Record<
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
          ...argumentsFor(`${path}#${name}`),
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
