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
const TICKET: SignupTicket = { name: "Léa", owner: false };

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
    expect(await readSignupTicket(token, SECRET, NOW)).toEqual(TICKET);
  });

  it("relit un ticket propriétaire", async () => {
    const owner = { name: "Léa", owner: true };
    const token = await createSignupTicket(owner, SECRET, NOW);
    expect(await readSignupTicket(token, SECRET, NOW)).toEqual(owner);
  });

  it("utilise l'heure courante par défaut", async () => {
    const token = await createSignupTicket(TICKET, SECRET);
    expect(await readSignupTicket(token, SECRET)).toEqual(TICKET);
  });

  it("accepte le ticket jusqu'à l'expiration incluse", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    expect(await readSignupTicket(token, SECRET, NOW + TEN_MINUTES)).toEqual(
      TICKET,
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
    const flipped = token.endsWith("A") ? "B" : "A";
    expect(
      await readSignupTicket(token.slice(0, -1) + flipped, SECRET, NOW),
    ).toBeNull();
  });

  it("refuse une charge modifiée (owner passé à true)", async () => {
    const token = await createSignupTicket(TICKET, SECRET, NOW);
    const [, signature] = token.split(".");
    const forged = b64(
      JSON.stringify({ name: "Léa", owner: true, exp: NOW + TEN_MINUTES }),
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
    const payload = { ...TICKET, exp: NOW + 1000 };
    expect(await readSignupTicket(sign(payload), SECRET, NOW)).toEqual(TICKET);
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
    const token = sign({ name: "   ", owner: false, exp: NOW + 1000 });
    expect(await readSignupTicket(token, SECRET, NOW)).toBeNull();
  });

  it.each([
    ["owner non booléen", { name: "Léa", owner: "true", exp: NOW + 1000 }],
    ["owner absent", { name: "Léa", exp: NOW + 1000 }],
    ["exp absent", { name: "Léa", owner: false }],
    ["exp non entier", { name: "Léa", owner: false, exp: NOW + 0.5 }],
    ["exp chaîne", { name: "Léa", owner: false, exp: `${NOW + 1000}` }],
    ["champ inconnu", { name: "Léa", owner: false, exp: NOW + 1000, admin: 1 }],
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
});
