import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmThenReplay, refusedAsStale } from "./recent-sign-in";

const signInPasskey = vi.fn();

vi.mock("@/features/signin/authClient", () => ({
  authClient: { signIn: { passkey: () => signInPasskey() } },
}));

type Outcome = { ok: true } | { ok: false; reason: "stale" | "last" };
const STALE: Outcome = { ok: false, reason: "stale" };
const DONE: Outcome = { ok: true };
const CONFIRM = "CONFIRME AVEC TA CLÉ D’ACCÈS POUR CONTINUER";

const revoke = vi.fn();
const reconfirm = { sessionId: "old-session", revoke };

beforeEach(() => {
  signInPasskey.mockReset().mockResolvedValue({ data: {}, error: null });
  revoke.mockReset().mockResolvedValue(true);
});

/** An attempt answering each of `outcomes` in turn. */
const attemptAnswering = (...outcomes: Outcome[]) =>
  vi.fn(async () => outcomes.shift() as Outcome);

describe("refusedAsStale", () => {
  it("reconnaît le refus « stale » d’une action, et lui seul", () => {
    expect(refusedAsStale(STALE)).toBe(true);
    expect(refusedAsStale({ ok: false, reason: "last" })).toBe(false);
    expect(refusedAsStale({ ok: false, error: "TAPE TON PRÉNOM EXACT" })).toBe(
      false,
    );
    expect(refusedAsStale(DONE)).toBe(false);
  });
});

describe("confirmThenReplay", () => {
  it("une session récente : l’action passe, sans clé d’accès demandée", async () => {
    const attempt = attemptAnswering(DONE);

    await expect(
      confirmThenReplay(attempt, refusedAsStale, reconfirm),
    ).resolves.toEqual({ done: true, outcome: DONE });
    expect(signInPasskey).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  it("un autre refus (la dernière clé) est rendu tel quel, sans clé d’accès demandée", async () => {
    const last: Outcome = { ok: false, reason: "last" };

    await expect(
      confirmThenReplay(attemptAnswering(last), refusedAsStale, reconfirm),
    ).resolves.toEqual({ done: true, outcome: last });
    expect(signInPasskey).not.toHaveBeenCalled();
  });

  it("trop ancienne : la clé d’accès, puis l’ancienne session déconnectée, puis l’action rejouée une fois", async () => {
    const order: string[] = [];
    signInPasskey.mockImplementation(async () => {
      order.push("passkey");
      return { data: {}, error: null };
    });
    revoke.mockImplementation(async () => {
      order.push("revoke");
      return true;
    });
    const attempt = vi.fn(async () => {
      order.push("attempt");
      return order.length === 1 ? STALE : DONE;
    });

    await expect(
      confirmThenReplay(attempt, refusedAsStale, reconfirm),
    ).resolves.toEqual({ done: true, outcome: DONE });
    expect(order).toEqual(["attempt", "passkey", "revoke", "attempt"]);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("old-session");
  });

  it.each([
    ["annulée", () => Promise.resolve({ data: null, error: { code: "X" } })],
    ["en panne", () => Promise.reject(new Error("raw"))],
  ])(
    "la clé d’accès %s : rien n’est rejoué ni déconnecté, « CONFIRME… »",
    async (_, outcome) => {
      signInPasskey.mockImplementation(outcome);
      const attempt = attemptAnswering(STALE, DONE);

      await expect(
        confirmThenReplay(attempt, refusedAsStale, reconfirm),
      ).resolves.toEqual({ done: false, error: CONFIRM });
      expect(attempt).toHaveBeenCalledOnce();
      expect(revoke).not.toHaveBeenCalled();
    },
  );

  it("trop d’essais de connexion (429) : il le dit, rien n’est rejoué", async () => {
    signInPasskey.mockResolvedValue({ data: null, error: { status: 429 } });
    const attempt = attemptAnswering(STALE, DONE);

    await expect(
      confirmThenReplay(attempt, refusedAsStale, reconfirm),
    ).resolves.toEqual({
      done: false,
      error: "TROP D’ESSAIS. RÉESSAIE DANS UN MOMENT.",
    });
    expect(attempt).toHaveBeenCalledOnce();
  });

  it("l’ancienne session n’est pas à moi ou plus là : rien n’est rejoué", async () => {
    revoke.mockResolvedValue(false);
    const attempt = attemptAnswering(STALE, DONE);

    await expect(
      confirmThenReplay(attempt, refusedAsStale, reconfirm),
    ).resolves.toEqual({ done: false, error: CONFIRM });
    expect(attempt).toHaveBeenCalledOnce();
  });

  it("sans session connue de cet appareil : rejouée sans rien déconnecter", async () => {
    const attempt = attemptAnswering(STALE, DONE);

    await expect(
      confirmThenReplay(attempt, refusedAsStale, {
        sessionId: undefined,
        revoke,
      }),
    ).resolves.toEqual({ done: true, outcome: DONE });
    expect(revoke).not.toHaveBeenCalled();
  });

  it("une panne de la déconnexion est levée, comme celle d’une action", async () => {
    revoke.mockRejectedValue(new Error("Failed to fetch"));

    await expect(
      confirmThenReplay(
        attemptAnswering(STALE, DONE),
        refusedAsStale,
        reconfirm,
      ),
    ).rejects.toThrow("Failed to fetch");
  });
});
