import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSignupTicket } from "@/access/signup-ticket";

const findByInvite = vi.hoisted(() => vi.fn());
vi.mock("@/server/container", () => ({ getGroups: () => ({ findByInvite }) }));

const SECRET = "un-secret-better-auth-de-test-0123456789";
const TOKEN = "A".repeat(43);
const INVITE_INVALID = "CE LIEN N’EST PLUS VALABLE";
const OWNER_CODE = "code proprio de test";
/** Spec §9: the pause before answering a wrong owner code, as the old unlock. */
const WRONG_CODE_DELAY_MS = 500;

/** A fresh `actions` module, reading the stubbed environment (getServerEnv caches). */
async function load(env: { SIGNUP: "open" | "invite"; OWNER_CODE?: string }) {
  vi.stubEnv("TMDB_ACCESS_TOKEN", "tok");
  vi.stubEnv("DATABASE_URL", "file:local.db");
  vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("SIGNUP", env.SIGNUP);
  vi.stubEnv("OWNER_CODE", env.OWNER_CODE ?? "");
  vi.resetModules();
  return (await import("./actions")).prepareSignup;
}

function form(fields: {
  name?: string;
  ownerCode?: string;
  invite?: string;
}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

/**
 * Lets the real crypto work finish until the action arms its delay
 * (or settles without one, so a missing delay fails instead of hanging).
 */
async function untilDelayIsArmed(pending: Promise<unknown>): Promise<void> {
  let settled = false;
  pending.then(
    () => (settled = true),
    () => (settled = true),
  );
  while (!settled && vi.getTimerCount() === 0) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function ticketOf(result: unknown) {
  expect(result).toEqual({ ok: true, ticket: expect.any(String) });
  return readSignupTicket((result as { ticket: string }).ticket, SECRET);
}

beforeEach(() => {
  findByInvite.mockReset().mockResolvedValue({ id: "g-5", name: "LA COLOC" });
  // Only setTimeout: Web Crypto and setImmediate keep running for real.
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("prepareSignup", () => {
  it("inscriptions ouvertes : un prénom valide reçoit un ticket signé", async () => {
    const prepareSignup = await load({ SIGNUP: "open" });

    const result = await prepareSignup(form({ name: "  Léa   M " }));

    await expect(ticketOf(result)).resolves.toEqual({
      name: "Léa M",
      owner: false,
      invite: null,
      jti: expect.any(String),
    });
  });

  it.each([
    ["vide", ""],
    ["blanc", "   "],
    ["trop long", "a".repeat(31)],
  ])("refuse un prénom %s", async (_label, name) => {
    const prepareSignup = await load({ SIGNUP: "open" });

    await expect(prepareSignup(form({ name }))).resolves.toEqual({
      ok: false,
      error: "UN PRÉNOM DE 1 À 30 CARACTÈRES",
    });
  });

  it("refuse un prénom absent ou envoyé comme fichier", async () => {
    const prepareSignup = await load({ SIGNUP: "open" });
    const withFile = new FormData();
    withFile.set("name", new Blob(["Léa"]));

    for (const data of [form({}), withFile]) {
      await expect(prepareSignup(data)).resolves.toEqual({
        ok: false,
        error: "UN PRÉNOM DE 1 À 30 CARACTÈRES",
      });
    }
  });

  it.each([null, "Léa", { name: "Léa" }])(
    "traite un corps qui n'est pas un formulaire (%s) comme un prénom invalide",
    async (body) => {
      const prepareSignup = await load({ SIGNUP: "open" });

      await expect(prepareSignup(body as unknown as FormData)).resolves.toEqual(
        {
          ok: false,
          error: "UN PRÉNOM DE 1 À 30 CARACTÈRES",
        },
      );
    },
  );

  it("sur invitation, sans code : WEWATCH SE REJOINT SUR INVITATION", async () => {
    const prepareSignup = await load({ SIGNUP: "invite", OWNER_CODE });

    for (const fields of [{ name: "Léa" }, { name: "Léa", ownerCode: "  " }]) {
      await expect(prepareSignup(form(fields))).resolves.toEqual({
        ok: false,
        error: "WEWATCH SE REJOINT SUR INVITATION",
      });
    }
  });

  it("sur invitation, le bon code propriétaire donne un ticket de propriétaire", async () => {
    const prepareSignup = await load({ SIGNUP: "invite", OWNER_CODE });

    const result = await prepareSignup(
      form({ name: "Léa", ownerCode: ` ${OWNER_CODE} ` }),
    );

    await expect(ticketOf(result)).resolves.toEqual({
      name: "Léa",
      owner: true,
      invite: null,
      jti: expect.any(String),
    });
  });

  it("le bon code propriétaire vaut aussi en inscriptions ouvertes", async () => {
    const prepareSignup = await load({ SIGNUP: "open", OWNER_CODE });

    const result = await prepareSignup(
      form({ name: "Léa", ownerCode: OWNER_CODE }),
    );

    await expect(ticketOf(result)).resolves.toEqual({
      name: "Léa",
      owner: true,
      invite: null,
      jti: expect.any(String),
    });
  });

  it.each([
    ["sur invitation", "invite", OWNER_CODE],
    ["sur invitation sans code configuré", "invite", undefined],
    ["en inscriptions ouvertes", "open", OWNER_CODE],
  ] as const)(
    "répond MAUVAIS CODE après un délai fixe %s",
    async (_label, SIGNUP, ownerCode) => {
      const prepareSignup = await load({ SIGNUP, OWNER_CODE: ownerCode });
      let settled = false;
      const pending = prepareSignup(
        form({ name: "Léa", ownerCode: "pas le bon code" }),
      ).finally(() => {
        settled = true;
      });

      await untilDelayIsArmed(pending);
      await vi.advanceTimersByTimeAsync(WRONG_CODE_DELAY_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toEqual({
        ok: false,
        error: "MAUVAIS CODE",
      });
    },
  );

  it("ne renvoie jamais le code propriétaire", async () => {
    const prepareSignup = await load({ SIGNUP: "invite", OWNER_CODE });

    const result = await prepareSignup(
      form({ name: "Léa", ownerCode: OWNER_CODE }),
    );

    expect(JSON.stringify(result)).not.toContain(OWNER_CODE);
    const ticket = (result as { ticket: string }).ticket;
    const payload = atob(
      ticket.split(".")[0]!.replaceAll("-", "+").replaceAll("_", "/"),
    );
    expect(payload).not.toContain(OWNER_CODE);
  });
});

describe("prepareSignup : par une invitation", () => {
  const MODES = ["invite", "open"] as const;

  it.each(MODES)(
    "mode %s : un lien valide donne un ticket portant l’id du groupe",
    async (SIGNUP) => {
      const prepareSignup = await load({ SIGNUP, OWNER_CODE });

      const result = await prepareSignup(form({ name: "Léa", invite: TOKEN }));

      await expect(ticketOf(result)).resolves.toEqual({
        name: "Léa",
        owner: false,
        invite: "g-5",
        jti: expect.any(String),
      });
      expect(findByInvite).toHaveBeenCalledWith(TOKEN);
    },
  );

  it("le jeton ne va jamais dans le ticket, seul l’id du groupe", async () => {
    const prepareSignup = await load({ SIGNUP: "invite", OWNER_CODE });

    const result = await prepareSignup(form({ name: "Léa", invite: TOKEN }));

    const ticket = (result as { ticket: string }).ticket;
    expect(ticket).not.toContain(TOKEN);
    expect(
      atob(ticket.split(".")[0]!.replaceAll("-", "+").replaceAll("_", "/")),
    ).not.toContain(TOKEN);
  });

  it("le bon code propriétaire avec une invitation : propriétaire et invité", async () => {
    const prepareSignup = await load({ SIGNUP: "invite", OWNER_CODE });

    const result = await prepareSignup(
      form({ name: "Léa", ownerCode: OWNER_CODE, invite: TOKEN }),
    );

    await expect(ticketOf(result)).resolves.toMatchObject({
      owner: true,
      invite: "g-5",
    });
  });

  it("un mauvais code avec une invitation : MAUVAIS CODE", async () => {
    const prepareSignup = await load({ SIGNUP: "invite", OWNER_CODE });

    const pending = prepareSignup(
      form({ name: "Léa", ownerCode: "pas le bon code", invite: TOKEN }),
    );
    await untilDelayIsArmed(pending);
    await vi.advanceTimersByTimeAsync(WRONG_CODE_DELAY_MS);

    await expect(pending).resolves.toEqual({
      ok: false,
      error: "MAUVAIS CODE",
    });
  });

  it("un champ invitation vide compte comme aucune invitation", async () => {
    const prepareSignup = await load({ SIGNUP: "invite", OWNER_CODE });

    await expect(
      prepareSignup(form({ name: "Léa", invite: "" })),
    ).resolves.toEqual({
      ok: false,
      error: "WEWATCH SE REJOINT SUR INVITATION",
    });
    expect(findByInvite).not.toHaveBeenCalled();
  });

  describe.each(MODES)("mode %s, lien invalide", (SIGNUP) => {
    it.each([
      ["trop court", "court"],
      ["44 caractères", "A".repeat(44)],
      ["hors base64url", `${"A".repeat(42)}=`],
      ["entouré d’espaces", ` ${TOKEN} `],
    ])(
      "%s : CE LIEN N’EST PLUS VALABLE, sans lire la base",
      async (_label, invite) => {
        const prepareSignup = await load({ SIGNUP, OWNER_CODE });

        await expect(
          prepareSignup(form({ name: "Léa", ownerCode: OWNER_CODE, invite })),
        ).resolves.toEqual({ ok: false, error: INVITE_INVALID });
        expect(findByInvite).not.toHaveBeenCalled();
      },
    );

    it("envoyé comme fichier : CE LIEN N’EST PLUS VALABLE", async () => {
      const prepareSignup = await load({ SIGNUP, OWNER_CODE });
      const data = form({ name: "Léa" });
      data.set("invite", new Blob([TOKEN]));

      await expect(prepareSignup(data)).resolves.toEqual({
        ok: false,
        error: INVITE_INVALID,
      });
      expect(findByInvite).not.toHaveBeenCalled();
    });

    it("inconnu ou régénéré : CE LIEN N’EST PLUS VALABLE, même avec le bon code", async () => {
      findByInvite.mockResolvedValue(null);
      const prepareSignup = await load({ SIGNUP, OWNER_CODE });

      await expect(
        prepareSignup(
          form({ name: "Léa", ownerCode: OWNER_CODE, invite: TOKEN }),
        ),
      ).resolves.toEqual({ ok: false, error: INVITE_INVALID });
    });
  });
});
