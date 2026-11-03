import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSignupTicket } from "@/access/signup-ticket";
import { passkey, session, user } from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import {
  aDeviceOf,
  aTestAuth,
  AUTH_SECRET,
  deleteSession,
} from "../helpers/devices";
import { startServerStack } from "../helpers/functional";
import { cookiesOf, registerWith } from "../helpers/signup-ceremony";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

let db: Database;
let reset: () => Promise<void>;
let auth: ReturnType<typeof aTestAuth>;
beforeAll(async () => {
  ({ db, reset } = await startServerStack());
  auth = aTestAuth(db);
});
beforeEach(() => reset());

let nextCredential = 0;
const aCredential = () => new Uint8Array([6, 0, 0, ++nextCredential]);

const ticketFor = (name: string) =>
  createSignupTicket({ name, owner: false, invite: null }, AUTH_SECRET);

/** Signed up with a first passkey, on an iPhone: the cookies it holds. */
async function signedUp(name: string) {
  const { response } = await registerWith(auth.handler, {
    ticket: await ticketFor(name),
    credentialId: aCredential(),
    userAgent: IPHONE_SAFARI,
  });
  expect(response.status).toBe(200);
  const cookies = cookiesOf(response);
  const read = await auth.api.getSession({
    headers: new Headers({ cookie: cookies.join("; ") }),
  });
  return { cookies, userId: read?.user.id as string };
}

const passkeysOf = (userId: string) =>
  db.select().from(passkey).where(eq(passkey.userId, userId));
const count = async (table: typeof user | typeof session | typeof passkey) =>
  db.$count(table);

describe("ajouter une passkey quand on est connecté (fonctionnel)", () => {
  it("l’attache à mon compte, sans créer de compte ni de session", async () => {
    const nina = await signedUp("Nina");
    const before = { users: await count(user), sessions: await count(session) };

    const { response } = await registerWith(auth.handler, {
      credentialId: aCredential(),
      cookies: nina.cookies,
      // Asked for by the client: the server never opens a second session.
      createSession: true,
      userAgent: MAC_CHROME,
    });

    expect(response.status).toBe(200);
    expect(await passkeysOf(nina.userId)).toHaveLength(2);
    expect(await count(user)).toBe(before.users);
    expect(await count(session)).toBe(before.sessions);
  });

  it("connecté, une inscription avec un ticket est refusée sans rien écrire", async () => {
    const nina = await signedUp("Nina");
    const before = { users: await count(user), keys: await count(passkey) };

    const { response } = await registerWith(auth.handler, {
      ticket: await ticketFor("Sam"),
      credentialId: aCredential(),
      cookies: nina.cookies,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Already signed in",
    });
    expect(await count(user)).toBe(before.users);
    expect(await count(passkey)).toBe(before.keys);
  });

  it("une session supprimée en base, même avec un cache encore valide, n’ajoute rien", async () => {
    const hugo = await aDeviceOf(auth, "Hugo");
    await deleteSession(auth, hugo);
    // The cache alone still vouches for the session.
    expect(await auth.api.getSession({ headers: hugo.headers })).not.toBe(null);

    const { response } = await registerWith(auth.handler, {
      credentialId: aCredential(),
      cookies: hugo.cookies,
    });

    expect(response.status).toBe(400);
    expect(await count(passkey)).toBe(0);
    expect(await count(user)).toBe(1 + 1); // Léa (stack) and Hugo
  });

  it("une session supprimée, cache encore valide, et un ticket : le compte est créé normalement", async () => {
    const hugo = await aDeviceOf(auth, "Hugo");
    await deleteSession(auth, hugo);
    expect(await auth.api.getSession({ headers: hugo.headers })).not.toBe(null);

    const { options, response } = await registerWith(auth.handler, {
      ticket: await ticketFor("Sam"),
      credentialId: aCredential(),
      cookies: hugo.cookies,
    });

    expect(options.user).toMatchObject({ name: "Sam", displayName: "Sam" });
    expect(response.status).toBe(200);
    const sam = await auth.api.getSession({
      headers: new Headers({ cookie: cookiesOf(response).join("; ") }),
    });
    expect(sam?.user.name).toBe("Sam");
    expect(await passkeysOf(sam?.user.id as string)).toHaveLength(1);
    expect(await passkeysOf(hugo.userId)).toHaveLength(0);
  });
});

describe("nom des passkeys, fixé par le serveur (fonctionnel)", () => {
  it("à l’inscription comme à l’ajout, c’est l’appareil, jamais le texte du client", async () => {
    const { response } = await registerWith(auth.handler, {
      ticket: await ticketFor("Nina"),
      credentialId: aCredential(),
      name: "<script>pirate</script>",
      userAgent: IPHONE_SAFARI,
    });
    const nina = await auth.api.getSession({
      headers: new Headers({ cookie: cookiesOf(response).join("; ") }),
    });

    await registerWith(auth.handler, {
      credentialId: aCredential(),
      cookies: cookiesOf(response),
      name: "Mon trousseau",
      userAgent: MAC_CHROME,
    });

    const names = (await passkeysOf(nina?.user.id as string)).map(
      (row) => row.name,
    );
    expect(names.sort()).toEqual(["Mac · Chrome", "iPhone · Safari"]);
  });

  it("sans agent connu, « APPAREIL INCONNU »", async () => {
    const nina = await signedUp("Nina");

    await registerWith(auth.handler, {
      credentialId: aCredential(),
      cookies: nina.cookies,
    });

    expect((await passkeysOf(nina.userId)).map((row) => row.name)).toContain(
      "APPAREIL INCONNU",
    );
  });

  it("le trousseau de l’appareil montre le prénom, jamais une adresse @passkey.invalid", async () => {
    const nina = await signedUp("Nina");

    const adding = await registerWith(auth.handler, {
      credentialId: aCredential(),
      cookies: nina.cookies,
      name: "pirate",
    });
    const signingUp = await registerWith(auth.handler, {
      ticket: await ticketFor("Omar"),
      credentialId: aCredential(),
      name: "pirate",
    });

    expect(adding.options.user).toEqual({
      id: expect.any(String),
      name: "Nina",
      displayName: "Nina",
    });
    expect(signingUp.options.user).toEqual({
      id: expect.any(String),
      name: "Omar",
      displayName: "Omar",
    });
  });
});
