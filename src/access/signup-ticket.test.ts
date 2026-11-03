import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createSignupTicket,
  readSignupTicket,
  type SignupTicket,
} from "./signup-ticket";

const SECRET = "a-long-enough-better-auth-secret";
const NOW = 1_800_000_000_000;
const TEN_MINUTES = 10 * 60 * 1000;
const TICKET: SignupTicket = { name: "Léa", owner: false, invite: null };
const JTI = "AAAAAAAAAAAAAAAAAAAAAA";
/** What reading a ticket issued for `ticket` gives back: a random jti too. */
const issued = (ticket: SignupTicket) => ({
  ...ticket,
  jti: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
});

const b64 = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

/** Signs an arbitrary payload exactly like the module, to test odd shapes. */
function sign(
  payload: unknown,
  secret = SECRET,
  label = "wewatch:signup-ticket:v1",
) {
  const encoded = b64(JSON.stringify(payload));
  const mac = createHmac("sha256", secret)
    .update(`${label}.${encoded}`)
    .digest();
  return `${encoded}.${b64(mac)}`;
}

describe("createSignupTicket / readSignupTicket", () => {
  it("relit à l'identique un ticket créé", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    expect(await readSignupTicket(token, SECRET, NOW)).toEqual(issued(TICKET));
  });

  it("relit un ticket propriétaire", async () => {
    const owner = { name: "Léa", owner: true, invite: null };
    const token = await createSignupTicket(owner, SECRET, NOW);
    expect(await readSignupTicket(token, SECRET, NOW)).toEqual(issued(owner));
  });

  it("donne à chaque ticket un identifiant unique (jti)", async () => {
    const first = await readSignupTicket(
      await createSignupTicket(TICKET, SECRET, NOW),
      SECRET,
      NOW,
    );
    const second = await readSignupTicket(
      await createSignupTicket(TICKET, SECRET, NOW),
      SECRET,
      NOW,
    );
    expect(first?.jti).not.toBe(second?.jti);
  });

  it("utilise l'heure courante par défaut", async () => {
    const token = await createSignupTicket(TICKET, SECRET);
    expect(await readSignupTicket(token, SECRET)).toEqual(issued(TICKET));
  });

  it("accepte le ticket jusqu'à l'expiration incluse", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    expect(await readSignupTicket(token, SECRET, NOW + TEN_MINUTES)).toEqual(
      issued(TICKET),
    );
  });

  it("refuse un ticket expiré", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    expect(
      await readSignupTicket(token, SECRET, NOW + TEN_MINUTES + 1),
    ).toBeNull();
  });

  it("refuse une signature modifiée", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    const middle = token.length - 20;
    const flipped = token[middle] === "A" ? "B" : "A";
    const tampered = token.slice(0, middle) + flipped + token.slice(middle + 1);
    expect(await readSignupTicket(tampered, SECRET, NOW)).toBeNull();
  });

  it("refuse une variante non canonique d'une signature valide", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const last = token.at(-1) as string;
    // 32 bytes -> 43 characters: the last one carries 2 unused low bits.
    const variant = token.slice(0, -1) + alphabet[alphabet.indexOf(last) ^ 1];
    const signatureOf = (value: string) => value.split(".")[1] as string;
    expect(variant).not.toBe(token);
    expect(Buffer.from(signatureOf(variant), "base64url")).toEqual(
      Buffer.from(signatureOf(token), "base64url"),
    );
    expect(await readSignupTicket(variant, SECRET, NOW)).toBeNull();
  });

  it("refuse tout si l'heure fournie n'est pas un nombre (NaN)", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    expect(await readSignupTicket(token, SECRET, Number.NaN)).toBeNull();
  });

  it("refuse un jeton démesuré, même correctement signé", async () => {
    // Trailing spaces are collapsed by parseDisplayName: valid but oversized.
    const token = sign({
      name: `Léa${" ".repeat(600)}`,
      owner: false,
      invite: null,
      exp: NOW + 1000,
      jti: JTI,
    });
    expect(token.length).toBeGreaterThan(512);
    expect(await readSignupTicket(token, SECRET, NOW)).toBeNull();
  });

  it("normalise le nom à la création", async () => {
    const token = await createSignupTicket(
      { name: "  Léa   Dupont ", owner: false, invite: null },
      SECRET,
      NOW,
    );
    expect(await readSignupTicket(token, SECRET, NOW)).toEqual(
      issued({ name: "Léa Dupont", owner: false, invite: null }),
    );
  });

  it("refuse de créer un ticket pour un nom invalide", async () => {
    await expect(
      createSignupTicket(
        { name: "   ", owner: false, invite: null },
        SECRET,
        NOW,
      ),
    ).rejects.toThrow("Invalid display name");
  });

  it("refuse une charge modifiée (owner passé à true)", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    const [, signature] = token.split(".");
    const forged = b64(
      JSON.stringify({
        name: "Léa",
        owner: true,
        invite: null,
        exp: NOW + TEN_MINUTES,
        jti: JTI,
      }),
    );
    expect(
      await readSignupTicket(`${forged}.${signature}`, SECRET, NOW),
    ).toBeNull();
  });

  it("refuse un autre secret", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    expect(
      await readSignupTicket(token, "another-secret-value", NOW),
    ).toBeNull();
  });

  it("refuse une signature faite avec un autre label de domaine", async () => {
    const payload = { ...TICKET, exp: NOW + 1000, jti: JTI };
    expect(await readSignupTicket(sign(payload), SECRET, NOW)).toEqual(
      issued(TICKET),
    );
    expect(
      await readSignupTicket(sign(payload, SECRET, "other"), SECRET, NOW),
    ).toBeNull();
  });

  it.each([null, undefined, "", "abc", "a.b.c", ".", "a.", ".b"])(
    "refuse le jeton mal formé %j",
    async (token) => {
      expect(await readSignupTicket(token, SECRET, NOW)).toBeNull();
    },
  );

  it("ne lève pas sur du base64 invalide", async () => {
    expect(await readSignupTicket("@@@.###", SECRET, NOW)).toBeNull();
    expect(await readSignupTicket("a.b=", SECRET, NOW)).toBeNull();
  });

  it("refuse une charge signée mais qui n'est pas du JSON", async () => {
    const encoded = b64("not json");
    const mac = createHmac("sha256", SECRET)
      .update(`wewatch:signup-ticket:v1.${encoded}`)
      .digest();
    expect(
      await readSignupTicket(`${encoded}.${b64(mac)}`, SECRET, NOW),
    ).toBeNull();
  });

  it("refuse un nom invalide pour parseDisplayName", async () => {
    const token = sign({
      name: "   ",
      owner: false,
      invite: null,
      exp: NOW + 1000,
      jti: JTI,
    });
    expect(await readSignupTicket(token, SECRET, NOW)).toBeNull();
  });

  const VALID = {
    name: "Léa",
    owner: false,
    invite: null,
    exp: NOW + 1000,
    jti: JTI,
  };
  const without = (key: keyof typeof VALID) =>
    Object.fromEntries(Object.entries(VALID).filter(([name]) => name !== key));

  it.each([
    ["owner non booléen", { ...VALID, owner: "true" }],
    ["owner absent", without("owner")],
    ["exp absent", without("exp")],
    ["exp non entier", { ...VALID, exp: NOW + 0.5 }],
    ["exp chaîne", { ...VALID, exp: `${NOW + 1000}` }],
    ["jti absent", without("jti")],
    ["jti trop court", { ...VALID, jti: "AAAA" }],
    ["jti hors base64url", { ...VALID, jti: "A".repeat(21) + "=" }],
    ["champ inconnu", { ...VALID, admin: 1 }],
    ["invite absent", without("invite")],
    ["invite vide", { ...VALID, invite: "" }],
    ["invite de 65 caractères", { ...VALID, invite: "g".repeat(65) }],
    ["invite non chaîne", { ...VALID, invite: 42 }],
    ["tableau", [1, 2]],
    ["null", null],
  ])(
    "refuse une charge signée de forme inconnue : %s",
    async (_label, payload) => {
      expect(await readSignupTicket(sign(payload), SECRET, NOW)).toBeNull();
    },
  );

  it.each(["@@@", "a", "/w"])(
    "refuse une charge signée mais en base64 invalide : %s",
    async (encoded) => {
      const mac = createHmac("sha256", SECRET)
        .update(`wewatch:signup-ticket:v1.${encoded}`)
        .digest();
      expect(
        await readSignupTicket(`${encoded}.${b64(mac)}`, SECRET, NOW),
      ).toBeNull();
    },
  );

  describe("invitation", () => {
    const INVITED: SignupTicket = { name: "Léa", owner: false, invite: "g-5" };

    it("relit l’id du groupe de l’invitation", async () => {
      const token = await createSignupTicket(INVITED, SECRET, NOW);
      expect(await readSignupTicket(token, SECRET, NOW)).toEqual(
        issued(INVITED),
      );
    });

    it("refuse une invitation ajoutée ou changée après la signature", async () => {
      const token = await createSignupTicket(TICKET, SECRET, NOW);
      const [, signature] = token.split(".");
      const forged = b64(
        JSON.stringify({ ...VALID, exp: NOW + TEN_MINUTES, invite: "g-5" }),
      );
      expect(
        await readSignupTicket(`${forged}.${signature}`, SECRET, NOW),
      ).toBeNull();
    });

    it("le plus gros ticket légitime tient en 512 caractères et se relit", async () => {
      // 30 four-byte characters, the longest group id, the owner role.
      const largest: SignupTicket = {
        name: "\u{1F3AC}".repeat(30),
        owner: true,
        invite: "g".repeat(64),
      };
      const token = await createSignupTicket(largest, SECRET, NOW);
      expect(token.length).toBeLessThanOrEqual(512);
      expect(await readSignupTicket(token, SECRET, NOW)).toEqual(
        issued(largest),
      );
    });
  });
});
