import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { group } from "@/db/group-schema";
import { rateLimit } from "@/db/rate-limit-schema";
import { TOO_MANY_ATTEMPTS } from "@/domain/rate-limit";
import { deleteAccount } from "@/features/account/actions";
import { createGroup } from "@/features/groups/actions";
import { prepareSignup } from "@/features/signin/actions";
import { assertSignedIn } from "@/server/session";
import { startServerStack } from "../helpers/functional";
import { aUser } from "../helpers/groups";

vi.mock("@/server/session");
vi.mock("next/cache");
vi.mock("next/headers");

const LEA = { userId: "user-1", name: "Léa", sessionId: "session-1" };
const OWNER_CODE = "code-proprietaire-fonctionnel";
const TOO_MANY = { ok: false, error: TOO_MANY_ATTEMPTS };

let db: Database;
let reset: () => Promise<void>;
beforeAll(async () => {
  ({ db, reset } = await startServerStack());
  // Read once by getServerEnv.
  vi.stubEnv("SIGNUP", "invite");
  vi.stubEnv("OWNER_CODE", OWNER_CODE);
});
beforeEach(async () => {
  await reset();
  vi.mocked(assertSignedIn).mockReset().mockResolvedValue(LEA);
  vi.mocked(headers)
    .mockReset()
    .mockResolvedValue(new Headers() as never);
});

const aForm = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
};

/** The next requests come from `ip`, as Vercel forwards it. */
const from = (ip: string) =>
  vi
    .mocked(headers)
    .mockResolvedValue(new Headers({ "x-forwarded-for": ip }) as never);

const asOwner = (ownerCode: string) =>
  prepareSignup(aForm({ name: "Léa", ownerCode }));

const groupCount = async () => (await db.select().from(group)).length;

describe("limites des actions serveur (fonctionnel)", () => {
  it("la 6ᵉ tentative de code propriétaire de la même IP est refusée, même avec le bon code ; une autre IP non", async () => {
    from("203.0.113.1");
    // In parallel: each wrong code waits 500 ms before answering.
    const wrong = await Promise.all(
      Array.from({ length: 5 }, () => asOwner("pas le bon code")),
    );

    expect(wrong).toEqual(Array(5).fill({ ok: false, error: "MAUVAIS CODE" }));
    await expect(asOwner(OWNER_CODE)).resolves.toEqual(TOO_MANY);
    from("203.0.113.2");
    await expect(asOwner(OWNER_CODE)).resolves.toMatchObject({ ok: true });
  });

  it("la 11ᵉ inscription de la même IP en 10 minutes est refusée, avant même le prénom", async () => {
    from("203.0.113.1");
    for (let i = 0; i < 10; i++) {
      await prepareSignup(aForm({ name: "" }));
    }

    await expect(prepareSignup(aForm({ name: "Léa" }))).resolves.toEqual(
      TOO_MANY,
    );
    expect(await db.select().from(rateLimit)).toEqual([
      expect.objectContaining({ key: "signup:203.0.113.1", count: 11 }),
    ]);
  });

  it("la 6ᵉ suppression de compte avec un prénom faux est refusée, et le compte existe toujours", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(deleteAccount(aForm({ name: "Hugo" }))).resolves.toEqual({
        ok: false,
        error: "TAPE TON PRÉNOM EXACT",
      });
    }

    await expect(deleteAccount(aForm({ name: "Léa" }))).resolves.toEqual(
      TOO_MANY,
    );
    expect(
      await db.select().from(user).where(eq(user.id, LEA.userId)),
    ).toHaveLength(1);
  });

  it("le 11ᵉ createGroup en une heure est refusé, et aucun groupe n’est créé ; la limite de Léa n’affecte pas Hugo", async () => {
    for (let i = 0; i < 10; i++) {
      await expect(
        createGroup(aForm({ name: `GROUPE ${i}` })),
      ).resolves.toMatchObject({ ok: true });
    }

    await expect(createGroup(aForm({ name: "UN DE TROP" }))).resolves.toEqual(
      TOO_MANY,
    );
    expect(await groupCount()).toBe(10);

    const hugo = await aUser(db, "Hugo");
    vi.mocked(assertSignedIn).mockResolvedValue({
      userId: hugo,
      name: "Hugo",
      sessionId: "session-hugo",
    });
    await expect(
      createGroup(aForm({ name: "CHEZ HUGO" })),
    ).resolves.toMatchObject({ ok: true });
    expect(await groupCount()).toBe(11);
  });
});
