import { headers } from "next/headers";
import { testUtils } from "better-auth/plugins";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AUTHORITATIVE_SESSION_READ, createAuth } from "@/auth/create-auth";
import type { Database } from "@/db/create-database";
import { assertSignedIn, getCurrentUser } from "@/server/session";
import { startServerStack } from "../helpers/functional";
import { BASE_URL } from "../helpers/signup-ceremony";

vi.mock("next/headers");

const SECRET = "functional-auth-secret-0123456789abcdef";

let db: Database;
let auth: ReturnType<typeof buildAuth>;
const buildAuth = () =>
  createAuth({ db, secret: SECRET, baseURL: BASE_URL, plugins: [testUtils()] });

beforeAll(async () => {
  ({ db } = await startServerStack());
  auth = buildAuth();
});

/**
 * A signed-in device as the browser holds it: the session token and the
 * signed session cache (`session_data`, valid 5 minutes) Better Auth sets.
 */
async function aDeviceOf(name: string) {
  const ctx = await auth.$context;
  const account = await ctx.test.saveUser(ctx.test.createUser({ name }));
  const login = await ctx.test.login({ userId: account.id });
  const read = await auth.api.getSession({
    headers: login.headers,
    returnHeaders: true,
  });
  const cache = read.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] as string);
  const cookie = [login.headers.get("cookie"), ...cache].join("; ");
  return {
    userId: account.id,
    sessionId: login.session.id,
    token: login.token,
    headers: new Headers({ cookie }),
    /** The session token alone: a read must go to the database. */
    tokenOnly: login.headers,
  };
}

describe("session lue par les pages et les actions (fonctionnel)", () => {
  it("donne l'utilisateur et l'id de sa session", async () => {
    const device = await aDeviceOf("Léa");
    vi.mocked(headers).mockResolvedValue(device.headers as never);

    await expect(getCurrentUser()).resolves.toEqual({
      userId: device.userId,
      name: "Léa",
      sessionId: device.sessionId,
    });
  });

  it("la lecture faisant foi n'écrit aucun cookie (ni cache ni prolongation)", async () => {
    // Next re-renders the whole page after any Server Action that sets a
    // cookie: a cache cookie written on every read would loop a screen that
    // calls an action once mounted (the invite link). The proxy refreshes.
    const device = await aDeviceOf("Zoé");

    const read = await auth.api.getSession({
      headers: device.tokenOnly,
      query: AUTHORITATIVE_SESSION_READ,
      returnHeaders: true,
    });

    expect(read.response?.user.name).toBe("Zoé");
    expect(read.headers.getSetCookie()).toEqual([]);
  });

  it("une session supprimée en base est refusée aussitôt, même avec un cache de session encore valide", async () => {
    const device = await aDeviceOf("Hugo");
    const ctx = await auth.$context;
    await ctx.internalAdapter.deleteSession(device.token);
    // The cache alone still vouches for the session: the lag being closed.
    expect(await auth.api.getSession({ headers: device.headers })).not.toBe(
      null,
    );
    vi.mocked(headers).mockResolvedValue(device.headers as never);

    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(assertSignedIn()).rejects.toThrow(
      "Server Action refused: not signed in",
    );
  });
});
