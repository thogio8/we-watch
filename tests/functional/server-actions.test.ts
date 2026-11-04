import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cookies, headers } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { passkey, session } from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { createGroups } from "@/db/groups";
import { GROUP_COOKIE } from "@/domain/group";
import {
  aDeviceSignedInAs,
  aTestAuth,
  deleteSession,
} from "../helpers/devices";
import { startServerStack } from "../helpers/functional";
import { allRows } from "../helpers/rows";
import {
  hasMisplacedDirective,
  isServerModule,
} from "../helpers/server-directive";

// No session mock: the real session read, from the request of each pass.
vi.mock("next/headers");
vi.mock("next/cache");

const SRC = join(process.cwd(), "src");
/** Public by design: it prepares a signup, so there is no session yet. */
const PUBLIC_ACTIONS = new Set(["features/signin/actions.ts#prepareSignup"]);

/** Every source file of src (tests aside), with its text. */
const sources = readdirSync(SRC, { recursive: true })
  .map(String)
  .filter((path) => /\.(?:tsx?|m?js)$/.test(path) && !/\.test\./.test(path))
  .sort()
  .map((path) => ({ path, text: readFileSync(join(SRC, path), "utf8") }));

/** Every "use server" module of src, found on disk: a new one is checked too. */
const serverActionModules = sources
  .filter(({ text }) => isServerModule(text))
  .map(({ path }) => path);

let db: Database;
let groupId = "";
let token = "";
/** Léa's device, its session deleted: only its cache still vouches for it. */
let revoked: Headers;
beforeAll(async () => {
  ({ db } = await startServerStack());
  const auth = aTestAuth(db);
  const device = await aDeviceSignedInAs(auth, "user-1");
  await deleteSession(auth, device);
  // The signed cache alone would still let a cache-trusting read through.
  expect(await auth.api.getSession({ headers: device.headers })).not.toBe(null);
  revoked = device.headers;
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
  // A session of Léa's: revoking it would be allowed with a session.
  await db.insert(session).values({
    id: "session-1",
    token: "token-1",
    userId: "user-1",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    updatedAt: new Date(),
  });
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

/** Plausible arguments: a group I belong to first, then a movie, a choice, a page. */
function defaultArguments(): unknown[] {
  return [groupId, 550, "want", 1, aForm(), token];
}

function aName(name: string): FormData {
  const form = new FormData();
  form.set("name", name);
  return form;
}

const aForm = () => aName("LES AUTRES");

/** Each action's real arguments, where the default list does not fit. */
const ARGUMENTS: Record<string, () => unknown[]> = {
  "features/groups/actions.ts#createGroup": () => [aForm()],
  "features/groups/actions.ts#renameGroup": () => [groupId, aForm()],
  "features/groups/actions.ts#removeMember": () => [groupId, "user-1"],
  "features/groups/actions.ts#joinGroup": () => [token],
  "features/list/actions.ts#searchCatalog": () => [groupId, "Fight Club"],
  "features/list/actions.ts#setFavorite": () => [groupId, 550, true],
  "features/swipe/actions.ts#loadMoreCards": () => [groupId, "popular", 2],
  "features/account/actions.ts#deletePasskey": () => ["passkey-1"],
  "features/account/actions.ts#revokeSession": () => ["session-1"],
  "features/account/actions.ts#renameMe": () => [aName("Zoé")],
  // Léa's exact name: the deletion would go through with a session.
  "features/account/actions.ts#deleteAccount": () => [aName("Léa")],
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
      .filter(({ text }) => hasMisplacedDirective(text))
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
});

/** Each request an action may come from without a live session. */
const SIGNED_OUT_REQUESTS: [string, () => Headers][] = [
  ["sans cookie", () => new Headers()],
  ["session supprimée, cache encore valide", () => revoked],
];

describe.each(SIGNED_OUT_REQUESTS)(
  "Server Actions, requête %s (fonctionnel, méta-test)",
  (_, request) => {
    beforeEach(() => {
      vi.mocked(headers).mockResolvedValue(request() as never);
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
        const before = await allRows(db);

        for (const [name, action] of guarded) {
          expect(action, name).toBeTypeOf("function");
          const call = (action as (...args: unknown[]) => Promise<unknown>)(
            ...argumentsFor(`${path}#${name}`),
          );
          await expect(call, name).rejects.toThrow(
            "Server Action refused: not signed in",
          );
        }
        expect(await allRows(db)).toEqual(before);
        expect((await cookies()).get(GROUP_COOKIE)).toBeUndefined();
      },
    );
  },
);
