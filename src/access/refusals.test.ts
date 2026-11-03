import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leaveIfRefused, notMemberRefusal, signedOutRefusal } from "./refusals";

const replace = vi.fn();

beforeEach(() => {
  replace.mockReset();
  vi.stubGlobal("window", { location: { replace } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** What the client gets in production: the digest, never the message. */
const asSentToTheClient = (error: Error) =>
  Object.assign(
    new Error("An error occurred in the Server Components render."),
    {
      digest: (error as Error & { digest?: string }).digest,
    },
  );

describe("signedOutRefusal", () => {
  it("dit pourquoi l’action est refusée, et le porte dans son digest", () => {
    const refusal = signedOutRefusal();

    expect(refusal.message).toBe("Server Action refused: not signed in");
    expect(refusal).toHaveProperty("digest", expect.any(String));
  });
});

describe("notMemberRefusal", () => {
  it("dit pourquoi l’action est refusée, avec un autre digest", () => {
    const refusal = notMemberRefusal();

    expect(refusal.message).toBe("Server Action refused: not a member");
    expect(refusal.digest).not.toBe(signedOutRefusal().digest);
  });
});

describe("leaveIfRefused", () => {
  it("une action refusée faute de session : la page de connexion, à la place de celle-ci", () => {
    leaveIfRefused(asSentToTheClient(signedOutRefusal()));

    expect(replace).toHaveBeenCalledWith("/connexion");
  });

  it("une action refusée parce que je ne suis plus membre : l’accueil, rechargé en entier", () => {
    leaveIfRefused(asSentToTheClient(notMemberRefusal()));

    expect(replace).toHaveBeenCalledWith("/");
  });

  it.each([
    ["une autre erreur", new Error("network")],
    ["un digest quelconque", Object.assign(new Error("x"), { digest: "42" })],
    [
      "un digest hérité d’Object",
      Object.assign(new Error("x"), { digest: "toString" }),
    ],
    ["un digest qui n’est pas un texte", { digest: 42 }],
    ["une valeur qui n’est pas une erreur", "oops"],
    ["null", null],
  ])("%s : on reste ici", (_, error) => {
    leaveIfRefused(error);

    expect(replace).not.toHaveBeenCalled();
  });
});
