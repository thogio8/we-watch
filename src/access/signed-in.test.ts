import { afterEach, describe, expect, it, vi } from "vitest";
import { readSignedIn } from "./signed-in";

const cookieHeaders = (...cookies: string[]) => {
  const headers = new Headers();
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return headers;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readSignedIn", () => {
  it("une session donne « connecté » et transmet les cookies rafraîchis", async () => {
    const result = await readSignedIn(async () => ({
      response: { user: { id: "user-1" } },
      headers: cookieHeaders("a=1; Path=/", "b=2; Path=/"),
    }));

    expect(result).toEqual({
      signedIn: true,
      setCookies: ["a=1; Path=/", "b=2; Path=/"],
    });
  });

  it("sans session (absente, expirée ou forgée) : pas connecté", async () => {
    const result = await readSignedIn(async () => ({
      response: null,
      headers: cookieHeaders("expired=; Max-Age=0"),
    }));

    expect(result).toEqual({
      signedIn: false,
      setCookies: ["expired=; Max-Age=0"],
    });
  });

  it("si la lecture échoue (base injoignable), on reste fermé, sans exception", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("database down");

    const result = await readSignedIn(async () => {
      throw failure;
    });

    expect(result).toEqual({ signedIn: false, setCookies: [] });
    expect(log).toHaveBeenCalledWith(
      "Session check failed, treated as signed out:",
      failure,
    );
  });
});
