import { getIP } from "better-auth/api";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, withinLimit } from "./rate-limit";

const consume = vi.hoisted(() => vi.fn());
const OPTIONS = { baseURL: "http://localhost:3000" };

vi.mock("next/headers");
vi.mock("better-auth/api", () => ({ getIP: vi.fn() }));
vi.mock("./container", () => ({
  getAuth: () => ({ options: OPTIONS }),
  getRateLimits: () => ({ consume }),
}));

beforeEach(() => {
  consume.mockReset().mockResolvedValue({ allowed: true, retryAfter: null });
  vi.mocked(getIP).mockReset().mockReturnValue("203.0.113.7");
});

describe("withinLimit", () => {
  it("consomme une tentative sous la clé « nom:sujet », avec la règle de l’action", async () => {
    await expect(withinLimit("create-group", "user-1")).resolves.toBe(true);

    expect(consume).toHaveBeenCalledWith("create-group:user-1", {
      window: 3600,
      max: 10,
    });
  });

  it("refusée : false", async () => {
    consume.mockResolvedValue({ allowed: false, retryAfter: 12 });

    await expect(withinLimit("owner-code", "203.0.113.7")).resolves.toBe(false);
    expect(consume).toHaveBeenCalledWith("owner-code:203.0.113.7", {
      window: 900,
      max: 5,
    });
  });
});

describe("clientIp", () => {
  it("l’IP que Better Auth lit dans les en-têtes de la requête, avec ses options", async () => {
    const request = new Headers({ "x-forwarded-for": "203.0.113.7" });
    vi.mocked(headers).mockResolvedValue(request as never);

    await expect(clientIp()).resolves.toBe("203.0.113.7");
    expect(getIP).toHaveBeenCalledWith(request, OPTIONS);
  });

  it("sans IP de confiance : la clé partagée « no-trusted-ip », comme Better Auth", async () => {
    vi.mocked(getIP).mockReturnValue(null);

    await expect(clientIp()).resolves.toBe("no-trusted-ip");
  });
});
